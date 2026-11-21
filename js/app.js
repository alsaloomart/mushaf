/* طبقة الواجهة — UI layer
 * الصفحة: نص صفحة مصحف المدينة النبوية الرسمي (مجمع الملك فهد، 1441هـ) كما هو، معروض بملء الشاشة.
 * التحديد والتظليل طبقة شفافة فوق الصفحة فقط. */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const N = QD.TOTAL_PAGES;
  const ar = n => String(n); // أرقام غربية في الواجهة
  let cur = 0, chapters = [], keyPage = new Map(), pageData = new Map();
  let sel = null; // {a,b,keys:Set,list:[]}
  let rangeMode = false, playingKey = null, todayKeys = new Set();

  /* ---------- العدد والمعدود (دالة واحدة لكل الواجهة) ---------- */
  const NOUN = {
    aya:  { one: 'آية واحدة', two: ['آيتان', 'آيتين'], pl: 'آيات', acc: 'آية', sg: 'آية' },
    page: { one: 'صفحة واحدة', two: ['صفحتان', 'صفحتين'], pl: 'صفحات', acc: 'صفحة', sg: 'صفحة' },
    line: { one: 'سطر واحد', two: ['سطران', 'سطرين'], pl: 'أسطر', acc: 'سطرًا', sg: 'سطر' },
    day:  { one: 'يوم واحد', two: ['يومان', 'يومين'], pl: 'أيام', acc: 'يومًا', sg: 'يوم' },
    note: { one: 'ملاحظة واحدة', two: ['ملاحظتان', 'ملاحظتين'], pl: 'ملاحظات', acc: 'ملاحظة', sg: 'ملاحظة' }
  };
  /* cnt(5)='5 آيات'، cnt(2)='آيتان'، cnt(2,'aya',true)='آيتين' (بعد حرف جر أو مفعول)، cnt(15)='15 آية'، cnt(100)='100 آية' */
  function cnt(n, w = 'aya', gen = false) {
    const f = NOUN[w]; n = +n;
    if (n === 1) return f.one;
    if (n === 2) return f.two[gen ? 1 : 0];
    const r = n % 100;
    if (r >= 3 && r <= 10) return ar(n) + ' ' + f.pl;
    if (r >= 11 && r <= 99) return ar(n) + ' ' + f.acc;
    return ar(n) + ' ' + f.sg;   // 100، 200، 101، 102…
  }
  // الفواصل الفعلية للمراجعة [1،2،4،7،15،30،60] بعد «بعد»
  const AFTER = { 1: 'يوم', 2: 'يومين', 4: '4 أيام', 7: 'أسبوع', 15: '15 يومًا', 30: 'شهر', 60: 'شهرين' };
  const after = d => AFTER[d] || cnt(d, 'day', true);

  /* ---------- أدوات ---------- */
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TM = { on: false, p: 0, keys: [], i: 0, rv: new Map(), rec: null, listening: false, heard: [], cut: 0, heardTxt: '', restarts: [], wd: 0, E: [], prog: 0, why: '' };
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
  const sName = s => chapters[s - 1] ? chapters[s - 1].name_arabic : ('سورة ' + s);
  function keyLabel(k) { const [s, a] = k.split(':'); return sName(+s) + ' ' + ar(a); }
  function rangeLabel(a, b) {
    if (a === b) return keyLabel(a);
    const [s1, a1] = a.split(':'), [s2, a2] = b.split(':');
    return s1 === s2 ? `${sName(+s1)} ${a1} – ${a2}` : `${keyLabel(a)} – ${keyLabel(b)}`;
  }
  const cmpKey = (x, y) => { const [a, b] = x.split(':').map(Number), [c, d] = y.split(':').map(Number); return a - c || b - d; };
  async function keysBetween(a, b, max = 700) {
    if (cmpKey(a, b) > 0) [a, b] = [b, a];
    const out = [a]; let k = a;
    while (k !== b && out.length < max) { k = await QD.nextKey(k); if (!k) break; out.push(k); }
    return out;
  }
  async function pageOfKey(k) { return keyPage.get(k) || QD.pageOf(k); }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /* عنوان الصفحة: أسماء السور كلها إن اتسعت، وإلا الأولى — الأخيرة */
  function surahsTitle(ss, max = 26) {
    const names = ss.map(sName), all = names.join(' · ');
    return (names.length > 2 && all.length > max) ? names[0] + ' — ' + names[names.length - 1] : all;
  }

  /* ---------- نافذة تأكيد داخل التطبيق ---------- */
  function ask(msg, yes = 'نعم') {
    return new Promise(res => {
      $('#cfMsg').textContent = msg; $('#cfYes').textContent = yes;
      const prev = $$('.sheet').find(s => !s.hidden && s.id !== 'sh-confirm');
      $('#sh-confirm').hidden = false; $('#scrim').hidden = false; $('#scrim').classList.add('top');
      const done = v => { $('#sh-confirm').hidden = true; $('#scrim').classList.remove('top'); if (!prev) $('#scrim').hidden = true; res(v); };
      $('#cfYes').onclick = () => done(true); $('#cfNo').onclick = () => done(false);
    });
  }

  /* ---------- الكتاب: الصفحات + التقليب ---------- */
  const book = $('#book'), fold = $('#fold');
  const leaves = new Map();
  let PW = 300, busy = false;
  const viewFull = () => document.documentElement.classList.contains('vfull');
  function layout() {
    const R = book.getBoundingClientRect(); PW = R.width || innerWidth;
  }
  function reserve() {   // شريط الآية والمشغل لا يغطيان الصفحة: نصغّر مساحة الصفحة
    const t = $('#tool'), pl = $('#player');
    const h = Math.max(t.hidden ? 0 : t.offsetHeight + 16, pl.hidden ? 0 : pl.offsetHeight + 16);
    document.documentElement.style.setProperty('--reserve', h + 'px');
    requestAnimationFrame(layout);
  }
  const NS = 'http://www.w3.org/2000/svg';
  /* المسافة بين الأسطر: الأسطر الـ15 كما هي من صفحة المجمع (نفس الكلمات في كل سطر)،
     تُوزَّع رأسيًا لتملأ طول الشاشة كما في المصحف المطبوع، والعرض يملأ الشاشة. */
  let LS = null;
  function measureLS(el) {
    const pg = el.querySelector('.pg'), ph = pg && pg.querySelector('.ph'), pf = pg && pg.querySelector('.pf');
    if (!ph) return null;
    const cs = getComputedStyle(pg), rd = $('#reader');
    const H = rd.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (ph.offsetHeight || 26) - (pf.offsetHeight || 40);
    const W = rd.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { H, W };
  }
  function lineOf(m, y) { let i = 0; while (i < m.length && m[i] < y) i++; return i; }
  function shiftPath(d, m, s) {
    return d.split('Z').filter(t => t.trim()).map(sub => {
      const n = sub.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const ys = n.filter((_, i) => i % 2);
      const mn = Math.min(...ys), mx = Math.max(...ys), one = mx - mn < 40;
      const lc = lineOf(m, (mn + mx) / 2), out = [];
      for (let j = 0; j < n.length; j += 2) {
        const Y = n[j + 1], top = Math.abs(Y - mn) < 0.01, bot = Math.abs(Y - mx) < 0.01;
        const li = one ? lc : lineOf(m, top ? Y + 13 : bot ? Y - 13 : Y);
        let ny = Y + li * s;
        if (top && li > 0) ny -= s / 2;
        if (bot && li < 14) ny += s / 2;
        out.push(n[j].toFixed(2) + ',' + ny.toFixed(2));
      }
      return 'M' + out.join(' ') + 'Z';
    }).join(' ');
  }
  function fitLeaf(el, p, pd) {
    const L = pd.lines;
    if (viewFull() || !L) return;
    if (LS == null) { const m = measureLS(el); if (!m || m.W <= 0) return; const [, , w, h] = pd.crop; LS = Math.max(0, Math.min(14, (m.H / m.W * w - h) / 14)); }
    const s = LS, [x, y, w, h] = pd.crop, svg = el.querySelector('svg.tx');
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h + 14 * s}`);
    el.querySelectorAll('g.st').forEach((g, i) => g.setAttribute('transform', `translate(0 ${(i * (s - L.D)).toFixed(3)})`));
    const byK = new Map(pd.ayat.map(a => [a.k, a.d]));
    el.querySelectorAll('g.hot path').forEach(pa => pa.setAttribute('d', shiftPath(byK.get(pa.dataset.k), L.m, s)));
  }
  function refit() { LS = null; for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd && el.style.display !== 'none') fitLeaf(el, p, pd); } for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd) fitLeaf(el, p, pd); } }
  function leafHTML(p, pd) {
    const full = viewFull();
    const vb = full ? [0, 0, pd.w, pd.h] : pd.crop;
    const img = full ? pd.img : pd.timg;
    const clip = (!full && p <= 2) ? `<clipPath id="cc${p}"><circle cx="${p === 1 ? 190.52 : 191.83}" cy="272.95" r="87.4"/></clipPath>` : '';
    const L = !full && pd.lines;
    let body;
    if (L) {
      const [x, y, w] = vb; let defs = '', st = '';
      for (let i = 0; i < 15; i++) {
        const t = i ? L.c[i - 1] : y - 80, b = i < 14 ? L.c[i] : y + L.Hs + 80;
        defs += `<clipPath id="k${p}_${i}"><rect x="${x - 5}" y="${t}" width="${w + 10}" height="${(b - t).toFixed(3)}"/></clipPath>`;
        st += `<g class="st" transform="translate(0 ${-i * L.D})"><image href="${img}" x="${x}" y="${y}" width="${w}" height="${L.Hs}" class="pimg" preserveAspectRatio="none" clip-path="url(#k${p}_${i})"/></g>`;
      }
      body = `<defs>${defs}</defs>${st}`;
    } else {
      body = `${clip}<image href="${img}" x="${full ? 0 : vb[0]}" y="${full ? 0 : vb[1]}" width="${full ? pd.w : vb[2]}" height="${full ? pd.h : vb[3]}" class="pimg" preserveAspectRatio="none"/>`;
    }
    const ss = pd.surahs;
    return `<div class="pg">
      <div class="ph"><span class="pj">الجزء ${ar(pd.juz)}</span><button class="pnote" hidden aria-label="ملاحظات هذه الصفحة"></button><span class="ps">${esc(surahsTitle(ss, 14))}</span></div>
      <svg class="tx" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${body}
        <g class="hot"${clip ? ` clip-path="url(#cc${p})"` : ''}>${pd.ayat.map(a => `<path data-k="${a.k}" d="${a.d}"/>`).join('')}</g>
      </svg>
      <div class="pf"><span class="pn">${ar(p)}</span><button class="nadd" aria-label="ملاحظة جديدة على هذه الصفحة"><svg viewBox="0 0 24 24"><path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 013 3L9 18z"/><path d="M14 7l3 3"/></svg></button></div>
      <div class="nmk"></div>
    </div><div class="shade"></div>`;
  }
  function leaf(p) {
    if (leaves.has(p)) return leaves.get(p);
    const el = document.createElement('div');
    el.className = 'leaf'; el.dataset.p = p; el.style.display = 'none';
    el.innerHTML = '<div class="pg"></div><div class="shade"></div>';
    book.insertBefore(el, fold);
    leaves.set(p, el);
    QD.page(p).then(pd => {
      pageData.set(p, pd); pd.ayat.forEach(a => keyPage.set(a.k, p));
      el.innerHTML = leafHTML(p, pd);
      fitLeaf(el, p, pd);
      paint(el);
      if (p === cur) requestAnimationFrame(() => notesPaint(p));
    });
    return el;
  }
  function rebuildLeaves() { for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd) { el.innerHTML = leafHTML(p, pd); fitLeaf(el, p, pd); paint(el); } } }
  function gc() { for (const [p, el] of leaves) if (Math.abs(p - cur) > 3) { el.remove(); leaves.delete(p); } }
  function prefetch(p) { [p + 1, p - 1, p + 2].forEach(q => { if (q >= 1 && q <= N) { const i = new Image(); i.src = viewFull() ? QD.pageImg(q) : `lines/${String(q).padStart(3, '0')}.webp`; leaf(q); } }); }
  function showOnly(p) {
    for (const [q, el] of leaves) {
      el.style.display = q === p ? '' : 'none';
      el.style.transform = ''; el.style.zIndex = q === p ? 2 : 0; el.classList.remove('turning', 'back');
      const sh = el.querySelector('.shade'); if (sh) sh.style.cssText = '';
    }
    fold.style.opacity = 0;
  }
  /* زاوية التقليب: الكعب على اليمين (مصحف عربي). 0 = مفرودة، 180 = انقلبت لليمين */
  function setAngle(el, th) {
    el.style.transform = `rotateY(${th}deg)`;
    const back = th > 90;
    el.classList.toggle('back', back);
    const sh = el.querySelector('.shade'); if (!sh) return;
    const k = Math.sin(th * Math.PI / 180);
    sh.style.background = back
      ? `linear-gradient(to left, rgba(0,0,0,${0.18 * k}), rgba(0,0,0,0) 60%), var(--leafback)`
      : `linear-gradient(to left, rgba(0,0,0,${0.22 * k}), rgba(255,255,255,${0.10 * k}) 40%, rgba(0,0,0,${0.12 * k}))`;
    sh.style.opacity = 1;
    const x = PW - PW * Math.cos(th * Math.PI / 180);
    fold.style.opacity = th > 2 && th < 178 ? (0.55 * k).toFixed(3) : 0;
    fold.style.left = (Math.min(x, PW) - 46) + 'px';
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  function animate(el, from, to, ms) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => { const t = Math.min(1, (now - t0) / ms); setAngle(el, from + (to - from) * ease(t)); if (t < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }
  function prepFlip(dir) {
    const target = cur + dir;
    if (target < 1 || target > N) return null;
    const a = leaf(cur), b = leaf(target);
    if (dir > 0) {
      b.style.display = ''; b.style.zIndex = 1; b.style.transform = '';
      a.style.display = ''; a.style.zIndex = 3; a.classList.add('turning');
      return { el: a, start: 0, end: 180, target };
    } else {
      a.style.display = ''; a.style.zIndex = 1;
      b.style.display = ''; b.style.zIndex = 3; b.classList.add('turning'); setAngle(b, 180);
      return { el: b, start: 180, end: 0, target };
    }
  }
  async function finishFlip(f, fromAngle, complete, user) {
    const remain = Math.abs((complete ? f.end : f.start) - fromAngle) / 180;
    await animate(f.el, fromAngle, complete ? f.end : f.start, 120 + 520 * remain);
    if (complete) setCurrent(f.target, user);
    showOnly(cur);
    busy = false;
  }
  async function flip(dir, user = true) {
    if (busy) return;
    const f = prepFlip(dir); if (!f) return;
    busy = true;
    await finishFlip(f, f.start, true, user);
  }
  function goPage(p, anim = false, user = false) {
    p = Math.max(1, Math.min(N, p | 0));
    if (anim && Math.abs(p - cur) === 1 && cur) return flip(p - cur, user);
    leaf(p); setCurrent(p, user); showOnly(p); requestAnimationFrame(() => notesPaint(p));
  }
  function setCurrent(p, user) {
    const changed = p !== cur;
    if (changed) noteClose();
    cur = p; ST.setLastPage(p); leaf(p); gc(); prefetch(p); updateTitle(); $('#qjR').value = p;
    if (changed) requestAnimationFrame(() => notesPaint(p));
    if (changed && TM.on) tmLoad(p);
  }
  async function updateTitle() {
    const p = cur;
    try {
      const pd = await QD.page(p); if (p !== cur) return;
      $('#tSurah').textContent = surahsTitle(pd.surahs);
      $('#tSub').textContent = `صفحة ${ar(p)} · الجزء ${ar(pd.juz)}`;
    } catch (e) { $('#tSub').textContent = 'صفحة ' + ar(p); }
  }
  function paint(root = book) {
    root.querySelectorAll('.hot path').forEach(s => {
      const k = s.dataset.k;
      s.classList.toggle('sel', !!(sel && sel.keys.has(k)));
      s.classList.toggle('play', k === playingKey);
      s.classList.toggle('td', todayKeys.has(k));
    });
  }

  /* سحب: من اليسار لليمين = الصفحة التالية (مثل المصحف الورقي)، والعكس = السابقة */
  let drag = null, suppressClick = false;
  book.addEventListener('pointerdown', e => {
    if (busy || e.button > 0) return;
    drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), f: null, id: e.pointerId, th: 0 };
  });
  book.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.f) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
      const f = prepFlip(dx > 0 ? 1 : -1);
      if (!f) { drag = null; return; }
      busy = true; drag.f = f; drag.dir = dx > 0 ? 1 : -1;
      try { book.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const prog = Math.max(0, Math.min(1, (drag.dir * dx) / (PW * 0.95)));
    drag.th = drag.dir > 0 ? prog * 180 : 180 - prog * 180;
    setAngle(drag.f.el, drag.th);
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.f) return;
    suppressClick = true; setTimeout(() => suppressClick = false, 60);
    const dx = (e ? e.clientX : d.x0) - d.x0, dt = performance.now() - d.t0;
    const prog = Math.abs(dx) / (PW * 0.95), vel = Math.abs(dx) / Math.max(1, dt);
    const complete = e && e.type !== 'pointercancel' && (prog > 0.33 || vel > 0.45);
    if (!TM.on) AU.unlock();
    finishFlip(d.f, d.th, complete, true);
  }
  book.addEventListener('pointerup', endDrag);
  book.addEventListener('pointercancel', endDrag);
  addEventListener('resize', () => { layout(); refit(); notesPaint(cur); });

  /* ---------- الأدوات تظهر باللمس ---------- */
  let chromeT = 0;
  function chrome(show) {
    document.body.classList.toggle('chrome', show);
    clearTimeout(chromeT);
  }

  /* ---------- التحديد ---------- */
  async function select(a, b = a) {
    if (cmpKey(a, b) > 0) [a, b] = [b, a];
    const list = await keysBetween(a, b);
    sel = { a, b: list[list.length - 1], list, keys: new Set(list) };
    $('#selLbl').textContent = rangeLabel(sel.a, sel.b) + (list.length > 1 ? ` (${cnt(list.length)})` : '');
    $('#tool').hidden = false;
    const allMem = list.every(ST.isMem);
    $('#aMem').classList.toggle('done', allMem);
    $('#aMem span').textContent = allMem ? 'محفوظة' : 'حفظ';
    paint(); reserve();
  }
  function clearSel() { sel = null; rangeMode = false; $('#btnRange').classList.remove('on'); $('#rangeHint').hidden = true; $('#tool').hidden = true; paint(); reserve(); }
  book.addEventListener('click', e => {
    const na = e.target.closest('.nadd'), nm = e.target.closest('.nmk button'), np = e.target.closest('.pnote');
    if (np) { e.stopPropagation(); if (suppressClick || busy) return; const ns = notesAll().filter(n => n.p === cur); if (ns.length === 1) noteOpen(ns[0].id); else openNotes(cur); return; }
    if (na || nm) { e.stopPropagation(); if (suppressClick || busy) return; na ? noteNew() : noteOpen(nm.dataset.id); return; }
    if (suppressClick || busy) return;
    if (!TM.on) AU.unlock();
    const s = e.target.closest('path[data-k]');
    if (!s) { if (sel && !rangeMode) clearSel(); return; }   // الصفحة نظيفة: لا أشرطة تظهر باللمس
    const k = s.dataset.k;
    if (TM.on) { if (!TM.rv.has(k)) tmReveal(k, 'tap'); return; }
    if (rangeMode && sel) { rangeMode = false; $('#btnRange').classList.remove('on'); $('#rangeHint').hidden = true; select(sel.a, k); return; }
    if (sel && sel.list.length === 1 && sel.a === k) { clearSel(); return; }
    select(k);
  });
  $('#btnSelClose').onclick = clearSel;
  $('#btnRange').onclick = () => { rangeMode = !rangeMode; $('#btnRange').classList.toggle('on', rangeMode); $('#rangeHint').hidden = !rangeMode; reserve(); };

  /* ---------- الصوت ---------- */
  function startPlay(count = 1, mode = 'range') {
    if (!sel) return;
    AU.play(sel.list.slice(), ST.get().reciter, count, mode, { kind: 'sel' });
  }
  // لا تشغيل تلقائي: التلاوة تبدأ فقط عندما يضغط على آية ويختار «استماع» أو «تكرار».
  AU.on('blocked', () => toast('تعذّر تشغيل هذه الآية.'));
  $('#aListen').onclick = () => startPlay(1, 'range');
  AU.on('ayah', async (k, st) => {
    playingKey = k; paint();
    const r = AU.reciter(st.rid);
    const tot = st.count === 0 ? 'بدون حد' : ar(st.count);
    $('#player').hidden = false;
    $('#pNow').textContent = keyLabel(k) + ' · ' + r.name;
    $('#pRep').textContent = st.mode === 'ayah' ? `تكرار الآية ${ar(st.ayRep + 1)}/${tot}` : (st.count !== 1 ? `التكرار ${ar(st.rep + 1)}/${tot}` : 'تلاوة');
    reserve();
    const p = await pageOfKey(k);
    if (p !== cur && !busy) goPage(p, true, false);
  });
  AU.on('state', (s) => {
    document.body.classList.toggle('playing', s !== 'stopped');
    if (s === 'stopped') { playingKey = null; $('#player').hidden = true; paint(); }
    const paused = s === 'paused';
    $('#pToggle').setAttribute('aria-label', paused ? 'تشغيل' : 'إيقاف مؤقت');
    $('#pToggle').innerHTML = paused ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
    reserve();
  });
  AU.on('error', e => toast(e && e.message && /^[\u0600-\u06FF]/.test(e.message) ? e.message : 'تعذّر تشغيل هذه الآية.'));
  $('#pToggle').onclick = () => { const st = AU.state(); if (!st) return; AU.el.paused ? AU.resume() : AU.pause(); };
  $('#pStop').onclick = () => AU.stop();


  /* ---------- القائمة (التبويبة الوحيدة أعلى الصفحة) ---------- */
  const IC = {
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    index: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    review: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5"/>',
    repeat: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    book: '<path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    note: '<path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 013 3L9 18z"/><path d="M14 7l3 3"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    range: '<path d="M4 7h16M4 12h10M4 17h16"/><path d="M17 10l3 2-3 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20a2 2 0 004 0"/>'
  };
  const hi = (k, id, t, sub, extra = '') => `<button class="li hub" data-h="${id}"><span class="n"><svg viewBox="0 0 24 24">${IC[k]}</svg></span><span class="m"><b>${t}</b><small>${sub}</small></span>${extra}</button>`;
  /* لوحة قائمة عامة (وردي، التلاوة، التفسير، الإعدادات) داخل #sh-hub */
  function openList(title, html, nav) {
    $('#sh-hub .sh-h b').textContent = title; $('#hubBody').innerHTML = html; openSheet('hub'); navOn(nav);
  }
  async function openWirdPanel() {
    await refreshToday().catch(() => null);
    const today = $('#today'), n = ST.due().length;
    openList('وردي',
      (today.hidden ? '' : `<div class="card hubToday">${today.innerHTML}</div>`) +
      hi('plan', 'plan', 'الخطة وورد اليوم', ST.get().plan ? 'ورد اليوم وتقدّمك' : 'أنشئ خطة حفظ') +
      hi('review', 'review', 'المراجعة', n ? `اليوم: ${cnt(n)} للمراجعة` : 'ليست لديك مراجعة مستحقة اليوم.') +
      hi('mic', 'tasmee', 'التسميع', 'تُخفى آيات الصفحة وتنكشف كل آية عند تلاوتها'), 'wird');
  }
  const openHub = openWirdPanel;
  function openTilawa() {
    openList('التلاوة',
      `<p class="muted sm">${sel ? 'الآية المحددة: ' + esc(rangeLabel(sel.a, sel.b)) : 'تبدأ من أول آية في هذه الصفحة، أو اضغط على آية في الصفحة أولًا.'}</p>` +
      hi('play', 'listen', 'استماع', 'تلاوة الآية أو المقطع المحدد مرة واحدة') +
      hi('repeat', 'repeat', 'التكرار', 'كرّر الآية أو المقطع بعدد تختاره') +
      hi('range', 'range', 'تحديد مقطع', 'اختر أول آية ثم آخر آية'), 'tilawa');
  }
  function openTafsirPanel() { return openTafsir(sel ? sel.list.slice() : null); }
  const PAPERS = [['beige', 'بيج', '#FFFBF7'], ['blue', 'أزرق', '#F2F9FE'], ['white', 'أبيض', '#FFFFFF'], ['cream', 'كريمي', '#FBF3E2'], ['grey', 'رمادي فاتح', '#D9D6D2'], ['night', 'ليلي', '#0E0E0E']];
  function openSettings() {
    const s = ST.get(), dark = document.documentElement.classList.contains('dark'), cur = dark ? 'night' : (s.paper || 'beige'), rid = s.reciter;
    openList('الإعدادات',
      `<div class="sw-row" id="sNightRow" role="presentation"><b>الوضع الليلي</b><button class="switch" id="sNight" role="switch" aria-checked="${dark}" aria-label="الوضع الليلي"></button></div>
       <label class="lbl">لون الصفحة</label>
       <div class="swatches" id="sPaper">${PAPERS.map(([k, n, c]) => `<button data-paper="${k}" class="${k === cur ? 'on' : ''}" aria-label="${n}"><i style="background:${c}"></i>${n}</button>`).join('')}</div>
       <p class="muted sm">لون الخلفية للعرض فقط؛ نص المصحف كما هو.</p>
       <label class="lbl">القارئ</label>` +
      AU.RECITERS.map(r => `<button class="li" data-r="${r.id}"><span class="n">${r.id === rid ? CK : ''}</span><span class="m"><b>${r.name}</b><small>${r.style} · تلاوة آية آية</small></span></button>`).join('') +
      `<label class="lbl">عرض الصفحة</label><div class="seg" id="mView">${[['screen', 'ملء الشاشة'], ['full', 'الصفحة بإطارها']].map(([v, n]) => `<button data-v="${v}" class="${(s.view === 'full' ? 'full' : 'screen') === v ? 'on' : ''}">${n}</button>`).join('')}</div>
       <label class="lbl">التذكير</label>` + hi('bell', 'rem', 'تذكير الورد', remSub()) + (window.CLOUD ? `<label class="lbl">الحساب والمزامنة</label><div id="clBox">${CLOUD.html()}</div>` : ''), 'settings');
    if (window.CLOUD) CLOUD.prep();
  }
  /* ---------- الأشرطة ---------- */
  function navOn(k) { $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (k || 'mushaf'))); }
  $$('[data-nav]').forEach(b => b.onclick = () => {
    AU.unlock(); noteClose();
    const k = b.dataset.nav;
    if (k === 'mushaf') { closeSheets(); return; }
    if (k === 'index') { $('#btnIndex').click(); navOn('index'); }
    if (k === 'wird') openWirdPanel();
    if (k === 'notes') { openNotes(); navOn('notes'); }
    if (k === 'settings') openSettings();
    if (k === 'search') { $('#btnGo').click(); navOn('search'); }
    if (k === 'tilawa') openTilawa();
    if (k === 'tafsir') openTafsirPanel();
    if (k === 'more') { openMore(); navOn('more'); }
  });
  /* خط الانتقال السريع: الصفحة 1 يمينًا */
  const qjR = $('#qjR'), qjB = $('#qjB');
  function surahAtPage(p) { let n = ''; for (const c of chapters) { const s0 = c.pages && c.pages[0]; if (s0 && s0 <= p) n = c.name_arabic; } return n; }
  function qjBubble() {
    const p = +qjR.value, r = qjR.getBoundingClientRect(), f = (p - 1) / (N - 1);
    const x = r.right - 7 - f * (r.width - 14);
    qjB.innerHTML = `${esc(surahAtPage(p))}<small>صفحة ${ar(p)}</small>`; qjB.hidden = false;
    const w = qjB.offsetWidth / 2; qjB.style.left = Math.max(w + 6, Math.min(innerWidth - w - 6, x)) + 'px';
  }
  qjR.addEventListener('input', qjBubble);
  qjR.addEventListener('pointerdown', () => setTimeout(qjBubble, 0));
  qjR.addEventListener('change', () => { setTimeout(() => { qjB.hidden = true; }, 500); const p = +qjR.value; if (p !== cur) { closeSheets(); goPage(p); } });
  async function selectFirst() { const pd = await QD.page(cur); await select(pd.ayat[0].k); }
  $('#hubBody').onclick = async e => {
    const sn = e.target.closest('#sNightRow'); if (sn) { setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'); openSettings(); return; }
    const sp = e.target.closest('#sPaper [data-paper]');
    if (sp) { const k = sp.dataset.paper; if (k === 'night') setTheme('dark'); else { ST.set('paper', k); setTheme('light'); } openSettings(); return; }
    const rr = e.target.closest('[data-r]'); if (rr) { ST.setReciter(+rr.dataset.r); openSettings(); return; }
    const vw = e.target.closest('#mView [data-v]'); if (vw) { ST.set('view', vw.dataset.v); applyTheme(); rebuildLeaves(); openSettings(); return; }
    const tb = e.target.closest('.hubToday [data-act]');
    if (tb) { closeSheets(); $('#today').querySelector(`[data-act="${tb.dataset.act}"]`).click(); return; }
    const b = e.target.closest('[data-h]'); if (!b) return;
    const h = b.dataset.h;
    if (h === 'go') $('#btnGo').click();
    if (h === 'index') $('#btnIndex').click();
    if (h === 'plan') openPlan(false);
    if (h === 'review') openReview();
    if (h === 'repeat') { if (!sel) await selectFirst(); openRepeat(); }
    if (h === 'tasmee') tmStart();
    if (h === 'theme') { $('#btnTheme').click(); openSettings(); }
    if (h === 'listen') { if (!sel) await selectFirst(); closeSheets(); $('#aListen').click(); }
    if (h === 'range') { closeSheets(); if (!sel) await selectFirst(); $('#btnRange').click(); }
    if (h === 'more') openMore();
    if (h === 'rem') openRem();
    if (h === 'notes') openNotes();
  };

  /* ---------- ملاحظات الحفظ: تظهر على الصفحة نفسها التي كُتبت فيها ----------
   * محفوظة على الجهاز فقط (localStorage: mushaf.notes). */
  const NK = 'mushaf.notes';
  const notesAll = () => { try { return JSON.parse(localStorage.getItem(NK) || '[]'); } catch (e) { return []; } };
  const notesSave = a => localStorage.setItem(NK, JSON.stringify(a));
  const dLabel = t => new Date(t).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
  let noteCur = null, noteT = 0;
  function notesPaint(p) {
    const el = leaves.get(p); if (!el) return;
    const box = el.querySelector('.nmk'), pg = el.querySelector('.pg'), svg = el.querySelector('svg.tx'); if (!box || !svg) return;
    const ns = notesAll().filter(n => n.p === p), pn = el.querySelector('.pnote');
    if (pn) { pn.hidden = !ns.length; pn.innerHTML = ns.length ? `<svg viewBox="0 0 24 24"><path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 013 3L9 18z"/><path d="M14 7l3 3"/></svg><span>${ns.length === 1 ? 'ملاحظة' : ar(ns.length) + ' ' + (ns.length === 2 ? 'ملاحظتان' : ns.length <= 10 ? 'ملاحظات' : 'ملاحظة')}</span>` : ''; }
    if (!ns.length) { box.innerHTML = ''; return; }
    const pr = pg.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    const used = []; let free = 0;
    box.innerHTML = ns.sort((a, b) => a.t - b.t).map(n => {
      let y = null;
      if (n.k) { const pa = el.querySelector(`g.hot path[data-k="${n.k}"]`); if (pa) { const r = pa.getBoundingClientRect(); if (r.height) y = r.top - pr.top + 2; } }
      if (y == null) y = sr.top - pr.top + 4 + 26 * free++;
      while (used.some(u => Math.abs(u - y) < 24)) y += 24;
      used.push(y);
      return `<button data-id="${n.id}" style="top:${Math.round(y - 2)}px" aria-label="ملاحظة${n.k ? ' على ' + esc(keyLabel(n.k)) : ''}"></button>`;
    }).join('');
  }
  function noteMeta(n) { return `<bdi>صفحة ${ar(n.p)}</bdi>${n.k ? ' · <bdi>' + esc(n.kb && n.kb !== n.k ? rangeLabel(n.k, n.kb) : keyLabel(n.k)) + '</bdi>' : ''} · <bdi>${dLabel(n.u || n.t)}</bdi>`; }
  function noteNew() {
    const n = { id: 'n' + Date.now().toString(36), p: cur, k: sel ? sel.a : null, kb: sel ? sel.b : null, text: '', t: Date.now() };
    if (sel) clearSel();
    noteShow(n, true);
  }
  function noteOpen(id) { const n = notesAll().find(x => x.id === id); if (n) noteShow(n, false); }
  function noteShow(n, fresh) {
    noteCur = n;
    const c = $('#noteCard');
    c.innerHTML = `<div class="nh"><small>${noteMeta(n)}</small><button class="x" data-nclose aria-label="إغلاق">×</button></div>
      <textarea id="noteTx" rows="5" placeholder="اكتب ملاحظتك على هذه الصفحة…">${esc(n.text)}</textarea>
      <div class="nf"><small id="noteSt">${fresh ? '' : 'محفوظة'}</small>${fresh ? '' : '<button class="btn" id="noteDel">حذف</button>'}<button class="btn gold" data-nclose>تم</button></div>
      <div class="ncf" hidden><b>حذف هذه الملاحظة؟</b><button class="btn danger" id="noteDelYes">حذف</button><button class="btn" id="noteDelNo">إلغاء</button></div>`;
    c.hidden = false;
    const tx = $('#noteTx');
    tx.oninput = () => { clearTimeout(noteT); $('#noteSt').textContent = ''; noteT = setTimeout(noteCommit, 400); };
    /* الحذف بتأكيد داخل البطاقة نفسها: على الآيفون تبقى لوحة المفاتيح مفتوحة وتغطي أي نافذة سفلية */
    const delNote = () => {
      clearTimeout(noteT);
      try { const dl = JSON.parse(localStorage.getItem('mushaf.notes.del') || '{}'); dl[n.id] = Date.now(); localStorage.setItem('mushaf.notes.del', JSON.stringify(dl)); } catch (e) {}
      notesSave(notesAll().filter(x => x.id !== n.id)); noteCur = null; c.hidden = true; c.innerHTML = '';
      notesPaint(n.p); toast('حُذفت الملاحظة.');
    };
    if ($('#noteDel')) $('#noteDel').onclick = () => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      $('#noteCard .nf').hidden = true; $('#noteCard .ncf').hidden = false;
    };
    const cy = c.querySelector('#noteDelYes'), cn = c.querySelector('#noteDelNo');
    if (cy) cy.onclick = delNote;
    if (cn) cn.onclick = () => { $('#noteCard .ncf').hidden = true; $('#noteCard .nf').hidden = false; };
    c.querySelectorAll('[data-nclose]').forEach(b => b.onclick = noteClose);
    if (fresh) setTimeout(() => tx.focus(), 50);
  }
  function noteCommit() {
    clearTimeout(noteT);
    const n = noteCur, tx = $('#noteTx'); if (!n || !tx) return;
    const text = tx.value.trim(), all = notesAll(), i = all.findIndex(x => x.id === n.id);
    if (!text) return;            // ملاحظة فارغة لا تُحفظ
    n.text = text; n.u = Date.now();
    if (i >= 0) all[i] = n; else all.push(n);
    notesSave(all); const st = $('#noteSt'); if (st) st.textContent = 'حُفظت';
    notesPaint(n.p);
  }
  function noteClose() {
    if (!noteCur) { $('#noteCard').hidden = true; return; }
    noteCommit(); noteCur = null; $('#noteCard').hidden = true;
  }
  function openNotes(page) {
    const all = notesAll().filter(n => !page || n.p === page).sort((a, b) => (b.u || b.t) - (a.u || a.t));
    $('#sh-notes .sh-h b').textContent = page ? `ملاحظات صفحة ${ar(page)}` : 'ملاحظاتي';
    $('#notesBody').innerHTML = all.length ? all.map(n => `<button class="li" data-id="${n.id}"><span class="m"><b>${esc(n.text.length > 90 ? n.text.slice(0, 90) + '…' : n.text)}</b><small>${noteMeta(n)}</small></span></button>`).join('')
      : '<p class="muted">لا توجد ملاحظات بعد. اضغط زر القلم أسفل الصفحة لتكتب ملاحظة عليها.</p>';
    openSheet('notes');
  }
  $('#notesBody').onclick = async e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const n = notesAll().find(x => x.id === b.dataset.id); if (!n) return;
    closeSheets(); goPage(n.p);
    setTimeout(() => { notesPaint(n.p); noteShow(n, false); }, 400);
  };

  /* ---------- تذكير الورد (Web Push) ----------
   * الآيفون لا يدعم الإشعارات المجدولة محليًا؛ الإشعار يصل فقط عبر Web Push من خادم إرسال
   * (iOS 16.4+ وبعد إضافة المصحف إلى الشاشة الرئيسية). الطلب يتم فقط بعد ضغطة صريحة. */
  const PUSH = {
    vapid: 'BHH6pOOOgzOLQII78tMpxjXE3AT2Icc_abNMuvFoIMqVJGtTQjHakjP5BtAmG1QGreRBJq3ARBqQcy7BHOBFenQ',
    live: false,       // يصبح true بعد تشغيل خادم الإرسال
    endpoint: ''       // عنوان حفظ الاشتراك والأوقات عند تفعيل الخادم
  };
  const REM_DEF = { on: false, times: ['06:00', '20:00'] };
  const rem = () => Object.assign({}, REM_DEF, ST.get().rem || {});
  const tLabel = t => { let [h, m] = t.split(':').map(Number); const pm = h >= 12; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${pm ? 'مساءً' : 'صباحًا'}`; };
  function remSub() { const r = rem(); return r.on ? `${tLabel(r.times[0])} و${tLabel(r.times[1])}` : 'غير مفعّل'; }
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function remSync() {
    const r = rem(); if (!PUSH.live || !PUSH.endpoint) return false;
    try { await fetch(PUSH.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: r.on, times: r.times, tz: 'Asia/Riyadh', sub: r.sub || null }) }); return true; } catch (e) { return false; }
  }
  function openRem() {
    const r = rem(), perm = 'Notification' in window ? Notification.permission : 'unsupported';
    let note = '';
    if (isIOS && !isStandalone()) note = 'لتصلك الإشعارات على الآيفون: افتح المصحف من الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، ثم فعّل التذكير من هنا.';
    else if (!pushOK()) note = 'هذا المتصفح لا يدعم الإشعارات.';
    else if (perm === 'denied') note = 'الإشعارات مرفوضة لهذا التطبيق. فعّلها من إعدادات الجهاز ← الإشعارات، ثم ارجع هنا.';
    $('#remBody').innerHTML = `
      <p class="muted sm">تذكير يومي بورد الحفظ. اضغط الإشعار ليفتح لك ورد اليوم.</p>
      <label class="lbl">التذكير الأول</label><input type="time" id="remT1" value="${r.times[0]}" step="300">
      <label class="lbl">التذكير الثاني</label><input type="time" id="remT2" value="${r.times[1]}" step="300">
      <p class="muted sm">بتوقيت الرياض.</p>
      ${note ? `<p class="muted sm warn" id="remNote">${note}</p>` : ''}
      ${r.on ? '<button class="btn full" id="remTest">إشعار تجريبي</button><button class="btn full" id="remOff">إيقاف التذكير</button>'
             : `<button class="btn gold full" id="remOn" ${pushOK() && !(isIOS && !isStandalone()) && perm !== 'denied' ? '' : 'disabled'}>تفعيل التذكير</button>`}
      ${PUSH.live ? '' : '<p class="muted sm" id="remSrv">الإرسال اليومي من الخادم لم يُفعَّل بعد، لذلك لن تصلك التذكيرات المجدولة حتى يُفعَّل. الإشعار التجريبي يعمل الآن.</p>'}`;
    openSheet('rem');
    const saveTimes = () => { const x = rem(); x.times = [$('#remT1').value || '06:00', $('#remT2').value || '20:00']; ST.set('rem', x); remSync(); };
    $('#remT1').onchange = saveTimes; $('#remT2').onchange = saveTimes;
    if ($('#remOn')) $('#remOn').onclick = async () => {
      // يجب أن يُطلب الإذن مباشرة داخل الضغطة
      let p; try { p = await Notification.requestPermission(); } catch (e) { p = 'default'; }
      if (p !== 'granted') { toast(p === 'denied' ? 'لم يُسمح بالإشعارات.' : 'لم يُفعَّل التذكير.'); return openRem(); }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(PUSH.vapid) });
        const x = rem(); x.on = true; x.sub = sub.toJSON(); ST.set('rem', x);
      } catch (e) { const x = rem(); x.on = true; x.sub = null; ST.set('rem', x); }
      await remSync(); toast('فُعِّل التذكير.'); openRem();
    };
    if ($('#remOff')) $('#remOff').onclick = async () => {
      try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {}
      const x = rem(); x.on = false; x.sub = null; ST.set('rem', x); await remSync(); toast('أُوقف التذكير.'); openRem();
    };
    if ($('#remTest')) $('#remTest').onclick = async () => {
      try { const reg = await navigator.serviceWorker.ready; await reg.showNotification('ورد اليوم', { body: 'حان وقت وردك. اضغط لفتح ورد اليوم.', tag: 'wird', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './?wird=1' } }); }
      catch (e) { toast('تعذّر عرض الإشعار.'); }
    };
  }
  /* فتح ورد اليوم (من الإشعار) */
  async function openWird() {
    closeSheets();
    const t = await refreshToday().catch(() => null), pl = ST.get().plan;
    if (!pl) { openPlan(false); return; }
    if (!isPlanDay(pl) || !t || !t.a) { openReview(); return; }
    goPage(await pageOfKey(t.a)); await select(t.a, t.b);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'wird') openWird(); });

  /* ---------- التكرار ---------- */
  const COUNTS = [2, 3, 5, 7, 10, 0];
  function openRepeat() {
    const r = ST.get().repeat;
    $('#repCount').innerHTML = COUNTS.map(c => `<button data-c="${c}" class="${c === r.count ? 'on' : ''}">${c ? ar(c) : 'بدون حد'}</button>`).join('');
    $$('#repMode button').forEach(b => b.classList.toggle('on', b.dataset.m === r.mode));
    openSheet('repeat');
  }
  $('#repCount').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#repCount button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#repMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#repMode button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#repGo').onclick = () => {
    const c = +($('#repCount .on') || { dataset: { c: 3 } }).dataset.c, m = ($('#repMode .on') || { dataset: { m: 'range' } }).dataset.m;
    ST.setRepeat({ count: c, mode: m }); closeSheets(); startPlay(c, m);
  };
  $('#aRepeat').onclick = openRepeat;

  /* ---------- حفظ / مراجعة ---------- */
  $('#aMem').onclick = async () => {
    if (!sel) return;
    const n = sel.list.length, allMem = sel.list.every(ST.isMem);
    if (allMem) {
      if (await ask(n > 1 ? 'إزالة هذه الآيات من محفوظك؟' : 'إزالة هذه الآية من محفوظك؟', 'إزالة')) { ST.unMem(sel.list); toast('أُزيلت من محفوظك.'); }
    } else {
      ST.markMem(sel.list);
      toast(`أُضيفت ${cnt(n)} إلى محفوظك، ${n === 2 ? 'ومراجعتهما' : 'ومراجعتها'} غدًا.`);
    }
    select(sel.a, sel.b); refreshToday(); badge();
  };
  $('#aRev').onclick = () => {
    if (!sel) return;
    ST.addReview(sel.list); badge();
    toast(`أُضيفت ${rangeLabel(sel.a, sel.b)} إلى قائمة المراجعة.`);
  };
  function badge() { const n = ST.due().length; const b = $('#dueBadge'); b.hidden = !n; b.textContent = ar(n); }

  /* ---------- الخطة ---------- */
  const DAYS = [[6, 'سبت'], [0, 'أحد'], [1, 'اثنين'], [2, 'ثلاثاء'], [3, 'أربعاء'], [4, 'خميس'], [5, 'جمعة']];
  const UNITS = { ayat: 'آيات', lines: 'أسطر', pages: 'صفحات' };
  const UW = { ayat: 'aya', lines: 'line', pages: 'page' };
  const daysLabel = d => d.length === 7 ? 'كل أيام الأسبوع' : `${cnt(d.length, 'day')} في الأسبوع`;
  async function cursorKey(pl) {
    let k = pl.start, n = 0;
    while (k && ST.isMem(k) && n < 6300) { k = await QD.nextKey(k); n++; }
    return k;
  }
  async function computePortion(pl) {
    const start = await cursorKey(pl); if (!start) return null;
    const keys = [];
    if (pl.unit === 'ayat') {
      let k = start; while (k && keys.length < pl.amount) { keys.push(k); k = await QD.nextKey(k); }
    } else {
      let p = await QD.pageOf(start), started = false; const lines = new Set();
      const lastP = p + pl.amount - 1;
      outer: for (; p <= N; p++) {
        const pd = await QD.page(p);
        for (const a of pd.ayat) {
          if (!started) { if (a.k !== start) continue; started = true; }
          if (pl.unit === 'pages') { if (p > lastP) break outer; keys.push(a.k); }
          else { if (lines.size >= pl.amount) break outer; a.lines.forEach(n => lines.add(p + ':' + n)); keys.push(a.k); }
        }
        if (pl.unit === 'pages' && p >= lastP) break;
      }
    }
    return { a: keys[0], b: keys[keys.length - 1], n: keys.length };
  }
  async function todayPortion() {
    const pl = ST.get().plan; if (!pl) return null;
    if (!pl.today || pl.today.date !== todayStr()) {
      const pr = await computePortion(pl);
      pl.today = pr ? { date: todayStr(), ...pr } : { date: todayStr(), a: null };
      ST.setPlan(pl);
    }
    return pl.today.a ? pl.today : null;
  }
  const isPlanDay = pl => pl.days.includes(new Date().getDay());
  async function refreshToday() {
    const pl = ST.get().plan, bar = $('#today');
    todayKeys = new Set();
    if (!pl) { bar.hidden = true; paint(); return null; }
    const t = await todayPortion();
    let html;
    if (!t) html = `<span class="sp">ما شاء الله، أتممت الخطة كاملة.</span>`;
    else {
      const ks = await keysBetween(t.a, t.b); todayKeys = new Set(ks);
      const done = ks.every(ST.isMem);
      if (!isPlanDay(pl)) html = `<span class="sp">اليوم راحة من الحفظ · راجع محفوظك</span><button class="chip" data-act="rev">المراجعة</button>`;
      else if (done) html = `<span class="sp">أنجزت ورد اليوم: <b>${rangeLabel(t.a, t.b)}</b></span><button class="chip" data-act="rev">راجع</button>`;
      else html = `<span class="sp">ورد اليوم: <b>${rangeLabel(t.a, t.b)}</b></span><button class="chip" data-act="open">افتح</button><button class="chip" data-act="listen">استمع</button>`;
    }
    bar.innerHTML = html; bar.hidden = false;
    paint();
    return t;
  }
  $('#today').onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const t = ST.get().plan && ST.get().plan.today;
    if (b.dataset.act === 'rev') return openReview();
    if (!t || !t.a) return;
    goPage(await pageOfKey(t.a)); await select(t.a, t.b);
    if (b.dataset.act === 'listen') startPlay(ST.get().repeat.count || 1, ST.get().repeat.mode);
  };
  function planForm(pl) {
    pl = pl || { start: '1:1', unit: 'ayat', amount: 5, days: [6, 0, 1, 2, 3, 4] };
    const [s, a] = pl.start.split(':');
    return `
      <label class="lbl">من أين تبدأ؟</label>
      <div class="row"><select id="plS">${chapters.map(c => `<option value="${c.id}" ${c.id == s ? 'selected' : ''}>${ar(c.id)}. ${c.name_arabic}</option>`).join('')}</select>
      <input id="plA" type="number" min="1" value="${a}" style="max-width:96px" inputmode="numeric" aria-label="الآية"></div>
      <label class="lbl">مقدار الحفظ اليومي</label>
      <div class="seg" id="plU">${Object.entries(UNITS).map(([k, v]) => `<button data-u="${k}" class="${k === pl.unit ? 'on' : ''}">${v}</button>`).join('')}</div>
      <input id="plN" type="number" min="1" max="50" value="${pl.amount}" inputmode="numeric">
      <label class="lbl">أيام الحفظ</label>
      <div class="days" id="plD">${DAYS.map(([v, n]) => `<button data-d="${v}" class="${pl.days.includes(v) ? 'on' : ''}">${n}</button>`).join('')}</div>
      <button class="btn gold full" id="plSave">احفظ الخطة</button>
      ${ST.get().plan ? '<button class="btn full" id="plCancel">رجوع</button>' : ''}`;
  }
  async function openPlan(edit) {
    const pl = ST.get().plan, body = $('#planBody');
    openSheet('plan');
    if (!pl || edit) {
      body.innerHTML = (pl ? '' : '<div class="card"><h4>ابدأ خطتك</h4><p>حدّد نقطة البداية ومقدار الورد اليومي، وسيفتح لك المصحف كل يوم على موضع حفظك.</p></div>') + planForm(pl);
      $('#plU').onclick = e => { const b = e.target.closest('button'); if (b) $$('#plU button').forEach(x => x.classList.toggle('on', x === b)); };
      $('#plD').onclick = e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); };
      if ($('#plCancel')) $('#plCancel').onclick = () => openPlan(false);
      $('#plSave').onclick = async () => {
        const s = +$('#plS').value, c = chapters[s - 1];
        const a = Math.max(1, Math.min(c.verses_count, +$('#plA').value || 1));
        const days = $$('#plD .on').map(b => +b.dataset.d);
        if (!days.length) return toast('اختر يومًا واحدًا على الأقل.');
        const npl = { start: s + ':' + a, unit: $('#plU .on').dataset.u, amount: Math.max(1, Math.min(50, +$('#plN').value || 1)), days, created: Date.now() };
        ST.setPlan(npl);
        const t = await refreshToday();
        closeSheets();
        toast('حُفظت الخطة');
        if (t) goPage(await pageOfKey(t.a));
      };
      return;
    }
    const t = await todayPortion();
    const memN = Object.keys(ST.get().mem).length;
    body.innerHTML = `
      <div class="card"><h4>ورد اليوم</h4>
        <p>${t ? `<b>${rangeLabel(t.a, t.b)}</b> (${cnt(t.n)})` : 'ما شاء الله، أتممت الخطة كاملة.'}</p>
        <p>${isPlanDay(pl) ? 'اليوم يوم حفظ' : 'اليوم راحة من الحفظ، وهو وقت للمراجعة.'}</p>
        ${t ? '<div class="row"><button class="btn gold" id="plOpen" style="flex:1">افتح الورد</button><button class="btn dark" id="plListen" style="flex:1">استمع للورد</button></div>' : ''}
      </div>
      <div class="card"><h4>تقدّمك</h4>
        <p>بدأت من ${keyLabel(pl.start)} · ${cnt(pl.amount, UW[pl.unit])} في اليوم · ${daysLabel(pl.days)}</p>
        <p>${memN ? `حفظت ${cnt(memN, 'aya', true)} حتى الآن.` : 'بداية طيبة، واصل ورد اليوم.'}</p>
      </div>
      <button class="btn full" id="plEdit">تعديل الخطة</button>
      <button class="btn full ghost" id="plDel">حذف الخطة</button>`;
    if ($('#plOpen')) {
      $('#plOpen').onclick = async () => { closeSheets(); goPage(await pageOfKey(t.a)); select(t.a, t.b); };
      $('#plListen').onclick = async () => { closeSheets(); goPage(await pageOfKey(t.a)); await select(t.a, t.b); startPlay(ST.get().repeat.count || 1, ST.get().repeat.mode); };
    }
    $('#plEdit').onclick = () => openPlan(true);
    $('#plDel').onclick = async () => { if (await ask('حذف الخطة؟ لن يُحذف المحفوظ ولا المراجعة.', 'حذف')) { ST.setPlan(null); refreshToday(); closeSheets(); } };
  }

  /* ---------- المراجعة ---------- */
  function groupKeys(items) {
    items.sort((x, y) => cmpKey(x.k, y.k));
    const g = [];
    for (const it of items) {
      const last = g[g.length - 1];
      const [s, a] = it.k.split(':').map(Number);
      if (last && last.s === s && last.ae === a - 1 && last.lvl === it.lvl) { last.keys.push(it.k); last.ae = a; }
      else g.push({ s, as: a, ae: a, lvl: it.lvl, keys: [it.k] });
    }
    return g;
  }
  function openReview() {
    openSheet('review');
    const due = groupKeys(ST.due());
    const n = ST.due().length;
    $('#revBody').innerHTML = (n ? `<div class="card"><p><b>اليوم: ${cnt(n)} للمراجعة</b></p><p class="muted sm">راجع المقطع، ثم اختر: إذا أتقنته يعود لاحقًا، وإذا لم يُتقَن بعد يعود غدًا.</p></div>` : '') +
      (due.length ? due.map((g, i) => `<div class="rv" data-i="${i}"><div class="m"><b>${sName(g.s)} ${g.as === g.ae ? ar(g.as) : ar(g.as) + ' – ' + ar(g.ae)}</b><small>${cnt(g.keys.length)} · ${g.lvl ? 'مراجعتها التالية: بعد ' + after(ST.INTERVALS[g.lvl]) : 'جديدة'}</small></div><button data-a="open">افتح</button><button class="g" data-a="good">أتقنتها</button><button data-a="bad">لم تُتقَن بعد</button></div>`).join('')
        : '<p class="muted" style="text-align:center;margin-top:30px">ليست لديك مراجعة مستحقة اليوم.</p>');
    $('#revBody').onclick = async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const g = due[+b.closest('.rv').dataset.i];
      if (b.dataset.a === 'open') { closeSheets(); goPage(await pageOfKey(g.keys[0])); select(g.keys[0], g.keys[g.keys.length - 1]); return; }
      const good = b.dataset.a === 'good';
      g.keys.forEach(k => ST.grade(k, good));
      const lv = (ST.get().rev[g.keys[0]] || { lvl: 0 }).lvl;
      toast(good ? `أحسنت، ستعود مراجعتها بعد ${after(ST.INTERVALS[lv])}.` : 'حسنًا، ستعود إليك غدًا.');
      badge(); openReview();
    };
  }

  /* ---------- الفهرس ---------- */
  let juzs = null;
  async function openIndex(kind = 's') {
    openSheet('index');
    $$('#sh-index .seg button').forEach(b => b.classList.toggle('on', b.dataset.ix === kind));
    const L = $('#ixList');
    if (kind === 's') {
      L.innerHTML = chapters.map(c => `<button class="li" data-p="${c.pages[0]}"><span class="n">${ar(c.id)}</span><span class="m"><b>${c.name_arabic}</b><small>${c.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · ${cnt(c.verses_count)}</small></span><span class="pgn">ص ${ar(c.pages[0])}</span></button>`).join('');
    } else {
      if (!juzs) juzs = await QD.juzStarts();
      L.innerHTML = juzs.map(j => `<button class="li" data-k="${j.k}"><span class="n">${ar(j.n)}</span><span class="m"><b>الجزء ${ar(j.n)}</b><small>يبدأ من ${keyLabel(j.k)}</small></span></button>`).join('');
    }
  }
  $('#sh-index .seg').onclick = e => { const b = e.target.closest('button'); if (b) openIndex(b.dataset.ix); };
  $('#ixList').onclick = async e => {
    const b = e.target.closest('.li'); if (!b) return;
    closeSheets(); goPage(b.dataset.p ? +b.dataset.p : await pageOfKey(b.dataset.k));
  };
  $('#btnIndex').onclick = () => openIndex('s');

  /* ---------- البحث: الآية، السورة، الجزء، الصفحة ---------- */
  // نص Tanzil (Simple Clean، CC BY 3.0) كما هو، والتطبيع وقت البحث فقط
  const norm = t => t
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, 'ا')
    .replace(/\u0624/g, 'و').replace(/[\u0626\u0649\u06CC]/g, 'ي').replace(/\u0629/g, 'ه').replace(/\u0621/g, '')
    .replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
  let QT = null;
  function loadText() {
    if (!QT) QT = fetch('data/quran-simple-clean.txt').then(r => { if (!r.ok) throw new Error('text'); return r.text(); }).then(txt => {
      const rows = [];
      for (const ln of txt.split('\n')) { const m = ln.match(/^(\d+)\|(\d+)\|(.+)$/); if (m) rows.push({ k: m[1] + ':' + m[2], t: m[3].trim(), n: ' ' + norm(m[3]) + ' ' }); }
      if (rows.length !== 6236) throw new Error('text rows');
      return rows;
    }).catch(e => { QT = null; throw e; });
    return QT;
  }
  async function searchText(q) {
    const nq = norm(q), out = $('#qRes'), info = $('#qInfo');
    if (nq.length < 2) { out.innerHTML = ''; info.textContent = 'البحث يتجاهل التشكيل والهمزات'; return; }
    let rows; try { rows = await loadText(); } catch (e) { info.textContent = 'تحقّق من اتصالك بالإنترنت.'; return; }
    if (norm($('#qText').value) !== nq) return;
    const words = nq.split(' ');
    const hits = rows.filter(r => words.every(w => r.n.includes(w)));
    info.textContent = hits.length ? (hits.length > 100 ? `أول 100 من ${cnt(hits.length)}` : cnt(hits.length)) : 'لا توجد نتائج';
    const show = hits.slice(0, 100);
    const pages = await Promise.all(show.map(h => pageOfKey(h.k).catch(() => 0)));
    out.innerHTML = show.map((h, i) => `<button class="li res" data-k="${h.k}"><span class="m"><b>${keyLabel(h.k)}</b><small class="qt">${esc(h.t)}</small></span><span class="pgn">ص ${ar(pages[i])}</span></button>`).join('');
  }
  let qTimer = 0;
  $('#qText').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => searchText($('#qText').value), 220); });
  $('#qText').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qTimer); searchText($('#qText').value); e.target.blur(); } });
  async function jumpKey(k) { closeSheets(); goPage(await pageOfKey(k)); select(k); }
  $('#qRes').onclick = e => { const b = e.target.closest('[data-k]'); if (b) jumpKey(b.dataset.k); };
  function surahList(q = '') {
    const nq = norm(q), num = +q;
    const list = chapters.filter(c => !q.trim() || (num ? c.id === num : norm(c.name_arabic).includes(nq)));
    $('#sList').innerHTML = list.map(c => `<button class="li" data-p="${c.pages[0]}"><span class="n">${ar(c.id)}</span><span class="m"><b>${c.name_arabic}</b><small>${c.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · ${cnt(c.verses_count)}</small></span><span class="pgn">ص ${ar(c.pages[0])}</span></button>`).join('');
  }
  $('#qSurah').addEventListener('input', e => surahList(e.target.value));
  $('#sList').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { closeSheets(); goPage(+b.dataset.p); } };
  async function juzList() {
    if (!juzs) juzs = await QD.juzStarts();
    const ps = await Promise.all(juzs.map(j => pageOfKey(j.k)));
    $('#jList').innerHTML = juzs.map((j, i) => `<button class="jz" data-p="${ps[i]}"><b>${ar(j.n)}</b><small>${keyLabel(j.k)}</small><small class="muted">ص ${ar(ps[i])}</small></button>`).join('');
  }
  $('#jList').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { closeSheets(); goPage(+b.dataset.p); } };
  let goLast = 't';
  function goMode(m) {
    goLast = m;
    $$('#goSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $$('#goBody [data-pane]').forEach(p => p.hidden = p.dataset.pane !== m);
    if (m === 's') surahList($('#qSurah').value);
    if (m === 'j') juzList();
    if (m === 'p') { $('#goPage').value = cur; pageInfo(); }
    if (m === 't') loadText().catch(() => {});
  }
  function pageInfo() {
    const p = +$('#goPage').value;
    if (!(p >= 1 && p <= N)) { $('#goPageInfo').textContent = ''; return; }
    QD.page(p).then(pd => { if (+$('#goPage').value === p) $('#goPageInfo').textContent = `${surahsTitle(pd.surahs, 60)} · الجزء ${ar(pd.juz)}`; }).catch(() => {});
  }
  $('#goPage').addEventListener('input', pageInfo);
  $('#goPage').addEventListener('keydown', e => { if (e.key === 'Enter') $('#goPageBtn').click(); });
  $('#goSeg').onclick = e => { const b = e.target.closest('button'); if (b) goMode(b.dataset.m); };
  $('#btnGo').onclick = () => {
    if (!$('#goSurah').options.length) $('#goSurah').innerHTML = chapters.map(c => `<option value="${c.id}">${ar(c.id)}. ${c.name_arabic}</option>`).join('');
    openSheet('go'); goMode(goLast);
  };
  $('#goPageBtn').onclick = () => { const p = +$('#goPage').value; if (p >= 1 && p <= N) { closeSheets(); goPage(p); } else toast('رقم الصفحة من 1 إلى 604'); };
  $('#goKeyBtn').onclick = async () => {
    const s = +$('#goSurah').value, c = chapters[s - 1], a = +$('#goAyah').value || 1;
    if (a > c.verses_count) return toast(`سورة ${c.name_arabic} فيها ${cnt(c.verses_count)}.`);
    jumpKey(s + ':' + a);
  };

  /* ---------- الوضع الليلي: الواجهة فقط، والصفحة كما أصدرها المجمع ---------- */
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const s = ST.get(), t = s.theme || 'system';
    const dark = t === 'dark' || (t === 'system' && mqDark.matches);
    const H = document.documentElement;
    H.classList.toggle('dark', dark);
    H.classList.remove('darkpage');
    H.dataset.paper = s.paper || 'beige';
    H.classList.toggle('vfull', s.view === 'full');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#171818' : ({ white: '#F7F7F6', cream: '#F4EAD6', grey: '#CDC9C4', blue: '#E6F0F8' }[s.paper] || '#FBF4EC');
  }
  function setTheme(t) { ST.setTheme(t); applyTheme(); }
  mqDark.addEventListener ? mqDark.addEventListener('change', applyTheme) : mqDark.addListener(applyTheme);
  $('#btnTheme').onclick = () => { setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'); };

  /* ---------- المزيد والمصادر ---------- */
  const CK = '<svg class="ck" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  function openMore() {
    openSheet('more');
    const s = ST.get(), rid = s.reciter;
    const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, n]) => `<button data-v="${v}" class="${val === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    $('#moreBody').innerHTML = `
       <button class="btn full dl" id="mDl"><b>تنزيل المصحف كاملًا</b><small>نحو ${viewFull() ? 61 : 89} ميجابايت، للقراءة بدون إنترنت</small></button>
       <div class="bar" id="dlBar" hidden><i style="width:0%"></i></div>
       <button class="btn full" id="mSrc">المصادر</button>
       <button class="btn full" id="mInst">طريقة التثبيت على الآيفون</button>
       <p class="muted sm" style="line-height:1.8;margin-top:14px">بياناتك (الخطة، والمحفوظ، والمراجعة، وآخر صفحة) محفوظة على جهازك فقط، ولا تُرسل إلى أي خادم. صفحات المصحف هي النسخة الرسمية من مجمع الملك فهد، وتُحفظ على جهازك بعد فتحها. والتلاوات تُبث عند التشغيل ولا تُخزَّن.</p>`;
    $('#moreBody').onclick = e => {
      const r = e.target.closest('[data-r]');
      if (r) { ST.setReciter(+r.dataset.r); openMore(); return; }
      const vw = e.target.closest('#mView [data-v]'); if (vw) { ST.set('view', vw.dataset.v); applyTheme(); rebuildLeaves(); openMore(); return; }
      if (e.target.closest('#mDl')) downloadAll();
      if (e.target.closest('#mSrc')) openSources();
      if (e.target.closest('#mInst')) { closeSheets(); showInstall(true); }
    };
  }
  async function downloadAll() {
    const bar = $('#dlBar'), btn = $('#mDl'); bar.hidden = false; btn.disabled = true;
    const c = await caches.open('mushaf-pages-v2'); let done = 0;
    const ps = [...Array(N).keys()].map(i => i + 1);
    const pad = p => String(p).padStart(3, '0');
    const urls = p => [viewFull() ? `pages/${pad(p)}.webp` : `lines/${pad(p)}.webp`];
    const worker = async () => { while (ps.length) { const p = ps.shift(); for (const rel of urls(p)) { const u = new URL(rel, location.href).href; if (!(await c.match(u))) { try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (e) {} } } done++; bar.firstElementChild.style.width = (done / N * 100).toFixed(1) + '%'; btn.innerHTML = `<b>جارٍ التنزيل… ${ar(done)}/${ar(N)}</b>`; } };
    await Promise.all([1, 2, 3, 4].map(worker));
    btn.innerHTML = '<b>تم تنزيل المصحف كاملًا.</b>'; toast('أصبح المصحف كاملًا متاحًا بدون إنترنت.');
  }
  const L = t => `<bdi dir="ltr">${t}</bdi>`;
  function openSources() {
    openSheet('sources');
    $('#srcBody').innerHTML = `
      <p>المصحف المعروض هو مصحف المدينة النبوية نفسه: النسخة الرقمية الرسمية الصادرة عن مجمع الملك فهد لطباعة المصحف الشريف (رواية حفص، إصدار 1441هـ، 604 صفحات).</p>
      <h4>صفحات المصحف</h4>
      <p>الصفحات من النسخة الرسمية الصادرة عن المجمع، من صفحة «مصحف المدينة النبوية لأعمال الطباعة»:<br>${L('<a href="https://qurancomplex.gov.sa/mushaf-printing" target="_blank" rel="noopener">qurancomplex.gov.sa/mushaf-printing</a>')}</p>
      <p>وتُعرض كما أصدرها المجمع، بدون تعديل في النص أو في ترتيب الأسطر. في عرض «الصفحة بإطارها» تظهر بإطارها وألوانها الرسمية وعناوين السور وترويسة الجزء ورقم الصفحة. وفي عرض «ملء الشاشة» تُعرض أسطر الصفحة نفسها بكلماتها وترتيبها، مع مسافة أوسع بين الأسطر، وزخرفة فواصل الآيات وإطارات أسماء السور باللون الذي تختاره، البيج أو الأزرق، بدلًا من الأخضر.</p>
      <p><b>حقوق الاستخدام (من صفحة المجمع):</b> «يمكن استخدام النسخة المذكورة مجانًا في المجالات الشخصية والأعمال الفردية كافة… ومواقع الإنترنت والبرامج الحاسوبية وغيرها، داخل المملكة وخارجها». والمجمع غير مسؤول عن الأخطاء الفنية الناتجة عن الاستخدام.</p>
      <h4>تحديد الآيات</h4>
      <p>مواضع الآيات طبقة شفافة فوق الصورة، من مشروع ${L('quran-ws/quran-svg')} المستخرج من ملفات المجمع (رخصة ${L('CC BY 4.0')}). التظليل لا يغيّر صورة المصحف.</p>
      <p>أسماء السور والأجزاء والأحزاب من بيانات ${L('Tanzil')} (رخصة ${L('CC BY 3.0')}).</p>
      <h4>التلاوات</h4>
      <p>التسجيلات من ${L('Quran Foundation')} ومرآة ${L('EveryAyah')}، وحقوقها لأصحابها. الاستماع بالبث فقط، بدون تخزين أو إعادة نشر.</p>
      <p>القارئ الحالي: ${AU.reciter(ST.get().reciter).name}.</p>
      <p>التطبيق يتأكد قبل التشغيل أن التسجيل يطابق الآية المحددة.</p>
      <p>${L('<a href="https://api-docs.quran.com/legal/developer-terms/" target="_blank" rel="noopener">Quran Foundation — Developer Terms</a>')}</p>
      <h4>التفسير</h4>
      <p><b>المختصر في تفسير القرآن الكريم</b>، إعداد مركز تفسير للدراسات القرآنية. منقول كما ورد دون تعديل من موسوعة القرآن الكريم ${L('QuranEnc.com')} (المفتاح ${L('arabic_mokhtasar')})، عبر واجهتها البرمجية. رقم الإصدار غير منشور في المصدر، وتاريخ النقل 21 نوفمبر 2026.<br>${L('<a href="https://quranenc.com/ar/browse/arabic_mokhtasar" target="_blank" rel="noopener">quranenc.com/ar/browse/arabic_mokhtasar</a>')}</p>
      <p><b>تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)</b>، للشيخ عبد الرحمن بن ناصر السعدي. منقول كما ورد دون تعديل من صفحات ${L('QuranEnc.com')} (${L('arabic_saadi')})، وتاريخ النقل 21 نوفمبر 2026.<br>${L('<a href="https://quranenc.com/ar/browse/arabic_saadi" target="_blank" rel="noopener">quranenc.com/ar/browse/arabic_saadi</a>')}</p>
      <p>شروط ${L('QuranEnc.com')} لإعادة النشر: عدم التعديل أو الإضافة أو الحذف، والإشارة إلى الناشر والمصدر، وذكر الإصدار، وتحديث النص وفق الإصدارات الجديدة، وعدم عرض إعلانات. التطبيق مجاني وبلا إعلانات.</p>
      <h4>الخصوصية وشروط الاستخدام</h4>
      <p><a href="privacy.html" target="_blank">سياسة الخصوصية</a> · <a href="terms.html" target="_blank">شروط الاستخدام</a></p>`;
  }

  /* ---------- الشاشات المنبثقة والتبويب ---------- */
  function openSheet(id) {
    const was = $$('.sheet').find(s => !s.hidden);
    if (!was || was.id !== 'sh-' + id) { const t = $('#toast'); t.classList.remove('show'); clearTimeout(t._h); }
    $$('.sheet').forEach(s => s.hidden = s.id !== 'sh-' + id);
    $('#scrim').hidden = false; document.body.classList.add('sheet-open');
  }
  function closeSheets() { $$('.sheet').forEach(s => s.hidden = true); $('#scrim').hidden = true; document.body.classList.remove('sheet-open'); navOn('mushaf'); }
  $('#scrim').onclick = () => { if (!$('#sh-confirm').hidden) return; closeSheets(); };
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheets(); });
  $('.tabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    const t = b.dataset.tab;
    if (t === 'mushaf') closeSheets();
    if (t === 'plan') openPlan(false);
    if (t === 'review') openReview();
    if (t === 'more') openMore();
  };
  $('#navNext').onclick = () => { AU.unlock(); flip(1, true); };
  $('#navPrev').onclick = () => { AU.unlock(); flip(-1, true); };
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select')) return;
    if (e.key === 'ArrowLeft') $('#navNext').click();
    if (e.key === 'ArrowRight') $('#navPrev').click();
    if (e.key === 'Escape') { closeSheets(); clearSel(); }
  });

  /* ---------- التثبيت ---------- */
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function showInstall(force) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (standalone && !force) return;
    if (!force && localStorage.getItem('mushaf.inst')) return;
    const box = $('#install');
    box.innerHTML = `<b>ثبّت المصحف على الآيفون</b><br>افتح الرابط في ${L('Safari')}، ثم زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، ثم «إضافة».<br>بعدها يفتح كتطبيق مستقل بدون شريط المتصفح.<div style="text-align:left;margin-top:6px"><button class="btn" id="instOk">تم</button></div>`;
    box.hidden = false;
    $('#instOk').onclick = () => { box.hidden = true; localStorage.setItem('mushaf.inst', '1'); };
  }

  /* ---------- البدء ---------- */
  async function boot() {
    applyTheme(); layout(); navOn('mushaf');
    document.addEventListener('touchend', () => { if (!TM.on) AU.unlock(); }, { capture: true, passive: true });
    try { chapters = await QD.chapters(); } catch (e) { toast('تحقّق من اتصالك بالإنترنت.'); }
    badge();
    const params = new URLSearchParams(location.search);
    let start = +params.get('p') || 0;
    const t = await refreshToday().catch(() => null);
    const pl = ST.get().plan;
    if (!start && t && pl && isPlanDay(pl) && !(await keysBetween(t.a, t.b)).every(ST.isMem)) start = await pageOfKey(t.a);
    if (!start) start = ST.get().lastPage || 1;
    goPage(start);
    if (params.has('wird')) { history.replaceState(null, '', location.pathname); setTimeout(openWird, 300); }
    setTimeout(() => showInstall(false), 1500);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  /* ---------- التسميع: الآيات مخفية، وتنكشف كل آية عند تلاوتها صحيحة أو باللمس ---------- */
  // المطابقة على نص Tanzil (Simple Clean) بعد التطبيع، بسماحية خطأ حرف واحد في الكلمة. لا يُعرض أي نص: الكشف يكون على صورة الصفحة نفسها.
  // مسافة تحرير صغيرة (حتى حدّين) لمطابقة متسامحة مع أخطاء التعرف
  const levN = (a, b, k) => { if (a === b) return true; if (Math.abs(a.length - b.length) > k) return false; let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; let mn = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < mn) mn = cur[j]; } if (mn > k) return false; prev = cur; } return prev[b.length] <= k; };
  const strip = w => w.replace(/^(و|ف)?(ب|ل|ك)?(ال)?/, '').replace(/ا$/, '');
  const tol = e => e.length >= 7 ? 2 : e.length >= 4 ? 1 : 0;
  const wsim = (w, e) => { if (w === e) return true; const sw = strip(w), se = strip(e); if (sw && sw === se) return true; const k = tol(e); return k > 0 && (levN(w, e, k) || (se.length >= 3 && levN(sw, se, Math.min(k, tol(se) || 1)))); };
  // يطابق كلمات مسموعة بكلمات الآية بالترتيب؛ يتجاهل الكلمات الزائدة، ويتسامح مع سقوط حتى كلمتين متتاليتين
  function tmMatch(words, E) {
    let j = 0, last = -1;
    for (let x = 0; x < words.length && j < E.length; x++) {
      for (let s = 0; s <= 2 && j + s < E.length; s++) if (wsim(words[x], E[j + s])) { j += s + 1; last = x; break; }
    }
    return { j, last };
  }
  const tmNeed = n => n <= 3 ? n : n <= 6 ? n - 1 : Math.ceil(n * 0.7);
  async function tmExpect() {
    const k = TM.keys[TM.i]; if (!k) { TM.E = []; return; }
    try { const rows = await loadText(); const r = rows.find(x => x.k === k); TM.E = r ? norm(r.n).split(' ').filter(Boolean) : []; } catch (e) { TM.E = []; }
  }
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  function tmPaint() {
    const el = leaves.get(TM.p);
    book.querySelectorAll('.hot path.rv,.hot path.rvt,.hot path.nx,.hot path.fl').forEach(s => s.classList.remove('rv', 'rvt', 'nx', 'fl'));
    if (TM.on && el) el.querySelectorAll('.hot path').forEach(s => { const v = TM.rv.get(s.dataset.k); if (v) s.classList.add(v === 'tap' ? 'rvt' : 'rv'); else if (s.dataset.k === TM.keys[TM.i]) s.classList.add('nx'); });
    const done = TM.i >= TM.keys.length, nv = [...TM.rv.values()], bySpeech = nv.filter(v => v === 'speech').length, byTap = nv.length - bySpeech;
    $("#tmPg").textContent = `صفحة ${ar(TM.p)} — كُشفت ${ar(TM.rv.size)} من ${ar(TM.keys.length)}`;
    let st;
    if (done) st = `أتممت الصفحة: ${ar(bySpeech)} بالتلاوة، ${ar(byTap)} باللمس.`;
    else if (TM.why) st = TM.why;
    else if (TM.listening) st = `أسمعك… الآية ${ar(TM.keys[TM.i].split(':')[1])}` + (TM.prog ? ` · طابقت ${ar(TM.prog)} من ${ar(TM.E.length)} كلمة` : '');
    else if (!SRC) st = IOS && STANDALONE ? 'التعرف على الصوت غير متاح في وضع التطبيق على الآيفون. افتح الرابط في Safari، أو المس الآية بعد تلاوتها لتنكشف.' : 'المس الآية بعد تلاوتها لتنكشف. التعرف على الصوت غير متاح في هذا المتصفح.';
    else st = IOS && STANDALONE ? 'اضغط «سمّع» وابدأ التلاوة. إن لم يعمل الصوت في وضع التطبيق فافتح الرابط في Safari، أو المس الآية لكشفها.' : 'اضغط «سمّع» وابدأ التلاوة، أو المس الآية لكشفها.';
    $('#tmSt').textContent = st;
    const hd = $('#tmHeard'); hd.hidden = !SRC || done || !(TM.listening || TM.heardTxt); hd.textContent = TM.heardTxt ? 'سُمع: ' + TM.heardTxt : 'سُمع: …';
    $('#tmMic').hidden = !SRC || done; $('#tmMic').classList.toggle('on', TM.listening);
    $('#tmMic span').textContent = TM.listening ? 'إيقاف' : 'سمّع';
    $('#tmRev').hidden = done; $('#tmHint').hidden = done;
    $('#tmNext').hidden = !done || TM.p >= N; $('#tmAgain').hidden = !done;
  }
  async function tmLoad(p) {
    const pd = await QD.page(p);
    TM.p = p; TM.keys = pd.ayat.map(a => a.k); TM.i = 0; TM.rv = new Map(); TM.prog = 0; TM.why = ''; TM.cut = TM.heard.length;
    await tmExpect(); tmPaint();
  }
  async function tmStart() {
    if (TM.on) return;
    closeSheets(); noteClose(); if (sel) clearSel(); AU.stop && AU.stop();
    TM.on = true; TM.heardTxt = ''; document.body.classList.add('tm'); $('#tm').hidden = false; layout(); refit();
    notesPaint(cur); await tmLoad(cur);
    loadText().catch(() => { TM.why = 'تعذّر تحميل النص للمطابقة. يمكنك الكشف باللمس.'; tmPaint(); });
  }
  // الإغلاق يعمل دائمًا: نوقف التعرف أولًا ونخفي الشريط حتى لو تعثّر أي جزء آخر
  function tmEnd() {
    try { tmListen(false); } catch (e) {}
    TM.on = false; document.body.classList.remove('tm'); $('#tm').hidden = true;
    try { tmPaint(); layout(); refit(); notesPaint(cur); navOn('mushaf'); } catch (e) {}
  }
  async function tmReveal(k, how) {
    if (!TM.on || TM.rv.has(k)) return;
    TM.rv.set(k, how);
    if (how === 'tap') TM.cut = TM.heard.length;   // ما سُمع قبل الكشف باللمس لا يُطابَق بالآيات التالية
    if (k === TM.keys[TM.i]) { while (TM.i < TM.keys.length && TM.rv.has(TM.keys[TM.i])) TM.i++; TM.prog = 0; TM.why = ''; await tmExpect(); }
    tmPaint();
    if (TM.i >= TM.keys.length) tmListen(false);
  }
  function tmHint() {
    const k = TM.keys[TM.i]; if (!k) return;
    const s = leaves.get(TM.p) && leaves.get(TM.p).querySelector(`.hot path[data-k="${k}"]`); if (!s) return;
    s.classList.add('fl'); setTimeout(() => s.classList.remove('fl'), 1200);
  }
  // يطابق نصًّا مسموعًا بالآية التالية فما بعدها، ويعيد عدد الكلمات المستهلكة في كشف آيات
  async function tmFeed(text, final) {
    if (!TM.on || TM.i >= TM.keys.length) return 0;
    if (!TM.E.length) await tmExpect();
    const words = norm(text || '').split(' ').filter(Boolean); if (!words.length || !TM.E.length) return 0;
    const { j, last } = tmMatch(words, TM.E);
    TM.prog = j;
    if (j >= tmNeed(TM.E.length) && j >= 1) {
      await tmReveal(TM.keys[TM.i], 'speech');
      const rest = words.slice(last + 1).join(' ');
      return last + 1 + (rest ? await tmFeed(rest, final) : 0);
    }
    TM.why = (final && words.length >= TM.E.length + 4 && j < TM.E.length / 2) ? 'لم تطابق الآية التالية. أعد تلاوتها، أو المسها لكشفها.' : '';
    tmPaint();
    return 0;
  }
  // نص الجلسة كاملًا (يعمل مع سفاري الآيفون الذي يعيد النص تراكميًا أو يصفّر قائمة النتائج)
  let tmQ = Promise.resolve();
  function tmHeardUpdate(raw, fin) {
    const W = norm(raw).split(' ').filter(Boolean);
    const H = TM.heard, same = TM.cut <= W.length && W.slice(0, TM.cut).join(' ') === H.slice(0, TM.cut).join(' ');
    if (!same) TM.cut = 0;
    TM.heard = W; TM.heardTxt = raw.replace(/\s+/g, ' ').trim().split(' ').slice(-8).join(' ');
    tmQ = tmQ.then(async () => { const from = Math.min(TM.cut, TM.heard.length); const used = await tmFeed(TM.heard.slice(from).join(' '), fin); if (used) TM.cut = from + used; tmPaint(); }).catch(() => {});
    tmPaint();
  }
  function tmListen(on) {
    if (!SRC) { if (on) { TM.why = 'التعرف على الصوت غير متاح في هذا المتصفح. اكشف الآيات باللمس.'; tmPaint(); } return; }
    clearTimeout(TM.wd);
    if (!on) {
      TM.listening = false; const r = TM.rec; TM.rec = null;
      if (r) { r.onresult = r.onerror = r.onend = r.onstart = r.onaudiostart = null; try { r.abort(); } catch (e) {} try { r.stop(); } catch (e) {} }
      if (TM.on) tmPaint(); return;
    }
    if (TM.rec) tmListen(false);
    TM.why = ''; TM.heard = []; TM.cut = 0; TM.heardTxt = ''; TM.restarts = [];
    TM.listening = true; tmSession();
  }
  function tmSession() {
    const r = new SRC(); r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    TM.rec = r; const t0 = Date.now(); let started = false, got = false;
    const fail = m => { if (TM.rec !== r) return; TM.why = m; tmListen(false); };
    r.onstart = r.onaudiostart = () => { started = true; };
    r.onresult = ev => {
      if (TM.rec !== r) return;
      got = true; let txt = '', fin = true;
      for (let x = 0; x < ev.results.length; x++) { const a = ev.results[x]; if (a && a[0]) txt += ' ' + a[0].transcript; if (a && !a.isFinal) fin = false; }
      tmHeardUpdate(txt, fin);
    };
    r.onerror = ev => {
      if (TM.rec !== r) return;
      const e = ev && ev.error;
      if (e === 'no-speech' || e === 'aborted') return;   // onend يقرر المتابعة
      const m = { 'not-allowed': 'لم يُسمح باستخدام الميكروفون أو التعرف على الكلام. اسمح بهما من الإعدادات، أو اكشف الآيات باللمس.', 'service-not-allowed': IOS && STANDALONE ? 'التعرف على الصوت لا يعمل في وضع التطبيق على الآيفون. افتح الرابط في Safari، أو اكشف الآيات باللمس.' : 'التعرف على الصوت غير متاح هنا. اكشف الآيات باللمس.', 'network': 'التعرف على الصوت يحتاج إنترنت. اكشف الآيات باللمس.', 'audio-capture': 'لم يُعثر على ميكروفون. اكشف الآيات باللمس.', 'language-not-supported': 'التعرف على العربية غير متاح في هذا الجهاز. اكشف الآيات باللمس.' }[e];
      fail(m || `تعذّر التعرف على الصوت (${e || 'خطأ'}). اكشف الآيات باللمس.`);
    };
    // المحرك ينهي الجلسة عند الصمت: نعيد تشغيله بحدود، ولا ندخل في حلقة إعادة سريعة (كانت تحجب الأزرار على الآيفون)
    r.onend = () => {
      if (TM.rec !== r || !TM.listening || !TM.on) return;
      const now = Date.now(); TM.restarts = TM.restarts.filter(t => now - t < 15000);
      const quick = now - t0 < 1500 && !got;
      if ((IOS && STANDALONE && !got) || quick && TM.restarts.length >= 1 || TM.restarts.length >= 4) {
        return fail(IOS && STANDALONE && !got ? 'لم يصل صوت من الميكروفون. في وضع التطبيق على الآيفون قد لا يعمل التعرف؛ افتح الرابط في Safari، أو اكشف الآيات باللمس.' : 'توقف الاستماع. اضغط «سمّع» للمتابعة.');
      }
      TM.restarts.push(now); TM.heard = []; TM.cut = 0;
      setTimeout(() => { if (TM.rec === r && TM.listening && TM.on) { try { tmSession(); } catch (e) { fail('توقف الاستماع. اضغط «سمّع» للمتابعة.'); } } }, 300);
    };
    TM.wd = setTimeout(() => { if (TM.rec === r && !started && !got) fail('لم يبدأ الميكروفون. اسمح بالميكروفون والتعرف على الكلام، أو اكشف الآيات باللمس.'); }, 6000);
    try { r.start(); } catch (e) { fail('تعذّر تشغيل الميكروفون. اكشف الآيات باللمس.'); return; }
    tmPaint();
  }
  // أزرار شريط التسميع: تستجيب للمس مباشرة (touchend) وللنقر، مرة واحدة لكل لمسة
  function tmBtn(id, fn) {
    const el = $(id); let tt = 0;
    el.addEventListener('touchend', e => { if (el.hidden) return; e.preventDefault(); e.stopPropagation(); tt = Date.now(); fn(); }, { passive: false });
    el.addEventListener('click', e => { e.stopPropagation(); if (Date.now() - tt < 700) return; fn(); });
  }
  tmBtn('#tmMic', () => tmListen(!TM.listening));
  tmBtn('#tmRev', () => { const k = TM.keys[TM.i]; if (k) tmReveal(k, 'tap'); });
  tmBtn('#tmHint', tmHint);
  tmBtn('#tmEnd', tmEnd);
  tmBtn('#tmAgain', () => tmLoad(TM.p));
  tmBtn('#tmNext', () => { if (TM.p < N) goPage(TM.p + 1, true, true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && TM.listening) { tmListen(false); TM.why = 'توقف الاستماع. اضغط «سمّع» للمتابعة.'; tmPaint(); } });
  /* ---------- التفسير: المختصر والسعدي، كما وردا في المصدر بلا أي تعديل ---------- */
  // الملفات لكل سورة في tafsir/{mukhtasar|saadi}/NNN.json، تُحمَّل عند الحاجة وتُخزَّن بعد أول فتح (sw.js)
  const TF = {
    mukhtasar: { name: 'المختصر', title: 'المختصر في تفسير القرآن الكريم', pub: 'مركز تفسير للدراسات القرآنية', key: 'arabic_mokhtasar' },
    saadi: { name: 'السعدي', title: 'تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)', pub: 'الشيخ عبد الرحمن بن ناصر السعدي', key: 'arabic_saadi' }
  };
  const tfCache = new Map();
  function tfLoad(t, s) {
    const id = t + s;
    if (!tfCache.has(id)) tfCache.set(id, fetch(`tafsir/${t}/${String(s).padStart(3, '0')}.json`).then(r => { if (!r.ok) throw new Error('tafsir'); return r.json(); }).catch(e => { tfCache.delete(id); throw e; }));
    return tfCache.get(id);
  }
  let tfKeys = [], tfScope = '';
  const tfWhich = () => (ST.get().tafsir === 'saadi' ? 'saadi' : 'mukhtasar');
  const segHTML = x => x.map(([c, t]) => c ? `<span class="tq-${c}">${esc(t)}</span>` : esc(t)).join('');
  function tfDate(iso) { try { return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso.slice(0, 10); } }
  function tfSource(t, d, s) {
    const m = TF[t];
    return `<p class="tfsrc"><b>${esc(m.title)}</b> · ${esc(m.pub)}<br>المصدر: موسوعة القرآن الكريم ${L('QuranEnc.com')} (${L(m.key)})، منقول كما ورد دون تعديل. ${t === 'mukhtasar' ? 'رقم الإصدار غير منشور في المصدر؛ ' : ''}تاريخ النقل: ${tfDate(d.fetched)}.<br>${L(`<a href="${esc(d.src)}" target="_blank" rel="noopener">${esc(d.src.replace('https://', ''))}</a>`)}</p>`;
  }
  async function tfRender() {
    const t = tfWhich(), body = $('#tfBody');
    $$('#tfSeg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('#tfScope').textContent = tfScope;
    if (!tfKeys.length) { body.innerHTML = ''; return; }
    body.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    const bySura = new Map(); for (const k of tfKeys) { const [s, a] = k.split(':').map(Number); if (!bySura.has(s)) bySura.set(s, []); bySura.get(s).push(a); }
    let html = '';
    try {
      for (const [s, ayat] of bySura) {
        const d = await tfLoad(t, s);
        if (t === 'mukhtasar') {
          for (const a of ayat) {
            const tx = d.t[String(a)];
            html += `<article class="tfa" data-k="${s}:${a}"><h5>${esc(sName(s))} · الآية ${ar(a)}</h5>${tx != null ? `<div class="tftx">${esc(tx)}</div>` : `<p class="muted">لا يوجد نص لهذه الآية في المصدر.</p>`}</article>`;
          }
        } else {
          const B = d.blocks, want = new Set(ayat), used = new Set();
          const hit = i => B[i].k === 'a' && ayat.some(a => a >= B[i].a && a <= B[i].b);
          const shown = new Set();
          for (let i = 0; i < B.length; i++) {
            if (!hit(i)) continue;
            let j = i; while (j > 0 && B[j - 1].k !== 'a') j--;   // ما قبل الفقرة من تمهيد أو نص الآيات يُعرض معها كما في المصدر
            for (let q = j; q <= i; q++) if (!used.has(q)) { used.add(q); const b = B[q];
              if (b.k === 'a') for (let a = b.a; a <= b.b; a++) shown.add(a);
              html += `<article class="tfa tfs-${b.k}" data-k="${s}:${b.k === 'i' ? '' : b.a}">${b.l ? `<h5>${esc(sName(s))} · ${esc(b.l)}</h5>` : ''}<div class="tftx">${segHTML(b.x)}</div></article>`; }
          }
          for (const a of ayat) if (!shown.has(a)) html += `<article class="tfa tfgap" data-k="${s}:${a}"><h5>${esc(sName(s))} · الآية ${ar(a)}</h5><p class="muted">لا توجد في المصدر فقرة مستقلة لهذه الآية.</p></article>`;
        }
        html += tfSource(t, d, s);
      }
      if (tfWhich() === t) body.innerHTML = html;
    } catch (e) { body.innerHTML = '<p class="muted">تعذّر تحميل التفسير. أول فتح لتفسير سورة يحتاج اتصالًا بالإنترنت، ثم يبقى متاحًا بدونه.</p>'; }
  }
  async function openTafsir(keys) {
    if (keys && keys.length) { tfKeys = keys; tfScope = keys.length === 1 ? keyLabel(keys[0]) : rangeLabel(keys[0], keys[keys.length - 1]); }
    else { const pd = await QD.page(cur); tfKeys = pd.ayat.map(a => a.k); tfScope = `صفحة ${ar(cur)} · ${surahsTitle(pd.surahs, 40)}`; }
    openSheet('tafsir'); navOn('tafsir'); $('#tfBody').scrollTop = 0; $('#sh-tafsir .sh-b').scrollTop = 0;
    return tfRender();
  }
  $('#tfSeg').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; ST.set('tafsir', b.dataset.t); $('#sh-tafsir .sh-b').scrollTop = 0; tfRender(); };
  $('#aTafsir').onclick = () => { if (sel) openTafsir(sel.list.slice()); };
  window.__app = { openTafsir, tfState: () => ({ keys: tfKeys.slice(), which: tfWhich(), scope: tfScope }), reloadData: () => { applyTheme(); refreshToday(); notesPaint(cur); updateTitle(); }, toast, tmStart, tmEnd, tmFeed, tmReveal, TM: () => ({ on: TM.on, p: TM.p, keys: TM.keys.slice(), i: TM.i, rv: [...TM.rv], E: TM.E.slice(), prog: TM.prog, why: TM.why, listening: TM.listening, sr: !!SRC, heard: TM.heard.slice(), cut: TM.cut, heardTxt: TM.heardTxt }), openSettings, openTilawa, navOn, notesAll, notesPaint, noteNew, noteOpen, noteClose, openNotes, openHub, openRem, openWird, rem, refit, LS: () => LS, goPage, flip, select, clearSel, chrome, state: () => ({ cur, sel, playingKey, busy, play: AU.state() && AU.state().kind }), keyPage, pageData, cnt, after };
  boot();
})();
