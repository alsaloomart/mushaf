/* طبقة الصوت — Audio layer
 * التلاوات لكل آية من Quran Foundation (verses.quran.com) ومرآة EveryAyah على quranicaudio.com.
 * قبل التشغيل: نتحقق أن رقم السورة والآية في اسم الملف (SSSAAA.mp3) يطابق الآية المطلوبة.
 */
const AU = (() => {
  const API = 'https://api.quran.com/api/v4';
  const RECITERS = [
    { id: 6, name: 'محمود خليل الحصري', style: 'مرتّل' },
    { id: 12, name: 'محمود خليل الحصري', style: 'المصحف المعلّم' },
    { id: 7, name: 'مشاري راشد العفاسي', style: 'مرتّل' },
    { id: 9, name: 'محمد صديق المنشاوي', style: 'مرتّل' },
    { id: 3, name: 'عبد الرحمن السديس', style: 'مرتّل' },
    { id: 10, name: 'سعود الشريم', style: 'مرتّل' },
    { id: 2, name: 'عبد الباسط عبد الصمد', style: 'مرتّل' }
  ];
  const maps = new Map();
  function chapterMap(rid, s) {
    const id = rid + ':' + s;
    if (!maps.has(id)) {
      const pr = fetch(`${API}/recitations/${rid}/by_chapter/${s}?per_page=300`).then(r => {
        if (!r.ok) throw new Error('تعذّر تشغيل هذه الآية.'); return r.json();
      }).catch(e => { throw new Error(e.message.startsWith('تعذّر') ? e.message : 'تحقّق من اتصالك بالإنترنت.'); }).then(d => { const m = new Map(); d.audio_files.forEach(f => m.set(f.verse_key, f.url)); return m; });
      pr.catch(() => maps.delete(id));
      maps.set(id, pr);
    }
    return maps.get(id);
  }
  function absolute(u) {
    if (u.startsWith('//')) return 'https:' + u;
    if (/^https?:/.test(u)) return u;
    return 'https://verses.quran.com/' + u;
  }
  /* يرجّع رابطًا موثّقًا أو يرمي خطأ إذا لم تتطابق السورة والآية */
  async function urlFor(rid, key) {
    const [s, a] = key.split(':').map(Number);
    const m = await chapterMap(rid, s);
    const u = m.get(key);
    if (!u) throw new Error('لا يوجد تسجيل للآية ' + key);
    verify(key, u);
    return absolute(u);
  }
  function verify(key, u) {
    const [s, a] = key.split(':').map(Number);
    const f = String(u).match(/(\d{3})(\d{3})\.mp3(\?.*)?$/);
    if (!f || +f[1] !== s || +f[2] !== a) throw new Error('عدم تطابق الملف الصوتي مع الآية ' + key + ' — لن يُشغَّل');
    return true;
  }

  /* مشغّل: قائمة آيات، تكرار المقطع أو كل آية */
  const el = new Audio(); el.preload = 'auto';
  const pre = new Audio(); pre.preload = 'auto';
  let st = null; // {keys, i, rid, count, mode, rep, ayRep}
  const ev = { ayah: () => {}, state: () => {}, error: () => {}, blocked: () => {} };
  function on(name, fn) { ev[name] = fn; }
  async function playAt() {
    if (!st) return;
    const key = st.keys[st.i];
    try {
      const url = await urlFor(st.rid, key);
      st.cur = { key, url };
      el.src = url;
      try { await el.play(); }
      catch (e) { if (e && e.name === 'NotAllowedError') { const k2 = st; st = null; ev.blocked(k2); return; } throw e; }
      ev.ayah(key, st);
      ev.state('playing', st);
      // تحميل مسبق للآية التالية
      const nk = st.keys[st.i + 1];
      if (nk) urlFor(st.rid, nk).then(u => { pre.src = u; }).catch(() => {});
      if ('mediaSession' in navigator && !st.meta) {
        try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'الآية ' + key, artist: reciter(st.rid).name, album: 'المصحف الذكي' }); } catch (e) {}
      }
    } catch (e) { ev.error(e); stop(); }
  }
  el.addEventListener('ended', () => {
    if (!st) return;
    if (st.mode === 'ayah' && (st.count === 0 || st.ayRep + 1 < st.count)) { st.ayRep++; return playAt(); }
    st.ayRep = 0;
    if (st.i + 1 < st.keys.length) { st.i++; return playAt(); }
    if (st.mode === 'range' && (st.count === 0 || st.rep + 1 < st.count)) { st.rep++; st.i = 0; return playAt(); }
    if (st.onEnd) { const s0 = st; return s0.onEnd(s0); }
    stop();
  });
  el.addEventListener('error', () => { if (st) { ev.error(new Error('تعذّر تشغيل هذه الآية.')); stop(); } });
  function play(keys, rid, count = 1, mode = 'range', opts = {}) {
    stop(true);
    st = { keys, i: 0, rid, count, mode, rep: 0, ayRep: 0, onEnd: opts.onEnd || null, kind: opts.kind || 'sel' };
    return playAt();
  }
  /* iOS: يلزم تشغيل الصوت أول مرة داخل لمسة من المستخدم. نفتح عنصر الصوت بملف صامت قصير. */
  let unlocked = false;
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (st) return;
    try { el.src = SILENT; const pr = el.play(); if (pr) pr.then(() => { if (!st) el.pause(); }).catch(() => { unlocked = false; }); } catch (e) { unlocked = false; }
  }
  // التالي/السابق داخل القائمة (أزرار شاشة القفل)
  function next() { if (st && st.i + 1 < st.keys.length) { st.i++; st.ayRep = 0; return playAt(); } }
  function prev() { if (st) { if (el.currentTime > 3 || st.i === 0) { el.currentTime = 0; return; } st.i--; st.ayRep = 0; return playAt(); } }
  function pause() { if (st) { el.pause(); ev.state('paused', st); } }
  function resume() { if (st) { el.play(); ev.state('playing', st); } }
  function stop(silent) { el.pause(); el.removeAttribute('src'); const had = st; st = null; if (had && !silent) ev.state('stopped', had); }
  function state() { return st; }
  const reciter = id => RECITERS.find(r => r.id === id) || RECITERS[0];
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', resume);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('stop', () => stop());
    try { navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', () => prev()); } catch (e) {}
  }
  return { RECITERS, reciter, urlFor, verify, unlock, isUnlocked: () => unlocked, play, pause, resume, stop, next, prev, state, on, el };
})();
