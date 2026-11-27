/* طبقة الصوت — Audio layer
 * التلاوات لكل آية من Quran Foundation (verses.quran.com) ومرآة EveryAyah على quranicaudio.com.
 * قبل التشغيل: نتحقق أن رقم السورة والآية في اسم الملف (SSSAAA.mp3) يطابق الآية المطلوبة.
 */
const AU = (() => {
  const API = 'https://api.quran.com/api/v4';
  const RECITERS = [
    { id: 6, name: 'محمود خليل الحصري', style: 'مرتّل' },
    { id: 12, name: 'محمود خليل الحصري', style: 'المصحف المعلّم، تلاوة متأنية للتعلّم' },
    { id: 7, name: 'مشاري راشد العفاسي', style: 'مرتّل' },
    { id: 9, name: 'محمد صديق المنشاوي', style: 'مرتّل' },
    { id: 3, name: 'عبد الرحمن السديس', style: 'مرتّل' },
    { id: 10, name: 'سعود الشريم', style: 'مرتّل' },
    { id: 2, name: 'عبد الباسط عبد الصمد', style: 'مرتّل' },
    // المكتبة الصوتية للقرآن الكريم (mp3quran.net): القارئ 254 «بدر التركي»، مصحف 254 «حفص عن عاصم - مرتل»، 114 سورة.
    // ملفات سور كاملة فقط، بلا توقيت آيات منشور ولا ملفات آيات: يُشغَّل «السورة كاملة» من أولها، بلا تتبع للآيات.
    // توقيت الآيات لهذا المصحف غير منشور في المصدر، فولّدناه آليًا من الملفات نفسها بمواءمة نص الآيات مع الصوت (نموذج تعرّف كلام عربي مفتوح المصدر، wav2vec2، مواءمة CTC قسرية)، ونحفظه ملفًا ثابتًا مع التطبيق.
    { id: 1254, name: 'بدر التركي', style: 'مرتّل', src: 'mp3quran', mq: 254, server: 'https://cdn.mp3quran.net/audio/badr-turki/r1/', tfile: 'data/timings/1254.json' },
    // MP3Quran: القارئ 102 «ماهر المعيقلي». مصحف 133 «حفص عن عاصم - المصحف المجود» له توقيت آيات منشور (ayat_timing read=133)،
    // ومصحف 102 «حفص عن عاصم - مرتل» بلا توقيت: السورة كاملة فقط.
    { id: 1133, name: 'ماهر المعيقلي', style: 'مجوّد، تلاوة متأنية', src: 'mp3quran', mq: 133, server: 'https://cdn.mp3quran.net/audio/maher-muaiqly/r3/', timing: 'https://www.mp3quran.net/api/v3/ayat_timing?read=133&surah=', wfile: 'data/timings/1133w.json' },
    { id: 1102, name: 'ماهر المعيقلي', style: 'مرتّل', src: 'mp3quran', mq: 102, server: 'https://cdn.mp3quran.net/audio/maher-muaiqly/r1/', tfile: 'data/timings/1102.json' }
  ];
  const NOTIME_MSG = 'هذا الصوت متاح لتلاوة السورة كاملة فقط، دون تحديد آية أو تكرار.';
  const maps = new Map();
  function chapterMap(rid, s) {
    const id = rid + ':' + s;
    if (!maps.has(id)) {
      const pr = fetch(`${API}/recitations/${rid}/by_chapter/${s}?per_page=300`).then(r => {
        if (!r.ok) throw new Error('تعذّر تشغيل هذه الآية.'); return r.json();
      }).catch(e => { throw new Error(e.message.startsWith('تعذّر') ? e.message : navigator.onLine === false ? OFF : 'تحقّق من اتصالك بالإنترنت.'); }).then(d => { const m = new Map(); d.audio_files.forEach(f => m.set(f.verse_key, f.url)); return m; });
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

  /* ملف السورة كاملًا مع توقيت كل آية (Quran Foundation): تلاوة متصلة بلا فواصل بين الآيات */
  const QDC = 'https://api.quran.com/api/qdc/audio/reciters/';
  const OFF = 'لا يوجد اتصال بالإنترنت، وهذه السورة لم تُنزَّل بصوت هذا القارئ. نزّلها من الفهرس لتستمع إليها بدون إنترنت.';
  const TF = new Map();
  async function fetchSD(rid, s) {
    const rc = RECITERS.find(x => x.id === rid);
    if (rc && rc.src === 'mp3quran') {
      const sd = { url: rc.server + String(s).padStart(3, '0') + '.mp3', t: null };
      if (rc.tfile) {
        if (!TF.has(rc.id)) { const pr = fetch(rc.tfile).then(r => { if (!r.ok) throw 0; return r.json(); }); pr.catch(() => TF.delete(rc.id)); TF.set(rc.id, pr); }
        let all = null;
        try { all = await TF.get(rc.id); } catch (e) { throw new Error(navigator.onLine === false ? OFF : 'تحقّق من اتصالك بالإنترنت.'); }
        const a = all[s];
        // سورة لم يكتمل توليد توقيتها بعد: السورة كاملة بلا تتبع مؤقتًا
        // x[2] (إن وُجد): بدايات الكلمات نسبةً إلى بداية الآية بوحدات 10ms، لمزامنة شريط التظليل مع وتيرة القارئ في كل سطر
        sd.t = a ? a.map((x, i) => [s + ':' + (i + 1), x[0], x[1], wordsFromStarts(x)]) : null;
      } else if (rc.timing) {
        let r = null;
        try { r = await fetch(rc.timing + s); } catch (e) {}
        if (!r || !r.ok) throw new Error(navigator.onLine === false ? OFF : 'تحقّق من اتصالك بالإنترنت.');
        const d = await r.json();
        sd.t = (Array.isArray(d) ? d : []).map(x => [s + ':' + x.ayah, +x.start_time, +x.end_time]);
        // مواضع الكلمات داخل حدود الآيات المنشورة (مولّدة بمواءمة CTC، للسور المتاحة)، لمزامنة الشريط مع وتيرة القارئ
        if (rc.wfile) {
          if (!TF.has('w' + rc.id)) { const pr = fetch(rc.wfile).then(r => { if (!r.ok) throw 0; return r.json(); }); pr.catch(() => TF.delete('w' + rc.id)); TF.set('w' + rc.id, pr); }
          try { const w = (await TF.get('w' + rc.id))[s]; if (w && w.length === sd.t.length) sd.t.forEach((x, i) => { x[3] = wordsFromStarts([x[1], x[2], w[i]]); }); } catch (e) {}
        }
      }
      verifySurah(s, sd); return sd;
    }
    let r = null;
    try { r = await fetch(`${QDC}${rid}/audio_files?chapter=${s}&segments=true`); } catch (e) {}
    if (!r || !r.ok) throw new Error(navigator.onLine === false ? OFF : 'تحقّق من اتصالك بالإنترنت.');
    const f = ((await r.json()).audio_files || [])[0];
    if (!f || !f.verse_timings) throw new Error('تعذّر تشغيل هذه السورة.');
    const sd = { url: absolute(f.audio_url), t: f.verse_timings.map(v => [v.verse_key, +v.timestamp_from, +v.timestamp_to, wordsFromSegs(v)]) };
    verifySurah(s, sd);
    return sd;
  }
  /* توقيت الكلمات داخل الآية: [[بداية, نهاية], ...] بالمللي ثانية، بترتيب كلمات الآية؛ null إن لم يتوفر */
  function wordsFromStarts(x) {
    const w = x[2]; if (!Array.isArray(w) || !w.length) return null;
    const a = w.map(v => x[0] + v * 10);
    return a.map((v, i) => [v, i + 1 < a.length ? Math.max(v, a[i + 1]) : Math.max(v, x[1])]);
  }
  // مقاطع Quran Foundation: [رقم الكلمة, من, إلى]. عند إعادة القارئ لكلمات سابقة نُبقي الموضع عند آخر كلمة بلغها
  function wordsFromSegs(v) {
    const sg = (v.segments || []).filter(x => Array.isArray(x) && x.length >= 3 && x[0] >= 1);
    if (!sg.length) return null;
    const n = Math.max(...sg.map(x => x[0])), w = new Array(n).fill(null);
    let mx = 0;
    for (const [i, a, b] of sg) {
      if (i > mx) { for (let j = mx + 1; j <= i; j++) if (!w[j - 1]) w[j - 1] = [+a, +b]; mx = i; }
      else if (w[mx - 1]) w[mx - 1][1] = Math.max(w[mx - 1][1], +b);
    }
    return w;
  }
  /* نتحقق أن الملف للسورة نفسها وأن التوقيتات لآياتها بالترتيب */
  function verifySurah(s, sd) {
    const m = String(sd.url).match(/\/0*(\d+)\.mp3(\?.*)?$/);
    const okT = sd.t === null || sd.t.length > 0 && sd.t.every((x, i) => x[0] === s + ':' + (i + 1) && x[2] >= x[1] && (i === 0 || x[1] >= sd.t[i - 1][1]));
    if (!m || +m[1] !== s || !okT) throw new Error('عدم تطابق ملف السورة ' + s + ' — لن يُشغَّل');
    return true;
  }
  const sds = new Map(), checked = new Set();
  function surahData(rid, s) {
    const id = rid + ':' + s;
    if (!sds.has(id)) {
      const pr = (async () => {
        const m = await DL.manifest(rid, s);
        if (m && m.done) {
          // نسخة محمّلة: تعمل فورًا، ومع الاتصال نتأكد مرة في الجلسة أن الملف لم يتغير في المصدر
          if (navigator.onLine !== false && !checked.has(id)) { checked.add(id); fetchSD(rid, s).then(sd => { if (sd.url !== m.url || (sd.t && !m.sd.t) || (sd.t && m.sd.t && (sd.t.length !== m.sd.t.length || sd.t.some((x, i) => x[1] !== m.sd.t[i][1])))) DL.start(rid, s); }).catch(() => {}); }
          return m.sd;
        }
        return fetchSD(rid, s);
      })();
      pr.catch(() => sds.delete(id));
      sds.set(id, pr);
    }
    return sds.get(id);
  }

  /* التحميل للاستماع بدون إنترنت: ملف السورة وتوقيتاتها في تخزين التطبيق الخاص (Cache Storage) لكل قارئ.
   * بطلب المستخدم فقط، ويُحذف متى حذفه. لا يُصدَّر لتطبيقات أخرى. */
  const AC = 'mushaf-preview-audio-';
  const DL = (() => {
    const mk = s => new URL('__dl/' + s + '.json', document.baseURI).href;
    const pk = s => new URL('__dl/part-' + s, document.baseURI).href;
    const mans = new Map(), jobs = new Map(), Q = [], fns = [];
    let running = 0, blobU = null;
    const MAXC = 3;
    const emit = (rid, s, err) => fns.forEach(f => { try { f(rid, s, err); } catch (e) {} });
    const on = f => fns.push(f);
    const swSync = () => { try { navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ type: 'dl-changed' }); } catch (e) {} };
    async function manifest(rid, s) {
      const id = rid + ':' + s;
      if (mans.has(id)) return mans.get(id);
      let m = null;
      try { const c = await caches.open(AC + rid); const r = await c.match(mk(s)); if (r) m = await r.json(); } catch (e) {}
      mans.set(id, m); return m;
    }
    async function has(rid, s) { const m = await manifest(rid, s); return !!(m && m.done); }
    async function src(rid, s, url) {
      try {
        const m = await manifest(rid, s); if (!m || !m.done) return url;
        const r = await (await caches.open(AC + rid)).match(m.url); if (!r) return url;
        const b = await r.blob();
        if (blobU) URL.revokeObjectURL(blobU);
        blobU = URL.createObjectURL(b.type ? b : new Blob([b], { type: 'audio/mpeg' }));
        return blobU;
      } catch (e) { return url; }
    }
    function job(rid, s) { return jobs.get(rid + ':' + s) || null; }
    function persist() { try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(() => false); } catch (e) {} return Promise.resolve(false); }
    function start(rid, s) {
      const id = rid + ':' + s; if (jobs.has(id)) return;
      jobs.set(id, { got: 0, total: 0, state: 'queued', ctl: new AbortController() });
      Q.push([rid, s]); emit(rid, s); persist(); pump();
    }
    function pump() { while (running < MAXC && Q.length) { const [rid, s] = Q.shift(); running++; run(rid, s).finally(() => { running--; pump(); }); } }
    async function run(rid, s) {
      const id = rid + ':' + s, j = jobs.get(id);
      if (!j || j.state === 'cancel') { jobs.delete(id); emit(rid, s); return; }
      j.state = 'run'; emit(rid, s);
      let c;
      try {
        c = await caches.open(AC + rid);
        const sd = await fetchSD(rid, s);
        // متابعة تحميل سابق لم يكتمل (من حيث توقف)
        let part = null; const pr = await c.match(pk(s));
        if (pr && pr.headers.get('x-url') === sd.url) part = await pr.blob();
        const have = part ? part.size : 0;
        const r = await fetch(sd.url, { mode: 'cors', signal: j.ctl.signal, headers: have ? { Range: 'bytes=' + have + '-' } : {} });
        if (r.type === 'opaque' || !r.ok) throw new Error('http ' + r.status);
        const resumed = have && r.status === 206;
        const base = resumed ? [part] : [];
        const total = (r.status === 206 ? +((r.headers.get('content-range') || '').split('/')[1]) : +r.headers.get('content-length')) || 0;
        j.total = total; j.got = resumed ? have : 0; emit(rid, s);
        const rd = r.body.getReader(), chunks = [];
        try {
          for (;;) {
            const { done, value } = await rd.read(); if (done) break;
            chunks.push(value); j.got += value.length;
            const now = Date.now(); if (now - (j.lt || 0) > 250) { j.lt = now; emit(rid, s); }
          }
        } catch (e) {
          const pb = new Blob(base.concat(chunks));
          if (pb.size > 0) { try { await c.put(pk(s), new Response(pb, { headers: { 'x-url': sd.url } })); } catch (x) {} }
          throw e;
        }
        const blob = new Blob(base.concat(chunks), { type: 'audio/mpeg' });
        if (total && blob.size !== total) throw new Error('size');
        await c.put(sd.url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }));
        const old = await manifest(rid, s);
        if (old && old.url && old.url !== sd.url) await c.delete(old.url);
        const m = { rid, s, url: sd.url, sd, bytes: blob.size, done: true, at: Date.now() };
        await c.put(mk(s), new Response(JSON.stringify(m), { headers: { 'Content-Type': 'application/json' } }));
        await c.delete(pk(s));
        mans.set(id, m); sds.set(id, Promise.resolve(sd)); checked.add(id);
        jobs.delete(id); emit(rid, s); swSync();
      } catch (e) {
        const cancelled = j.state === 'cancel' || (e && e.name === 'AbortError' && j.state === 'cancel');
        jobs.delete(id);
        const msg = cancelled ? null : (e && e.name === 'QuotaExceededError') ? 'لا توجد مساحة كافية على الجهاز لتنزيل هذه السورة.'
          : navigator.onLine === false ? 'انقطع الاتصال أثناء التنزيل. اضغط زر التنزيل مرة أخرى للمتابعة من حيث توقّف.' : 'تعذّر تنزيل السورة. اضغط زر التنزيل مرة أخرى للمحاولة.';
        emit(rid, s, msg);
      }
    }
    function cancel(rid, s) {
      const id = rid + ':' + s, j = jobs.get(id); if (!j) return;
      j.state = 'cancel'; try { j.ctl.abort(); } catch (e) {}
      const qi = Q.findIndex(x => x[0] === rid && x[1] === s); if (qi >= 0) { Q.splice(qi, 1); jobs.delete(id); emit(rid, s); }
    }
    async function remove(rid, s) {
      const c = await caches.open(AC + rid), m = await manifest(rid, s);
      if (m && m.url) await c.delete(m.url);
      await c.delete(mk(s)); await c.delete(pk(s));
      mans.set(rid + ':' + s, null); sds.delete(rid + ':' + s);
      emit(rid, s); swSync();
    }
    /* حالة السور لقارئ: done = محمّلة، part = تحميل لم يكتمل */
    async function status(rid) {
      const out = new Map();
      try {
        if (!(await caches.has(AC + rid))) return out;
        const c = await caches.open(AC + rid);
        for (const req of await c.keys()) {
          const m = req.url.match(/__dl\/(part-)?(\d+)(\.json)?$/); if (!m) continue;
          const s = +m[2];
          if (m[1]) { if (out.get(s) !== 'done') out.set(s, 'part'); } else out.set(s, 'done');
        }
      } catch (e) {}
      return out;
    }
    async function list() {
      const out = [];
      for (const k of await caches.keys()) {
        if (!k.startsWith(AC)) continue;
        const rid = +k.slice(AC.length), c = await caches.open(k);
        for (const req of await c.keys()) {
          if (!/__dl\/\d+\.json$/.test(req.url)) continue;
          try { const m = await (await c.match(req)).json(); if (m.done) out.push({ rid, s: m.s, bytes: m.bytes }); } catch (e) {}
        }
      }
      return out.sort((x, y) => x.rid - y.rid || x.s - y.s);
    }
    async function removeAll() {
      [...jobs.keys()].forEach(id => { const [r, s] = id.split(':').map(Number); cancel(r, s); });
      for (const k of await caches.keys()) if (k.startsWith(AC)) await caches.delete(k);
      mans.clear(); sds.clear(); emit(); swSync();
    }
    async function estimate() { try { return await navigator.storage.estimate(); } catch (e) { return null; } }
    async function persisted() { try { return await navigator.storage.persisted(); } catch (e) { return false; } }
    return { manifest, has, src, job, start, cancel, remove, status, list, removeAll, estimate, persist, persisted, on };
  })();

  /* مشغّل: قائمة آيات، تكرار المقطع أو كل آية */
  const el = new Audio(); el.preload = 'auto';
  const pre = new Audio(); pre.preload = 'auto';
  let st = null; // {keys, i, rid, count, mode, rep, ayRep}
  const ev = { ayah: () => {}, state: () => {}, error: () => {}, blocked: () => {}, note: () => {} };
  function on(name, fn) { ev[name] = fn; }
  async function playAt() {
    if (!st) return;
    const key = st.keys[st.i];
    try {
      const url = await urlFor(st.rid, key);
      st.cur = { key, url };
      el.src = url;
      try { await el.play(); }
      catch (e) {
        // المتصفح منع التشغيل خارج اللمسة: نُبقي الآية جاهزة ويظهر زر التشغيل، ولمسه يشغّل فورًا داخل الإيماءة
        if (e && e.name === 'NotAllowedError') { ev.ayah(key, st); ev.state('paused', st); ev.blocked(st); return; }
        throw e;
      }
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
    if (st.full) {
      // انتهى الملف: نكمل التكرار إن وُجد، وإلا ننهي
      st.i = st.keys.length - 1; boundary();
      if (st && st.full && el.ended) { const pr = el.play(); if (pr) pr.catch(() => {}); }
      return;
    }
    if (st.mode === 'ayah' && (st.count === 0 || st.ayRep + 1 < st.count)) { st.ayRep++; return playAt(); }
    st.ayRep = 0;
    if (st.i + 1 < st.keys.length) { st.i++; return playAt(); }
    if (st.mode === 'range' && (st.count === 0 || st.rep + 1 < st.count)) { st.rep++; st.i = 0; return playAt(); }
    if (st.onEnd) { const s0 = st; return s0.onEnd(s0); }
    stop();
  });
  el.addEventListener('error', () => { if (st && el.getAttribute('src')) { ev.error(new Error('تعذّر تشغيل هذه الآية.')); stop(); } });
  function play(keys, rid, count = 1, mode = 'range', opts = {}) {
    stop(true);
    st = { keys, i: 0, rid, count, mode, rep: 0, ayRep: 0, onEnd: opts.onEnd || null, kind: opts.kind || 'sel' };
    return begin(st);
  }
  /* السورة كاملة، أو مقطع من عدة آيات، أو أي تلاوة لسورة محمّلة: ملف السورة الواحد بتوقيتات الآيات (بلا فواصل).
   * غير ذلك (آية واحدة غير محمّلة) أو إن تعذّر ملف السورة: ملفات الآيات كما كانت. */
  async function begin(s0) {
    const s = +s0.keys[0].split(':')[0];
    let untimed = !!reciter(s0.rid).notime;
    if (!untimed && reciter(s0.rid).tfile) { try { untimed = !(await surahData(s0.rid, s)).t; } catch (e) {} if (st !== s0) return; }
    if (untimed) {
      if (s0.kind !== 'surah' && !(s0.keys.length > 1 && s0.keys[0] === s + ':1')) { ev.error(new Error(NOTIME_MSG)); stop(); return; }
      if (s0.keys[0] !== s + ':1') ev.note(reciter(s0.rid).name + ': تبدأ التلاوة من أول السورة، فتوقيت آياتها غير متاح بعد.');
      s0.notime = true;
      const last = +s0.keys[s0.keys.length - 1].split(':')[1];
      s0.keys = Array.from({ length: last }, (_, i) => s + ':' + (i + 1)); s0.i = 0;
      try { return await playFull(s0, s); } catch (e) { if (st !== s0) return; ev.error(navigator.onLine === false ? new Error(OFF) : e); stop(); return; }
    }
    const contig = s0.keys.every((k, i) => k === s + ':' + (+s0.keys[0].split(':')[1] + i));
    // مصادر بلا ملفات آيات (MP3Quran): ملف السورة دائمًا
    let useFull = contig && (s0.kind === 'surah' || s0.keys.length > 1 || reciter(s0.rid).src === 'mp3quran');
    if (contig && !useFull) useFull = await DL.has(s0.rid, s);
    if (st !== s0) return;
    if (useFull) {
      try { return await playFull(s0, s); }
      catch (e) {
        if (st !== s0) return;
        if (navigator.onLine === false || reciter(s0.rid).src === 'mp3quran') { ev.error(e); stop(); return; }
        st.full = null;
      }
    }
    return playAt();
  }
  async function playFull(s0, s) {
    const sd = await surahData(s0.rid, s);
    if (st !== s0) return;
    const idx = sd.t ? new Map(sd.t.map((x, j) => [x[0], j])) : null;
    if (idx && !s0.keys.every(k => idx.has(k))) throw new Error('توقيت ناقص');
    const url = await DL.src(s0.rid, s, sd.url);
    if (st !== s0) return;
    s0.full = sd; s0.idx = idx; s0.lastK = null;
    s0.cur = { key: s0.keys[0], url: sd.url };
    el.src = url;
    // من أول السورة: نبدأ من بداية الملف (الاستعاذة والبسملة إن سبقت الآية الأولى)
    if (idx && s0.keys[0] !== s + ':1') seekTo(0); else { s0.want = 0; try { el.currentTime = 0; } catch (e) {} }
    try { await el.play(); }
    catch (e) {
      if (e && e.name === 'NotAllowedError') { ev.ayah(s0.keys[0], s0); s0.lastK = s0.keys[0]; ev.state('paused', s0); ev.blocked(s0); return; }
      throw e;
    }
    if (st !== s0) return;
    if (!idx) { s0.lastK = s0.keys[0]; ev.ayah(s0.keys[0], s0); } else tick();
    ev.state('playing', s0);
  }
  const T = (i) => st.full.t[st.idx.get(st.keys[i])];
  function seekTo(i) {
    const t = T(i)[1] / 1000; st.want = t;
    try { el.currentTime = t; } catch (e) {}
  }
  el.addEventListener('loadedmetadata', () => { if (st && st.full && st.want != null && Math.abs(el.currentTime - st.want) > 0.4) { try { el.currentTime = st.want; } catch (e) {} } });
  function tick() {
    if (!st || !st.full || !st.full.t) return;
    const t = el.currentTime * 1000;
    if (st.want != null) { if (Math.abs(t / 1000 - st.want) < 0.6) st.want = null; else return; }
    let c = T(st.i);
    // قفزة (تقديم من شاشة القفل مثلًا): نحدد الآية من الوقت
    if (t < c[1] - 800 || t > c[2] + 1500) {
      const j = st.keys.findIndex((k, i) => { const x = T(i); return t >= x[1] && t < x[2]; });
      if (j < 0) { if (t > T(st.keys.length - 1)[2]) { st.i = st.keys.length - 1; return boundary(); } }
      else { st.i = j; st.ayRep = 0; c = T(j); }
    }
    if (st.lastK !== st.keys[st.i]) { st.lastK = st.keys[st.i]; st.cur = { key: st.lastK, url: st.full.url }; ev.ayah(st.lastK, st); }
    const lastOfFile = st.idx.get(st.keys[st.i]) === st.full.t.length - 1;
    if (!lastOfFile && t >= c[2] - 25) return boundary();
    clearTimeout(st.bt);
    if (!lastOfFile && !el.paused && c[2] - t < 700) st.bt = setTimeout(tick, Math.max(0, (c[2] - t) / (el.playbackRate || 1)));
  }
  function boundary() {
    if (!st || !st.full) return;
    if (!st.full.t) { if (st.onEnd) { const s1 = st; return s1.onEnd(s1); } return stop(); }
    if (st.mode === 'ayah' && (st.count === 0 || st.ayRep + 1 < st.count)) { st.ayRep++; st.lastK = null; seekTo(st.i); return; }
    st.ayRep = 0;
    if (st.i + 1 < st.keys.length) {
      st.i++;
      if (Math.abs(T(st.i)[1] - el.currentTime * 1000) > 1500) seekTo(st.i);
      return tick();
    }
    if (st.mode === 'range' && (st.count === 0 || st.rep + 1 < st.count)) { st.rep++; st.i = 0; st.lastK = null; seekTo(0); return; }
    if (st.onEnd) { const s1 = st; return s1.onEnd(s1); }
    stop();
  }
  el.addEventListener('timeupdate', tick);
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
  function next() {
    if (!(st && st.i + 1 < st.keys.length) || st.notime) return;
    st.i++; st.ayRep = 0;
    if (st.full) { st.lastK = null; seekTo(st.i); clearTimeout(st.bt); ev.ayah(st.keys[st.i], st); st.lastK = st.keys[st.i]; return; }
    return playAt();
  }
  function prev() {
    if (!st) return;
    if (st.notime) { el.currentTime = 0; return; }
    if (st.full) {
      if (el.currentTime * 1000 - T(st.i)[1] > 3000 || st.i === 0) { seekTo(st.i); return; }
      st.i--; st.ayRep = 0; seekTo(st.i); clearTimeout(st.bt); ev.ayah(st.keys[st.i], st); st.lastK = st.keys[st.i]; return;
    }
    if (el.currentTime > 3 || st.i === 0) { el.currentTime = 0; return; } st.i--; st.ayRep = 0; return playAt();
  }
  /* يُستدعى تزامنيًا داخل لمسة المستخدم قبل أي انتظار (جلب الروابط): iOS يسمح بعدها لهذا العنصر بالتشغيل */
  function prime() {
    if (st && !el.paused) return;
    try { if (!st) el.src = SILENT; const pr = el.play(); unlocked = true; if (pr) pr.then(() => { if (!st || el.src === SILENT) el.pause(); }).catch(() => {}); } catch (e) {}
  }
  function pause() { if (st) { el.pause(); ev.state('paused', st); } }
  function resume() { if (st) { const pr = el.play(); if (pr) pr.catch(() => {}); ev.state('playing', st); } }
  function stop(silent) { if (st) clearTimeout(st.bt); el.pause(); el.removeAttribute('src'); const had = st; st = null; if (had && !silent) ev.state('stopped', had); }
  function state() { return st; }
  const reciter = id => RECITERS.find(r => r.id === id) || RECITERS[0];
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', resume);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('stop', () => stop());
    try { navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', () => prev()); } catch (e) {}
  }
  return { RECITERS, reciter, urlFor, verify, verifySurah, surahData, dl: DL, unlock, prime, isUnlocked: () => unlocked, play, pause, resume, stop, next, prev, state, on, el };
})();
