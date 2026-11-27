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
    aya:  { one: 'آية واحدة', oneAcc: 'آيةً واحدةً', two: ['آيتان', 'آيتين'], pl: 'آيات', acc: 'آيةً', sg: 'آية' },
    page: { one: 'صفحة واحدة', oneAcc: 'صفحةً واحدةً', two: ['صفحتان', 'صفحتين'], pl: 'صفحات', acc: 'صفحةً', sg: 'صفحة' },
    line: { one: 'سطر واحد', oneAcc: 'سطرًا واحدًا', two: ['سطران', 'سطرين'], pl: 'أسطر', acc: 'سطرًا', sg: 'سطر' },
    day:  { one: 'يوم واحد', oneAcc: 'يومًا واحدًا', two: ['يومان', 'يومين'], pl: 'أيام', acc: 'يومًا', sg: 'يوم' },
    note: { one: 'ملاحظة واحدة', oneAcc: 'ملاحظةً واحدةً', two: ['ملاحظتان', 'ملاحظتين'], pl: 'ملاحظات', acc: 'ملاحظةً', sg: 'ملاحظة' },
    word: { one: 'كلمة واحدة', oneAcc: 'كلمةً واحدةً', two: ['كلمتان', 'كلمتين'], pl: 'كلمات', acc: 'كلمةً', sg: 'كلمة' },
    surah: { one: 'سورة واحدة', oneAcc: 'سورةً واحدةً', two: ['سورتان', 'سورتين'], pl: 'سور', acc: 'سورةً', sg: 'سورة' },
    marra: { one: 'مرّة واحدة', oneAcc: 'مرّةً واحدةً', two: ['مرّتان', 'مرّتين'], pl: 'مرّات', acc: 'مرّةً', sg: 'مرّة' },
    tasbeeha: { one: 'تسبيحة واحدة', oneAcc: 'تسبيحةً واحدةً', two: ['تسبيحتان', 'تسبيحتين'], pl: 'تسبيحات', acc: 'تسبيحةً', sg: 'تسبيحة' },
    salah: { one: 'صلاة واحدة', oneAcc: 'صلاةً واحدةً', two: ['صلاتان', 'صلاتين'], pl: 'صلوات', acc: 'صلاةً', sg: 'صلاة' },
    step: { one: 'خطوة واحدة', oneAcc: 'خطوةً واحدةً', two: ['خطوتان', 'خطوتين'], pl: 'خطوات', acc: 'خطوةً', sg: 'خطوة' },
    minute: { one: 'دقيقة واحدة', oneAcc: 'دقيقةً واحدةً', two: ['دقيقتان', 'دقيقتين'], pl: 'دقائق', acc: 'دقيقةً', sg: 'دقيقة' }
  };
  /* cnt(5)='5 آيات'، cnt(2)='آيتان'، cnt(2,'aya',true)='آيتين' (بعد حرف جر أو مفعول)، cnt(1,'day','acc')='يومًا واحدًا'، cnt(2,'day','acc')='يومين'، cnt(15)='15 آية'، cnt(100)='100 آية' */
  function cnt(n, w = 'aya', gen = false, compact = false) {   // compact: الأسطر المختصرة (صفوف الفهرس وسطر عدد النتائج) بلا علامة التنوين: «286 آية»؛ ويبقى ما كُتب بألف («يومًا»)
    const f = NOUN[w]; n = +n;
    if (n === 0) return '0 ' + f.pl;   // v26z7: «0 أيام»، «0 صلوات» (المدقق)
    if (n === 1) return (gen === 'acc' && f.oneAcc) || f.one;   // gen='acc': مفعول به («أتممتها يومًا واحدًا من 7»)
    if (n === 2) return f.two[gen ? 1 : 0];
    const r = n % 100;
    const t = n >= 1000 ? n.toLocaleString('en-US') : ar(n);   // فاصلة الآلاف الغربية: 1,240
    if (r >= 3 && r <= 10) return t + ' ' + f.pl;
    if (r >= 11 && r <= 99) return t + ' ' + (compact ? f.acc.replace(/\u064B$/, '') : f.acc);
    return t + ' ' + f.sg;   // 100، 200، 101، 102…
  }
  // الفواصل الفعلية للمراجعة [1،2،4،7،15،30،60] بعد «بعد»
  const AFTER = { 1: 'يومٍ', 2: 'يومين', 4: '4 أيام', 7: 'أسبوع', 15: '15 يومًا', 30: 'شهر', 60: 'شهرين' };
  const after = d => AFTER[d] || cnt(d, 'day', true);

  /* ---------- أدوات ---------- */
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TM = { on: false, p: 0, keys: [], i: 0, rv: new Map(), rec: null, listening: false, acc: [], sess: [], skip: 0, sessBase: 0, sessGone: false, En: null, log: [], empty: 0, everGot: false, drain: null, heardTxt: '', restarts: [], wd: 0, E: [], prog: 0, why: '', mode: 'ayah', flush: false };
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); requestAnimationFrame(() => toastPad(true)); t._h = setTimeout(() => { t.classList.remove('show'); toastPad(false); }, ms); }
  /* الرسالة لا تغطي نصًا: في اللوحات تُضاف مسافة سفلية بقدر الرسالة، وإن كان آخر المحتوى تحتها رُفع فوقها */
  function toastPad(on) {
    document.querySelectorAll('.sh-b.tpad').forEach(b => { b.style.paddingBottom = ''; b.classList.remove('tpad'); });
    if (!on || !document.body.classList.contains('sheet-open')) return;
    const t = $('#toast'), th = t.offsetHeight, ttop = innerHeight - (parseFloat(getComputedStyle(t).bottom) || 0) - th - 10;
    document.querySelectorAll('.sheet:not([hidden]) > .sh-b').forEach(b => {
      const br = b.getBoundingClientRect(); if (!br.height) return;
      const pb = parseFloat(getComputedStyle(b).paddingBottom) || 0;
      b.classList.add('tpad'); b.style.paddingBottom = (pb + Math.max(0, br.bottom - ttop)) + 'px';
      const last = [...b.children].reverse().find(x => x.offsetHeight); if (!last) return;
      const lr = last.getBoundingClientRect();
      if (lr.bottom > ttop && lr.top < br.bottom) b.scrollTop += Math.ceil(lr.bottom - ttop);
    });
  }
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
  function pageVisible(p) { if (p === cur) return true; if (!document.documentElement.classList.contains('spread')) return false; const sp = spreadPair(cur); return sp.left === p || sp.right === p; }
  async function pageOfKey(k) { return keyPage.get(k) || QD.pageOf(k); }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const esc = window.ESC;   // v26z11: دالة التهريب الموحّدة (js/esc.js)
  /* عنوان الصفحة: أسماء السور كلها إن اتسعت، وإلا الأولى — الأخيرة */
  function surahsTitle(ss, max = 26) {
    const names = ss.map(sName), all = names.join(' · ');
    return (names.length > 2 && all.length > max) ? names[0] + ' — ' + names[names.length - 1] : all;
  }

  /* ---------- نافذة تأكيد داخل التطبيق ---------- */
  function ask(msg, yes = 'نعم') {
    return new Promise(res => {
      $('#cfMsg').textContent = msg; $('#cfYes').textContent = yes; $('#cfYes').classList.toggle('red', yes === 'احذف');   // v26z11: الحذف بالأحمر
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
  const PAGE_ASPECT_FULL = 382.68 / 547.09;
  const PAGE_ASPECT_FILL = 0.62;
  const SPREAD_GUTTER = 14;
  const CREDIT_H = 40;
  const WIDE_MIN_W = 768;
  const WIDE_MIN_H = 500;
  const SPREAD_MIN_W = 1000;
  function isWide() { return innerWidth >= WIDE_MIN_W && innerHeight >= WIDE_MIN_H; }
  function spreadPair(p) {
    p = Math.max(1, Math.min(N, p | 0));
    const right = p % 2 === 1 ? p : p + 1;
    const r = right <= N ? right : null;
    const l = r ? r - 1 : p;
    return { left: l >= 1 ? l : null, right: r };
  }
  function wantSpread() {
    if (!isWide()) return false;
    const rd = $('#reader');
    if (!rd) return false;
    const cs = getComputedStyle(rd), H = rd.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), W = rd.clientWidth;
    if (W < SPREAD_MIN_W || H < 240) return false;
    const usableH = Math.max(200, H - 24);
    const aspect = viewFull() ? PAGE_ASPECT_FULL : PAGE_ASPECT_FILL;
    return W >= 2 * aspect * usableH + SPREAD_GUTTER;
  }
  function nextPage(dir) {
    if (!document.documentElement.classList.contains('spread')) return cur + dir;
    const { left, right } = spreadPair(cur);
    if (dir > 0) return Math.min(N, (right || left || cur) + 1);
    return Math.max(1, (left || right || cur) - 1);
  }
  function slotSize(spread) {
    const rd = $('#reader');
    const cs = getComputedStyle(rd), H = rd.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), W = rd.clientWidth;   // v26z10: المساحة الفعلية بعد المشغل وسطر الحقوق
    const usableH = Math.max(200, H - 24);
    const usableW = Math.max(200, W - 40);
    const aspect = viewFull() ? PAGE_ASPECT_FULL : PAGE_ASPECT_FILL;
    if (spread) {
      const maxW = (usableW - SPREAD_GUTTER) / 2;
      let ph = usableH, pw = ph * aspect;
      if (pw > maxW) { pw = maxW; ph = pw / aspect; }
      return { pw, ph, bw: pw * 2 + SPREAD_GUTTER, bh: ph, gutter: SPREAD_GUTTER };
    }
    let ph = usableH, pw = ph * aspect;
    if (pw > usableW) { pw = usableW; ph = pw / aspect; }
    return { pw, ph, bw: pw, bh: ph, gutter: 0 };
  }
  function layout() {
    const wide = isWide();
    const spread = wantSpread();
    const root = document.documentElement;
    root.classList.toggle('wide', wide);
    root.classList.toggle('spread', spread);
    if (wide) {
      const sz = slotSize(spread);
      root.style.setProperty('--pw', sz.pw + 'px');
      root.style.setProperty('--ph', sz.ph + 'px');
      root.style.setProperty('--bw', sz.bw + 'px');
      root.style.setProperty('--bh', sz.bh + 'px');
      root.style.setProperty('--gutter', sz.gutter + 'px');
      PW = sz.pw;
    } else {
      ['--pw', '--ph', '--bw', '--bh', '--gutter'].forEach(k => root.style.removeProperty(k));
      // v26z10: الجوال أفقيًا — الصفحة بعرض الشاشة كاملًا وتمرير رأسي، دون تصغير الخط (قرار سابق)
      const land = innerWidth > innerHeight && innerHeight < WIDE_MIN_H;
      root.classList.toggle('land', land);
      if (land) root.style.setProperty('--landh', Math.round(innerWidth / PAGE_ASPECT_FILL) + 'px'); else root.style.removeProperty('--landh');
      const R = book.getBoundingClientRect(); PW = R.width || innerWidth;
    }
    if (cur) showOnly(cur);
  }
  function reserve() {   // شريط الآية والمشغل لا يغطيان الصفحة: نصغّر مساحة الصفحة
    const t = $('#tool'), pl = $('#player');
    const h = Math.max(t.hidden ? 0 : t.offsetHeight + 16, pl.hidden ? 0 : pl.offsetHeight + 16);
    document.documentElement.style.setProperty('--reserve', h + 'px');
    if (!pl.hidden && pl.offsetHeight) document.documentElement.style.setProperty('--plh', pl.offsetHeight + 'px');
    requestAnimationFrame(layout); refitSoon();
  }
  /* v26z10: إعادة الملاءمة بعد ظهور المشغل أو اختفائه أو تغيّر شريط سفاري أو الاتجاه — مؤجّلة حتى تنتهي الحركة (لا رسم للصفحة في كل إطار) */
  let refitT = 0;
  function refitSoon(ms) { clearTimeout(refitT); refitT = setTimeout(() => { layout(); showOnly(cur); requestAnimationFrame(() => { refit(); notesPaintVisible(cur); }); }, ms || 260); }
  const NS = 'http://www.w3.org/2000/svg';
  /* المسافة بين الأسطر: الأسطر الـ15 كما هي من صفحة المجمع (نفس الكلمات في كل سطر)،
     تُوزَّع رأسيًا لتملأ طول الشاشة كما في المصحف المطبوع، والعرض يملأ الشاشة. */
  let LS = null;
  function measureLS(el) {
    const pg = el.querySelector('.pg'), ph = pg && pg.querySelector('.ph'), pf = pg && pg.querySelector('.pf');
    if (!ph) return null;
    const cs = getComputedStyle(pg);
    const rc = document.documentElement.classList, box = rc.contains('wide') ? pg : rc.contains('land') ? $('.book') : $('#reader');   // v26z10: الجوال أفقيًا: ارتفاع الصفحة بعرض الشاشة
    const H = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (ph.offsetHeight || 26) - (pf.offsetHeight || 40);
    const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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
  /* تظليل الآية (المحددة/المتلوّة): مستطيل لطيف بزوايا مستديرة لكل سطر، على حدود كلمات الآية فقط (data/tmk.json)،
   * لا يمتد إلى طرف السطر، ويتوقف قبل فاصلة الآية فلا يلوّنها. في «الصفحة بإطارها» يبقى التظليل القديم. */
  /* قطع الآيات على مسار القراءة لصفحة: لكل سطر من الأعلى، ولكل آية من اليمين إلى اليسار، على حدود كلماتها،
   * وتتوقف قبل فاصلة الآية. بإحداثيات svg.tx بعد تباعد الأسطر. */
  function hlPieces(p, pd) {
    const data = TMK && TMK[p]; if (!data) return null;
    const L = pd.lines, s = LS || 0, D = L ? L.D : 0, p12 = !L, out = [];
    for (const ln of data) {
      const dy = (!p12 && ln.i != null) ? ln.i * (s - D) : 0;
      for (const sg of ln.segs) {
        let x0 = sg[1], x1 = sg[2];
        if (!p12 && ln.xa != null) { x0 = Math.max(x0, ln.xa - 0.5); x1 = Math.min(x1, ln.xb + 0.5); }
        for (const m of ln.m || []) {
          if (m[1] <= x0 || m[0] >= x1) continue;
          if ((m[0] + m[1]) / 2 < (x0 + x1) / 2) x0 = Math.max(x0, m[1] + 1.2); else x1 = Math.min(x1, m[0] - 1.2);
        }
        x0 += 0.7; x1 -= 0.7;
        if (x1 - x0 < 4) continue;
        const y0 = sg.length > 3 ? sg[3] - 1 : ln.y0 + 3, y1 = sg.length > 3 ? sg[4] + 1 : ln.y1 - 3;
        out.push({ k: sg[0], x0, x1, y0: y0 + dy, y1: y1 + dy, m: ln.m || [], li: ln.i });
      }
    }
    // لا يتداخل تظليل سطر مع السطر الذي يليه: إن تقاربا نقسم المسافة بينهما
    if (!p12) {
      const by = new Map(); for (const c of out) { if (c.li == null) continue; const b = by.get(c.li) || [Infinity, -Infinity]; b[0] = Math.min(b[0], c.y0); b[1] = Math.max(b[1], c.y1); by.set(c.li, b); }
      for (const [i, b] of by) {
        const n = by.get(i + 1); if (!n || b[1] + 0.8 <= n[0]) continue;
        const mid = (b[1] + n[0]) / 2;
        for (const c of out) { if (c.li === i) c.y1 = Math.min(c.y1, mid - 0.4); else if (c.li === i + 1) c.y0 = Math.max(c.y0, mid + 0.4); }
      }
    }
    return out;
  }
  function hlRx(svg, pd) { const sc = svg.getBoundingClientRect().width ? tmMap(svg).s : (PW || 390) / pd.crop[2]; return Math.max(2.4, Math.min(6, 7 / sc)); }
  /* تظليل الآية المحددة: مستطيل لطيف مستدير لكل سطر، 10% بلون الثيم. في «الصفحة بإطارها» يبقى التظليل القديم. */
  function hlBuild(el, p, pd) {
    const svg = el.querySelector('svg.tx'); if (!svg) return;
    let g = svg.querySelector('g.hl');
    if (!TMK && !viewFull()) tmkLoad();   // إن تأخر تحميل الحدود أو فشل نعيد المحاولة
    const pcs = !viewFull() && hlPieces(p, pd);
    if (!pcs) { if (g) g.remove(); const k = svg.querySelector('g.snk'); if (k) k.remove(); svg.classList.remove('hasHL'); return; }
    const rx = hlRx(svg, pd).toFixed(2);
    const out = pcs.map(c => `<rect data-k="${c.k}" x="${c.x0.toFixed(2)}" y="${c.y0.toFixed(2)}" width="${(c.x1 - c.x0).toFixed(2)}" height="${(c.y1 - c.y0).toFixed(2)}" rx="${rx}"/>`).join('');
    const hot = svg.querySelector('g.hot');
    if (!g) {
      g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'hl'); g.setAttribute('aria-hidden', 'true');
      if (hot && hot.getAttribute('clip-path')) g.setAttribute('clip-path', hot.getAttribute('clip-path'));
      svg.insertBefore(g, hot);
      const k = document.createElementNS(NS, 'g'); k.setAttribute('class', 'snk'); k.setAttribute('aria-hidden', 'true');
      if (hot && hot.getAttribute('clip-path')) k.setAttribute('clip-path', hot.getAttribute('clip-path'));
      svg.insertBefore(k, hot);
    }
    if (g.__sig !== out) { g.innerHTML = out; g.__sig = out; delete el.__snkPath; }
    svg.classList.add('hasHL'); paint(el);
    if (SNK.p === p) snkFrame(true);
  }

  /* ---------- تظليل التلاوة المتحرك: شريط ناعم يمشي مع الصوت على مسار القراءة ----------
   * الرأس يتقدم بانسياب مع وقت التلاوة (توقيت الآيات، وداخل الآية خطيًا)، بحافة متدرجة ناعمة،
   * والذيل يلحقه على بعد نحو آيتين ونصف ويمحو من بداية المقطع تدريجيًا، بطرف يتلاشى. */
  const SNK = { p: 0, raf: 0, H: null, T: null, uReset: 0, lastU: -1, last: 0, el: null };
  const SNK_FH = 9; let SNK_A = 0.30;   // v26z3: 30% ذهبي العلامة في الفاتح، و10% أبيض في الليلي والزجاجي
  function snkPath(el, p, pd) {
    if (el.__snkPath) return el.__snkPath;
    const pcs = hlPieces(p, pd); if (!pcs) return null;
    let d = 0; const rng = new Map(), lines = [];
    for (const c of pcs) {
      c.ds = d; d += c.x1 - c.x0; c.de = d;
      const r = rng.get(c.k); if (r) r[1] = c.de; else rng.set(c.k, [c.ds, c.de]);
      const ln = lines[lines.length - 1];
      if (ln && Math.abs(ln.y - c.y0) < 6) ln.de = c.de; else lines.push({ y: c.y0, ds: c.ds, de: c.de });
    }
    return (el.__snkPath = { pcs, rng, lines, len: d, keys: [...rng.keys()] });
  }
  /* موضع التلاوة كرقم متصل: رقم الآية في القائمة + نسبة ما مضى منها */
  function snkU() {
    const st = AU.state(); if (!st || st.notime) return null;
    const i = st.i, k = st.keys[i];
    let f = 0;
    if (st.full && st.idx) {
      const x = st.full.t[st.idx.get(k)], t = AU.el.currentTime * 1000;
      if (st.want != null) f = 0; else f = (t - x[1]) / Math.max(1, x[2] - x[1]);
      // قبل بداية الآية في الملف (الاستعاذة والبسملة عند بعض القراء، مثل ماهر المجوّد): لا شريط بعد، ويبقى تظليل الآية الثابت ظاهرًا
      if (st.want == null && t < x[1] - 40) return { pre: true, st };
    } else if (AU.el.duration > 0) f = AU.el.currentTime / AU.el.duration;
    return { u: i + Math.max(0, Math.min(1, f)), st };
  }
  function snkDist(P, st, u) {
    const j = Math.floor(u), fr = u - j, k = st.keys[Math.min(j, st.keys.length - 1)];
    const r = P.rng.get(k);
    if (r) return j >= st.keys.length ? r[1] : r[0] + fr * (r[1] - r[0]);
    // الآية خارج الصفحة: قبلها = بداية الصفحة، بعدها = نهايتها
    const first = P.keys[0], fi = st.keys.indexOf(first);
    return (fi >= 0 && j < fi) ? 0 : P.len;
  }
  /* مزامنة الرأس مع وتيرة القارئ: نربط زمن كل كلمة بموضعها على السطر الذي كُتبت فيه في صفحة المصحف.
   * data/wl.json: لكل آية [[الصفحة, [عدد حروف كل كلمة في هذا السطر]], ...] بترتيب الأسطر (تخطيط مصحف المدينة كما في Quran Foundation).
   * توقيت الكلمات: مقاطع Quran Foundation للقراء المتاحين، أو توقيت الكلمات المولّد (ماهر المرتل، بدر التركي)،
   * وإلا نوزع زمن الآية على كلماتها بعدد الحروف. فيبلغ الرأس نهاية السطر مع آخر كلمة فيه. */
  let WL = null, wlP = null;
  function wlLoad() { if (WL || wlP) return; wlP = fetch('data/wl.json').then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => { WL = d; }).catch(() => { wlP = null; }); }
  // أزمنة كلمات الآية [[بداية, نهاية], ...] بزمن ملف الصوت الحالي
  const AWC = new Map();
  function ayahWords(st, k) {
    const g = WL && WL[k]; if (!g) { wlLoad(); return null; }
    let x0, x1, wt = null, src;
    if (st.full && st.idx) { const x = st.full.t[st.idx.get(k)]; if (!x) return null; x0 = x[1]; x1 = x[2]; wt = x[3] || null; src = st.full; }
    else { const d = AU.el.duration; if (!(d > 0)) return null; x0 = 0; x1 = d * 1000; src = AU.el.currentSrc; }
    const c0 = AWC.get(k); if (c0 && c0.src === src && c0.x1 === x1) return c0;
    const lets = g.flatMap(z => z[1]);
    // توقيت كلمات خارج حدود الآية (خلل في مصدر المقاطع، مثل إزاحة آيتين عند بعض القراء): لا نثق به ونوزّع بالحروف
    if (wt && wt.length && wt.some(v => v && (v[0] > x1 + 1500 || v[0] < x0 - 1500))) wt = null;
    if (!wt || wt.length !== lets.length || wt.some(v => !v)) {
      const tot = lets.reduce((a, b) => a + b, 0) || 1; let c = 0;
      wt = lets.map(l => { const a = x0 + (x1 - x0) * c / tot; c += l; return [a, x0 + (x1 - x0) * c / tot]; });
    }
    // آخر كلمة تنتهي قبل حدّ الآية بقليل، فيبلغ الرأس نهاية السطر قبل الانتقال (مهم في آخر سطر من الصفحة)
    wt = wt.map(v => [Math.min(Math.max(v[0], x0), x1), Math.min(Math.max(v[1], x0), x1)]);
    const L = wt[wt.length - 1]; if (L && L[1] > x1 - 90 && x1 - 90 > L[0]) wt = wt.slice(0, -1).concat([[L[0], x1 - 90]]);
    const pg = g.flatMap(z => z[1].map(() => z[0]));
    const o = { src, x1, wt, pg, g }; if (AWC.size > 400) AWC.clear(); AWC.set(k, o); return o;
  }
  // صفحة الكلمة التي يتلوها القارئ الآن (لآية تمتد على صفحتين)
  function wordPage(st, k) {
    const W = ayahWords(st, k); if (!W || W.pg[0] === W.pg[W.pg.length - 1]) return 0;
    if (st.want != null) return W.pg[0];
    const t = AU.el.currentTime * 1000; let p = W.pg[0];
    for (let i = 0; i < W.wt.length; i++) { if (W.wt[i][0] <= t) p = W.pg[i]; else break; }
    return p;
  }
  function snkKnots(P, p, st, k) {
    const W = ayahWords(st, k); if (!W) return null;
    const g = W.g, wt = W.wt, src = W.src, x1 = W.x1;
    P.kc = P.kc || new Map();
    const c0 = P.kc.get(k); if (c0 && c0.src === src && c0.x1 === x1) return c0.kn;
    const pcs = P.pcs.filter(c => c.k === k); if (!pcs.length) return null;
    const first = []; let w0 = 0; g.forEach(z => { first.push(w0); w0 += z[1].length; });
    const gi = []; g.forEach((z, i) => { if (z[0] === p) gi.push(i); });
    const kn = [];
    const lay = (wi, ls, ds, de) => {
      const tot = ls.reduce((a, b) => a + b, 0) || 1; let c = 0;
      ls.forEach((l, j) => { const a = ds + (de - ds) * c / tot; c += l; const t = wt[wi + j]; kn.push([t[0], a], [t[1], ds + (de - ds) * c / tot]); });
    };
    if (gi.length === pcs.length) gi.forEach((i, j) => lay(first[i], g[i][1], pcs[j].ds, pcs[j].de));
    else { const use = gi.length ? gi : g.map((_, i) => i); lay(first[use[0]], use.flatMap(i => g[i][1]), pcs[0].ds, pcs[pcs.length - 1].de); }
    for (let i = 1; i < kn.length; i++) { if (kn[i][0] < kn[i - 1][0]) kn[i][0] = kn[i - 1][0]; if (kn[i][1] < kn[i - 1][1]) kn[i][1] = kn[i - 1][1]; }
    P.kc.set(k, { src, x1, kn });
    return kn;
  }
  function snkHead(P, p, st, u) {
    const k = st.keys[Math.min(Math.floor(u), st.keys.length - 1)];
    if (Math.floor(u) < st.keys.length && P.rng.has(k)) {
      const kn = snkKnots(P, p, st, k);
      if (kn && kn.length) {
        if (st.want != null) return kn[0][1];
        const t = st.full && st.idx ? AU.el.currentTime * 1000 : AU.el.currentTime * 1000;
        if (t <= kn[0][0]) return kn[0][1];
        for (let i = 1; i < kn.length; i++) if (t <= kn[i][0]) { const a = kn[i - 1], b = kn[i]; return b[0] > a[0] ? a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]) : b[1]; }
        return kn[kn.length - 1][1];
      }
    }
    return snkDist(P, st, u);
  }
  function snkClear(el) { const g = el && el.querySelector('g.snk'); if (g) g.innerHTML = ''; if (el) el.querySelector('svg.tx') && el.querySelector('svg.tx').classList.remove('snk-on'); }
  function snkFrame(force) {
    const now = performance.now(), dt = Math.min(0.1, (now - (SNK.last || now)) / 1000); SNK.last = now;
    const pu = snkU();
    if (!pu || viewFull() || !TMK || TM.on) { if (SNK.el) snkClear(SNK.el); SNK.el = null; SNK.p = 0; if (viewFull() || !TMK || TM.on || (pu === null && AU.state() && AU.state().notime)) document.body.classList.remove('snkm'); return; }
    if (pu.pre) { if (SNK.el) snkClear(SNK.el); SNK.H = null; SNK.T = null; return; }
    const { u, st } = pu, k = st.keys[st.i];
    // آية تمتد على صفحتين: الشريط على صفحة الكلمة التي يتلوها القارئ، والصفحة تتقلب معه عند أول كلمة في الصفحة التالية
    const wp = wordPage(st, k);
    const p = wp || keyPage.get(k) || cur, el = leaves.get(p), pd = pageData.get(p);
    if (wp && wp !== cur && !pageVisible(wp) && !busy && !AU.el.paused && SNK.turn !== k + '@' + wp) { SNK.turn = k + '@' + wp; goPage(wp, true, false); }
    if (!el || !pd) return;
    const P = snkPath(el, p, pd); if (!P) return;
    // صفحة جديدة أو قفزة للخلف (تكرار/رجوع): نبدأ نظيفًا من بداية الآية الحالية
    if (SNK.p !== p || u < SNK.lastU - 0.02) { if (SNK.el && SNK.el !== el) snkClear(SNK.el); SNK.p = p; SNK.el = el; SNK.uReset = Math.floor(u); SNK.H = null; SNK.T = null; }
    SNK.lastU = u;
    const Ht = snkHead(P, p, st, u);
    // تنعيم خفيف جدًا (نحو 30ms) يمحو تقطع تحديث وقت الصوت دون أن يتأخر الرأس عن القارئ
    const ease = (v, t, tau) => (v == null || Math.abs(t - v) > 220) ? t : v + (t - v) * (1 - Math.exp(-dt / tau));
    SNK.Ht = Ht;
    SNK.H = force && SNK.H != null ? SNK.H : ease(SNK.H, Ht, 0.03);
    const H = SNK.H;
    // سطر واحد فقط: الرأس يمشي على السطر، والذيل يلحقه داخل السطر نفسه حتى يلتقيا عند نهايته، ثم يبدأ السطر التالي نظيفًا
    const ln = P.lines.find(l => H >= l.ds - 0.01 && H <= l.de + 0.01) || P.lines.find(l => H < l.ds) || P.lines[P.lines.length - 1];
    const W = Math.max(1, ln.de - ln.ds), q = Math.max(0, Math.min(1, (H - ln.ds) / W));
    // الذيل ثابت عند بداية السطر حتى يبلغ الرأس منتصفه، ثم يمحو من البداية بسرعة أكبر فيلتقيان عند نهاية السطر.
    // tail = p<0.5 ? 0 : (p-0.5)*2، مع بداية لينة (x²(2-x)) حتى لا ينطلق فجأة
    const x = q < 0.5 ? 0 : (q - 0.5) * 2, tq = x * x * (2 - x);
    const T = Math.max(ln.ds, Math.min(H, ln.ds + W * tq));
    SNK.T = T; SNK.ln = ln;
    const g = el.querySelector('g.snk'), svg = el.querySelector('svg.tx');
    if (!g) return;
    svg.classList.add('snk-on'); document.body.classList.add('snkm');
    // v26z3: الفاتح ذهبي العلامة 30%، والليلي والزجاجي أبيض 10% (طلب فهد)
    SNK_A = document.documentElement.classList.contains('dark') ? 0.10 : 0.30;
    const FT = Math.max(2, Math.min(60, (H - T) * 0.45, (T - ln.ds) + 2));
    const alpha = d => SNK_A * Math.max(0, Math.min(1, (H - d) / SNK_FH)) * Math.max(0, Math.min(1, (d - T) / FT));
    const rx = hlRx(svg, pd).toFixed(2);
    let defs = '', body = '', n = 0;
    for (const c of P.pcs) {
      if (c.de < ln.ds - 0.01 || c.ds > ln.de + 0.01) continue;
      const a = Math.max(c.ds, T), b = Math.min(c.de, H);
      if (b - a < 0.6) continue;
      const xl = c.x1 - (b - c.ds), xr = c.x1 - (a - c.ds), w = xr - xl;
      // تدرج أفقي: الحافة الأمامية ناعمة، والذيل يتلاشى
      const pts = [a, b, H - SNK_FH, T + FT].filter(d => d >= a && d <= b).sort((m, q) => q - m);
      const stops = pts.map(d => `<stop offset="${((b - d) / (b - a)).toFixed(4)}" stop-opacity="${alpha(d).toFixed(4)}"/>`).join('');
      const id = `snk${p}_${n++}`;
      defs += `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient>`;
      body += `<rect x="${xl.toFixed(2)}" y="${c.y0.toFixed(2)}" width="${w.toFixed(2)}" height="${(c.y1 - c.y0).toFixed(2)}" rx="${Math.min(+rx, w / 2).toFixed(2)}" fill="url(#${id})"/>`;
    }
    g.innerHTML = `<defs>${defs}</defs>${body}`;
  }
  function snkLoop() { cancelAnimationFrame(SNK.raf); const step = () => { snkFrame(); if (!AU.el.paused && AU.state()) SNK.raf = requestAnimationFrame(step); }; SNK.raf = requestAnimationFrame(step); }
  function snkState(s) {
    if (s === 'playing') snkLoop();
    else if (s === 'paused') { cancelAnimationFrame(SNK.raf); snkFrame(true); }
    else { cancelAnimationFrame(SNK.raf); const el = SNK.el; SNK.el = null; SNK.p = 0; SNK.H = SNK.T = null; if (el) { const g = el.querySelector('g.snk'); if (g) { g.classList.add('out'); setTimeout(() => { g.classList.remove('out'); if (!SNK.el || SNK.el !== el) snkClear(el); }, 380); } } }
  }
  function fitLeaf(el, p, pd) {
    const L = pd.lines;
    if (viewFull() || !L) { hlBuild(el, p, pd); if (TM.on) tmPaintOverlay(el); return; }
    if (LS == null) { const m = measureLS(el); if (!m || m.W <= 0) { if (TM.on) tmPaintOverlay(el); return; } const [, , w, h] = pd.crop; const base = Math.max(0, Math.min(14, (m.H / m.W * w - h) / 14));
      // توسيع طفيف لما بين الأسطر حتى لا يلامس التظليل السطر المجاور: حتى 6 وحدات، وبزيادة لا تتجاوز 1.5 (أقل من 5% من ارتفاع الصفحة)
      LS = Math.min(14, Math.max(base, Math.min(6, base + 1.5))); }
    const s = LS, [x, y, w, h] = pd.crop, svg = el.querySelector('svg.tx');
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h + 14 * s}`);
    const ov = el.querySelector('svg.tm-ov'); if (ov) ov.setAttribute('viewBox', svg.getAttribute('viewBox'));
    const fo = el.querySelector('svg.sfr-ov'); if (fo) { fo.setAttribute('viewBox', svg.getAttribute('viewBox')); fo.querySelectorAll('rect').forEach(r => r.setAttribute('transform', `translate(0 ${(+r.dataset.i * (s - L.D)).toFixed(3)})`)); }
    el.querySelectorAll('g.st').forEach((g, i) => g.setAttribute('transform', `translate(0 ${(i * (s - L.D)).toFixed(3)})`));
    const byK = new Map(pd.ayat.map(a => [a.k, a.d]));
    el.querySelectorAll('g.hot path').forEach(pa => pa.setAttribute('d', shiftPath(byK.get(pa.dataset.k), L.m, s)));
    hlBuild(el, p, pd);
    if (TM.on) tmPaintOverlay(el);
  }
  function refit() { LS = null; for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd && el.style.display !== 'none') fitLeaf(el, p, pd); } for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd) fitLeaf(el, p, pd); } }
  // مواضع الأحزاب والأرباع (بداية كل ربع حزب، 240 موضعًا، من بيانات Tanzil hizbQuarter المطابقة لعلامات طبعة المدينة) → رقم الصفحة
  const HZQ = (() => { const o = {}; '1:0,5:1,7:2,9:3,11:4,14:5,17:6,19:7,22:8,24:9,27:10,29:11,32:12,34:13,37:14,39:15,42:16,44:17,46:18,49:19,51:20,54:21,56:22,59:23,62:24,64:25,67:26,69:27,72:28,74:29,77:30,79:31,82:32,84:33,87:34,89:35,92:36,94:37,97:38,100:39,102:40,104:41,106:42,109:43,112:44,114:45,117:46,119:47,121:48,124:49,126:50,129:51,132:52,134:53,137:54,140:55,142:56,144:57,146:58,148:59,151:60,154:61,156:62,158:63,162:64,164:65,167:66,170:67,173:68,175:69,177:70,179:71,182:72,184:73,187:74,189:75,192:76,194:77,196:78,199:79,201:80,204:81,206:82,209:83,212:84,214:85,217:86,219:87,222:88,224:89,226:90,228:91,231:92,233:93,236:94,238:95,242:96,244:97,247:98,249:99,252:100,254:101,256:102,259:103,262:104,264:105,267:106,270:107,272:108,275:109,277:110,280:111,282:112,284:113,287:114,289:115,292:116,295:117,297:118,299:119,302:120,304:121,306:122,309:123,312:124,315:125,317:126,319:127,322:128,324:129,326:130,329:131,332:132,334:133,336:134,339:135,342:136,344:137,347:138,350:139,352:140,354:141,356:142,359:143,362:144,364:145,367:146,369:147,371:148,374:149,377:150,379:151,382:152,384:153,386:154,389:155,392:156,394:157,396:158,399:159,402:160,404:161,407:162,410:163,413:164,415:165,418:166,420:167,422:168,425:169,426:170,429:171,431:172,433:173,436:174,439:175,442:176,444:177,446:178,449:179,451:180,454:181,456:182,459:183,462:184,464:185,467:186,469:187,472:188,474:189,477:190,479:191,482:192,484:193,486:194,488:195,491:196,493:197,496:198,499:199,502:200,505:201,507:202,510:203,513:204,515:205,517:206,519:207,522:208,524:209,526:210,529:211,531:212,534:213,536:214,539:215,542:216,544:217,547:218,550:219,553:220,554:221,558:222,560:223,562:224,564:225,566:226,569:227,572:228,575:229,577:230,579:231,582:232,585:233,587:234,589:235,591:236,594:237,596:238,600:239'.split(',').forEach(s => { const [p, q] = s.split(':'); o[p] = +q; }); return o; })();
  function hzLabel(p) { const q = HZQ[p]; if (q == null) return ''; return ['الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'][q & 3] + ' ' + ((q >> 2) + 1); }
  /* v26z7: زخارف الإطار وعلامات الآيات في الليلي والزجاجي بلا بنّي — تُحسب مرة واحدة لكل صفحة وتُخزَّن:
     نقرأ صورة الأسطر في لوحة رسم، ونأخذ البكسلات الملوّنة فقط (R−B كبير؛ الحروف محايدة فلا تُؤخذ أبدًا)،
     ونحوّلها إلى رمادي محايد في صورة شفافة تُرسم فوق الصورة الأصلية. بعد عكس الصفحة: التعبئة #1F2120 والخطوط #EAEAEA بنحو 60%.
     لا مرشّح يُعاد حسابه مع كل إطار من شريط التتبع (هذا ما أبطأ v26z4). الصورة الأصلية وبكسلات الحروف كما هي. */
  const ORN = new Map(), ORNQ = [];
  let ornBusy = false;
  const ornOn = () => document.documentElement.classList.contains('dark') && !viewFull();
  function ornHref(p) { const u = ORN.get(p); return typeof u === 'string' ? u : ''; }
  function ornApply(p) { const el = leaves.get(p), u = ornHref(p); if (el && u) el.querySelectorAll('image.porn').forEach(i => { if (i.getAttribute('href') !== u) i.setAttribute('href', u); }); }
  function ornMake(src) {
    return new Promise((res, rej) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => {
        try {
          const w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
          const d = x.getImageData(0, 0, w, h), a = d.data;
          for (let i = 0; i < a.length; i += 4) {
            const A = a[i + 3];
            if (A < 64) { a[i + 3] = 0; continue; }
            const m = (12 * (a[i] - a[i + 2])) / 255 - 0.6;
            if (m <= 0) { a[i + 3] = 0; continue; }
            const g = Math.max(0, Math.min(255, Math.round(0.983 * a[i + 1] + 1.02)));
            a[i] = a[i + 1] = a[i + 2] = g; a[i + 3] = Math.round(A * (m > 1 ? 1 : m));
          }
          x.putImageData(d, 0, 0);
          c.toBlob(b => { c.width = c.height = 0; b ? res(URL.createObjectURL(b)) : rej(new Error('blob')); }, 'image/png');
        } catch (e) { rej(e); }
      };
      im.onerror = () => rej(new Error('img')); im.src = src;
    });
  }
  function ornPump() {
    if (ornBusy || !ORNQ.length) return;
    const [p, src] = ORNQ.shift(); if (ORN.has(p)) return ornPump();
    ornBusy = true; ORN.set(p, 0);
    const go = () => ornMake(src).then(u => {
      ORN.set(p, u);
      // أحدث 12 صفحة فقط في الذاكرة
      const ks = [...ORN.keys()]; while (ks.length > 12) { const k = ks.shift(); if (Math.abs(k - cur) > 3) { const v = ORN.get(k); if (typeof v === 'string') URL.revokeObjectURL(v); ORN.delete(k); } }
      ornApply(p);
    }).catch(() => ORN.delete(p)).finally(() => { ornBusy = false; setTimeout(ornPump, 30); });
    (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 400 }) : setTimeout(go, 30));
  }
  function ornWant(p) { const pd = pageData.get(p); if (!ornOn() || !pd || !pd.lines || viewFull() || ORN.has(p)) return; if (!ORNQ.some(q => q[0] === p)) ORNQ.push([p, pd.timg]); ornPump(); }
  function ornAll() { if (!ornOn()) return; const ps = [...leaves.keys()].sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur)); for (const p of ps) { if (ORN.has(p) && typeof ORN.get(p) === 'string') ornApply(p); else ornWant(p); } }
  // v26z3: الحدود الخارجية لإطارات أسماء السور (بوحدات الصفحة، مستخرجة من صور الأسطر بـ tools/build_frames.py)؛ خط ذهبي رفيع فوقها في الليلي والزجاجي فقط
  const SFR = {"50":[[89.211,70.452,250.619,29.664]],"77":[[42.751,70.452,250.619,29.664]],"106":[[89.211,259.562,250.619,28.356]],"128":[[89.211,70.452,250.619,29.664]],"151":[[42.751,70.452,250.619,29.664]],"177":[[42.751,70.452,250.619,29.446]],"187":[[42.751,70.452,250.619,29.664]],"208":[[89.211,70.452,250.619,29.664]],"221":[[42.751,289.226,250.619,28.574]],"235":[[42.751,343.974,250.619,28.574]],"249":[[42.751,70.452,250.619,29.664]],"255":[[42.751,132.398,250.619,28.356]],"262":[[89.211,70.452,250.619,29.446]],"267":[[42.751,265.451,250.619,28.356]],"282":[[89.211,70.452,250.619,29.664]],"293":[[42.751,377.565,250.619,28.574]],"305":[[42.751,70.452,250.619,29.664]],"312":[[89.211,217.465,250.619,28.356]],"322":[[89.211,70.452,250.619,29.664]],"332":[[89.211,70.452,250.619,29.228]],"342":[[89.211,70.452,250.619,29.01]],"350":[[89.211,70.452,250.619,29.664]],"359":[[42.751,413.773,250.619,28.356]],"367":[[42.751,70.452,250.619,29.664]],"377":[[42.751,70.452,250.619,29.664]],"385":[[42.751,295.988,250.619,28.792]],"396":[[89.648,336.777,250.838,28.137]],"404":[[89.211,397.85,250.619,28.792]],"411":[[42.751,70.452,250.619,29.664]],"415":[[42.751,70.452,250.619,29.664]],"418":[[89.211,70.452,250.619,29.664]],"428":[[89.211,70.452,250.619,29.01]],"434":[[89.211,323.035,250.619,28.792]],"440":[[89.211,181.039,250.619,28.574]],"446":[[89.211,70.452,250.619,29.664]],"453":[[42.751,70.452,250.619,29.228]],"458":[[89.211,170.569,250.619,28.792]],"467":[[42.751,144.613,250.619,28.792]],"477":[[42.751,70.452,250.619,29.664]],"483":[[42.751,70.452,250.619,29.664]],"489":[[42.751,219.646,250.619,28.792]],"496":[[89.211,70.452,250.619,29.664]],"499":[[42.751,70.452,250.619,29.664]],"502":[[89.211,266.324,250.619,28.792]],"507":[[42.751,70.452,250.619,29.664]],"511":[[42.751,70.452,250.619,29.228]],"515":[[42.751,262.398,250.619,28.356]],"518":[[89.211,70.452,250.619,29.446]],"520":[[89.211,479.645,250.619,28.792]],"523":[[42.751,316.055,250.619,28.574]],"526":[[89.211,70.452,250.619,29.228]],"528":[[89.211,383.454,250.619,28.356]],"531":[[42.751,205.469,250.619,28.792]],"534":[[89.211,274.831,250.619,28.792]],"537":[[42.751,397.414,250.619,28.792]],"542":[[89.211,70.452,250.619,29.664]],"545":[[42.751,263.488,250.619,28.356]],"549":[[42.751,70.452,250.619,29.228]],"551":[[42.751,282.901,250.619,28.574]],"553":[[42.751,70.452,250.619,29.228]],"554":[[89.211,283.992,250.619,28.792]],"556":[[89.211,70.452,250.619,29.664]],"558":[[89.211,70.452,250.619,29.664]],"560":[[89.211,70.452,250.619,29.664]],"562":[[89.211,70.452,250.619,29.664]],"564":[[90.084,255.418,249.093,28.574]],"566":[[89.211,385.417,250.619,28.356]],"568":[[89.211,371.676,250.619,28.792]],"570":[[89.211,211.14,250.619,28.137]],"572":[[89.211,70.452,250.619,29.664]],"574":[[89.211,70.452,250.619,29.446]],"575":[[42.751,323.253,250.619,28.137]],"577":[[42.751,249.311,250.619,28.356]],"578":[[89.211,360.988,250.619,28.356]],"580":[[89.211,269.159,250.619,28.137]],"582":[[89.211,70.452,250.619,29.228]],"583":[[42.751,296.643,250.619,28.574]],"585":[[42.751,70.452,250.619,29.664]],"586":[[89.211,109.06,250.619,28.137]],"587":[[42.751,70.452,250.619,29.446],[42.751,452.38,250.619,28.574]],"589":[[42.751,133.489,250.619,28.137]],"590":[[89.211,105.57,250.619,28.792]],"591":[[42.751,70.452,250.619,29.228],[42.751,369.494,250.619,28.574]],"592":[[89.211,198.052,250.619,28.792]],"593":[[42.751,136.106,250.619,28.792]],"594":[[89.211,232.297,250.619,28.356]],"595":[[42.751,103.607,250.619,28.356],[42.751,374.947,250.619,28.356]],"596":[[89.211,225.317,250.619,28.574],[89.211,440.383,250.619,28.137]],"597":[[42.751,138.724,250.619,28.792],[42.751,331.105,250.619,28.356]],"598":[[89.211,185.62,250.619,28.137],[89.211,373.857,250.619,28.792]],"599":[[42.751,242.767,250.619,28.137],[42.751,445.836,250.619,28.137]],"600":[[89.211,172.751,250.619,28.792],[89.211,406.793,250.619,28.137]],"601":[[42.751,70.452,250.619,29.664],[42.751,223.354,250.619,28.356],[42.751,450.199,250.619,28.792]],"602":[[89.211,70.452,250.619,29.664],[89.211,235.351,250.619,28.792],[89.211,426.206,250.619,28.356]],"603":[[42.751,70.016,250.619,29.664],[42.751,252.364,250.619,28.574],[42.751,431.44,250.619,28.356]],"604":[[89.211,70.234,250.619,29.664],[89.211,199.579,250.619,28.356],[89.211,359.025,250.619,28.792]]};
  function leafHTML(p, pd) {
    const full = viewFull();
    const vb = full ? [0, 0, pd.w, pd.h] : pd.crop;
    const img = full ? pd.img : pd.timg;
    const clip = (!full && p <= 2) ? `<clipPath id="cc${p}"><circle cx="${p === 1 ? 190.52 : 191.83}" cy="272.95" r="87.4"/></clipPath>` : '';
    const L = !full && pd.lines;
    let body, sfr = '';
    if (L) {
      const [x, y, w] = vb; let defs = '', st = '';
      for (let i = 0; i < 15; i++) {
        const t = i ? L.c[i - 1] : y - 80, b = i < 14 ? L.c[i] : y + L.Hs + 80;
        defs += `<clipPath id="k${p}_${i}"><rect x="${x - 5}" y="${t}" width="${w + 10}" height="${(b - t).toFixed(3)}"/></clipPath>`;
        sfr += (SFR[p] || []).filter(r => { const yc = r[1] + r[3] / 2; return yc >= t && yc < b; }).map(r => `<rect class="sfr" data-i="${i}" transform="translate(0 ${-i * L.D})" x="${(r[0] + 0.3).toFixed(3)}" y="${(r[1] + 0.3).toFixed(3)}" width="${(r[2] - 0.6).toFixed(3)}" height="${(r[3] - 0.6).toFixed(3)}"/>`).join('');
        st += `<g class="st" transform="translate(0 ${-i * L.D})"><image href="${img}" x="${x}" y="${y}" width="${w}" height="${L.Hs}" class="pimg" preserveAspectRatio="none" clip-path="url(#k${p}_${i})"/><image class="porn"${ornHref(p) ? ` href="${ornHref(p)}"` : ''} x="${x}" y="${y}" width="${w}" height="${L.Hs}" preserveAspectRatio="none" clip-path="url(#k${p}_${i})"/></g>`;
      }
      body = `<defs>${defs}</defs>${st}`;
    } else {
      const im = `<image href="${img}" x="${full ? 0 : vb[0]}" y="${full ? 0 : vb[1]}" width="${full ? pd.w : vb[2]}" height="${full ? pd.h : vb[3]}" class="pimg" preserveAspectRatio="none"/>`;
      // الصفحتان 1 و2: ورقة الصورة نفسها (#FFFBF7) تُرسم فوق حبر الآيات المخفية فقط، داخل مجموعة تمتزج بالورق مثل الصورة تمامًا
      body = full ? `${clip}${im}` : `${clip}<g class="p12">${im}<rect class="tm-paper" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#FFFBF7" style="display:none"/></g>`;
    }
    const ss = pd.surahs;
    return `<div class="pg${(!full && p <= 2) ? ' short' : ''}">
      <div class="ph prt">${p > 2 ? `<img class="phimg" src="phdr/${String(p).padStart(3, '0')}.webp" alt="" aria-hidden="true" decoding="async">` : ''}<span class="pj">الجزء ${ar(pd.juz)}</span><button class="pnote" hidden aria-label="ملاحظات هذه الصفحة"></button>${p > 2 && hzLabel(p) ? `<span class="phz" aria-label="${hzLabel(p)}">${hzLabel(p)}</span>` : ''}<span class="ps">${esc(surahsTitle(ss, 14))}</span></div>
      <div class="txw">
      <svg class="tx" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${body}
        <g class="hot"${clip ? ` clip-path="url(#cc${p})"` : ''}>${pd.ayat.map(a => `<path data-k="${a.k}" d="${a.d}"/>`).join('')}</g>
      </svg>
      <svg class="tm-ov" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg>${sfr ? `<svg class="sfr-ov" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${sfr}</svg>` : ''}
      <div class="tm-ui" aria-hidden="true"></div>
      </div>
      <div class="pf prt">${p > 2 ? `<img class="pnimg" src="pnum/${String(p).padStart(3, '0')}.webp" alt="صفحة ${p}" decoding="async">` : ''}<span class="pn">${ar(p)}</span></div>
      <div class="nmk"></div>
    </div><div class="leaf-back" aria-hidden="true"></div><div class="shade"></div>`;
  }
  function leaf(p) {
    if (leaves.has(p)) return leaves.get(p);
    const el = document.createElement('div');
    el.className = 'leaf'; el.dataset.p = p; el.style.display = 'none';
    el.innerHTML = '<div class="pg"></div><div class="leaf-back" aria-hidden="true"></div><div class="shade"></div>';
    book.insertBefore(el, fold);
    leaves.set(p, el);
    QD.page(p).then(pd => {
      pageData.set(p, pd); pd.ayat.forEach(a => keyPage.set(a.k, p));
      el.innerHTML = leafHTML(p, pd);
      fitLeaf(el, p, pd);
      paint(el);
      decodeLeaf(el);
      ornWant(p);
      if (p === cur || (document.documentElement.classList.contains('spread') && (spreadPair(cur).left === p || spreadPair(cur).right === p))) requestAnimationFrame(() => notesPaint(p));
    });
    return el;
  }
  function rebuildLeaves() { for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd) { el.innerHTML = leafHTML(p, pd); fitLeaf(el, p, pd); paint(el); } } }
  function gc() { const reach = document.documentElement.classList.contains('spread') ? 6 : 3; for (const [q, el] of leaves) if (Math.abs(q - cur) > reach) { el.remove(); leaves.delete(q); } }
  const decoded = new Set();
  function pageImgUrl(q) { return viewFull() ? QD.pageImg(q) : ('../lines/' + String(q).padStart(3, '0') + '.webp'); }
  function decodeUrl(u) {
    if (!u || decoded.has(u)) return Promise.resolve();
    const i = new Image(); i.src = u;
    const pr = (i.decode ? i.decode() : new Promise(r => { i.onload = r; i.onerror = r; })).then(() => { decoded.add(u); }).catch(() => {});
    return pr;
  }
  function decodeLeaf(el) {
    const urls = new Set();
    el.querySelectorAll('image.pimg').forEach(im => { const u = im.getAttribute('href'); if (u) urls.add(u); });
    return Promise.all([...urls].map(decodeUrl));
  }
  function prefetch(p) {
    const spread = document.documentElement.classList.contains('spread');
    const qs = new Set([p - 2, p - 1, p + 1, p + 2]);
    if (spread) {
      const { left, right } = spreadPair(p);
      [left, right, (left || p) - 2, (left || p) - 1, (right || p) + 1, (right || p) + 2].forEach(q => { if (q) qs.add(q); });
    }
    qs.forEach(q => {
      if (q >= 1 && q <= N) { decodeUrl(pageImgUrl(q)); const el = leaf(q); if (el.style.display === 'none') el.style.display = ''; if (!el.style.visibility) el.style.visibility = 'hidden'; }
    });
  }
  function showOnly(p, also) {
    const spread = document.documentElement.classList.contains('spread');
    const pair = spread ? spreadPair(p) : { left: null, right: p };
    if (spread) { if (pair.left) leaf(pair.left); if (pair.right) leaf(pair.right); }
    else if (p) leaf(p);
    if (also) leaf(also);
    const visible = new Set();
    if (spread) { if (pair.left) visible.add(pair.left); if (pair.right) visible.add(pair.right); }
    else visible.add(p);
    if (also) visible.add(also);
    const lo = (pair.left || p) - (spread ? 5 : 3);
    const hi = (pair.right || p) + (spread ? 5 : 3);
    for (const [q, el] of leaves) {
      const near = q >= lo && q <= hi, vis = visible.has(q);
      if (near) {
        el.style.display = '';
        el.style.visibility = vis ? 'visible' : 'hidden';
        el.style.pointerEvents = vis ? '' : 'none';
      } else {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      }
      if (spread && vis) el.dataset.side = q === pair.left ? 'L' : (q === pair.right ? 'R' : '');
      else { if (el.dataset.side) delete el.dataset.side; }
      if (!vis) { el.style.transform = ''; el.classList.remove('turning'); const sh = el.querySelector('.shade'); if (sh) sh.style.opacity = 0; }
      el.style.zIndex = vis ? (q === p ? 2 : 1) : 0;
    }
    fold.style.opacity = 0;
    fold.style.transform = 'translateX(-48px)';
  }
  function notesPaintVisible(p) {
    if (!document.documentElement.classList.contains('spread')) { notesPaint(p); return; }
    const { left, right } = spreadPair(p);
    if (left) notesPaint(left);
    if (right) notesPaint(right);
  }
  /* زاوية التقليب: الكعب على اليمين (مصحف عربي). 0 = مفرودة، 180 = انقلبت لليمين.
     السحب من اليسار إلى اليمين = الصفحة التالية (كالمصحف الورقي). */
  function setAngle(el, th) {
    el.style.transform = 'rotateY(' + th + 'deg)';
    const k = Math.sin(th * Math.PI / 180);
    const sh = el.querySelector('.shade'); if (sh) sh.style.opacity = (0.42 * k).toFixed(3);
    const x = PW - PW * Math.cos(th * Math.PI / 180);
    fold.style.opacity = (th > 2 && th < 178) ? (0.55 * k).toFixed(3) : 0;
    fold.style.transform = 'translateX(' + (Math.min(x, PW) - 46) + 'px)';
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  function animate(el, from, to, ms) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => { const t = Math.min(1, (now - t0) / ms); setAngle(el, from + (to - from) * ease(t)); if (t < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }
  function wantFlip() {
    const v = ST.get().flip3d;
    if (v === false) return false;
    if (v === true) return true;
    return !(matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function prepFlip(dir) {
    const target = cur + dir;
    if (target < 1 || target > N) return null;
    const a = leaf(cur), b = leaf(target);
    a.style.display = ''; a.style.visibility = 'visible';
    b.style.display = ''; b.style.visibility = 'visible'; b.style.pointerEvents = 'none';
    decodeLeaf(b);
    if (dir > 0) {
      b.style.zIndex = 1; b.style.transform = '';
      a.style.zIndex = 3; a.classList.add('turning');
      return { el: a, start: 0, end: 180, target };
    }
    a.style.zIndex = 1;
    b.style.zIndex = 3; b.classList.add('turning'); setAngle(b, 180);
    return { el: b, start: 180, end: 0, target };
  }
  async function finishFlip(f, fromAngle, complete, user) {
    const remain = Math.abs((complete ? f.end : f.start) - fromAngle) / 180;
    const ms = Math.max(180, Math.min(400, 360 * remain));
    await animate(f.el, fromAngle, complete ? f.end : f.start, ms);
    if (complete) setCurrent(f.target, user);
    showOnly(cur);
    f.el.classList.remove('turning');
    busy = false;
  }
  async function flip(dir, user = true) {
    if (busy) return;
    const target = nextPage(dir);
    if (target < 1 || target > N || target === cur) return;
    const spread = document.documentElement.classList.contains('spread');
    if (!wantFlip() || spread) { leaf(target); setCurrent(target, user); showOnly(target); return; }
    const f = prepFlip(dir); if (!f) return;
    busy = true;
    await finishFlip(f, f.start, true, user);
  }
  function goPage(p, anim = false, user = false) {
    p = Math.max(1, Math.min(N, p | 0));
    if (anim && Math.abs(p - cur) === 1 && cur) return flip(p - cur, user);
    leaf(p); setCurrent(p, user); showOnly(p); requestAnimationFrame(() => notesPaintVisible(p));
  }
  function setCurrent(p, user) {
    const changed = p !== cur;
    if (changed) noteClose();
    cur = p; leaf(p); updateTitle(); $('#qjR').value = p;
    if (changed && TM.on) tmLoad(p);
    const settle = () => { ST.setLastPage(p); gc(); prefetch(p); if (changed) notesPaintVisible(p); };
    if (changed) requestAnimationFrame(settle); else settle();
  }
  async function updateTitle() {
    const p = cur;
    try {
      const pd = await QD.page(p); if (p !== cur) return;
      $('#tSurah').textContent = surahsTitle(pd.surahs);
      if (document.documentElement.classList.contains('spread')) {
        const { left, right } = spreadPair(p);
        if (left && right) $('#tSub').textContent = `صفحة ${ar(left)}–${ar(right)} · الجزء ${ar(pd.juz)}`;
        else $('#tSub').textContent = `صفحة ${ar(left || right || p)} · الجزء ${ar(pd.juz)}`;
      } else {
        $('#tSub').textContent = `صفحة ${ar(p)} · الجزء ${ar(pd.juz)}`;
      }
    } catch (e) { $('#tSub').textContent = 'صفحة ' + ar(p); }
  }
  function paint(root = book) {
    root.querySelectorAll('.hot path, .hl rect').forEach(s => {
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
      drag.dir = dx > 0 ? 1 : -1;
      if (!wantFlip() || document.documentElement.classList.contains('spread')) { try { book.setPointerCapture(e.pointerId); } catch (_) {} return; }
      const f = prepFlip(drag.dir);
      if (!f) { drag = null; return; }
      busy = true; drag.f = f;
      try { book.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (!drag.f) return;
    const prog = Math.max(0, Math.min(1, (drag.dir * dx) / (PW * 0.95)));
    drag.th = drag.dir > 0 ? prog * 180 : 180 - prog * 180;
    setAngle(drag.f.el, drag.th);
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    const dx = (e ? e.clientX : d.x0) - d.x0, dt = performance.now() - d.t0;
    const prog = Math.abs(dx) / (PW * 0.95), vel = Math.abs(dx) / Math.max(1, dt);
    const complete = e && e.type !== 'pointercancel' && (prog > 0.33 || vel > 0.45);
    if (!d.f) {
      if (complete && d.dir && nextPage(d.dir) !== cur && nextPage(d.dir) >= 1 && nextPage(d.dir) <= N) { if (!TM.on) AU.unlock(); flip(d.dir, true); }
      return;
    }
    suppressClick = true; setTimeout(() => suppressClick = false, 60);
    if (!TM.on) AU.unlock();
    finishFlip(d.f, d.th, complete, true);
  }
  book.addEventListener('pointerup', endDrag);
  book.addEventListener('pointercancel', endDrag);
  addEventListener('resize', () => refitSoon(120));
  addEventListener('orientationchange', () => refitSoon(300));
  if (window.visualViewport) visualViewport.addEventListener('resize', () => refitSoon(160));

  /* ---------- الأدوات تظهر باللمس ---------- */
  let chromeT = 0;
  function chrome(show) {
    document.body.classList.toggle('chrome', show);
    clearTimeout(chromeT);
  }

  /* ---------- وضع التلاوة الغامر: أثناء التشغيل تختفي الأشرطة والمشغل وتملأ الصفحة الشاشة (تكبير فقط، نفس الأسطر والكلمات).
   * لمسة على الصفحة تُظهر الأدوات، وتختفي بعد نحو 4 ثوانٍ ما دامت التلاوة جارية؛ الإيقاف المؤقت أو التوقف يعيد الوضع العادي. */
  const IMM = { on: false, t: 0 };
  function immSet(on) {
    if (IMM.on === on) return;
    IMM.on = on; clearTimeout(IMM.t);
    document.body.classList.toggle('immersive', on); document.body.classList.remove('imm-show');
    requestAnimationFrame(() => { layout(); refit(); showOnly(cur); notesPaintVisible(cur); });
  }
  function immShow() {
    document.body.classList.add('imm-show'); clearTimeout(IMM.t);
    IMM.t = setTimeout(() => {
      if (!IMM.on) return;
      if (sel || document.body.classList.contains('sheet-open') || AU.el.paused) return immShow();
      document.body.classList.remove('imm-show');
    }, 4000);
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
    // في الوضع الغامر: أول لمسة تُظهر الأدوات فقط
    if (IMM.on) { const hidden = !document.body.classList.contains('imm-show'); immShow(); if (hidden) return; }
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
    AU.prime();
    AU.play(sel.list.slice(), ST.get().reciter, count, mode, { kind: 'sel' });
  }
  /* «السورة كاملة»: من الآية المحددة (أو أول آية في الصفحة) إلى آخر السورة بلا توقف، والصفحة تتقلب مع التلاوة */
  function listenMode() { return ST.get().listen === 'ayah' ? 'ayah' : 'surah'; }
  async function surahKeys(from) {
    const [s, a] = from.split(':').map(Number);
    const ch = await QD.chapters();
    const n = ch[s - 1].verses_count, out = [];
    for (let i = a; i <= n; i++) out.push(s + ':' + i);
    return out;
  }
  async function playSurah(from) {
    const keys = await surahKeys(from);
    return AU.play(keys, ST.get().reciter, 1, 'range', { kind: 'surah' });
  }
  function listenNow() {
    if (!sel) return;
    if (listenMode() === 'surah') playSurah(sel.a); else startPlay(1, 'range');
  }
  // لا تشغيل تلقائي: التلاوة تبدأ فقط عندما يضغط على آية ويختار «استماع» أو «تكرار».
  AU.on('blocked', () => (!AU.state() && document.body.classList.remove('snkm'), toast('اضغط زر التشغيل للمتابعة.')));
  $('#aListen').onclick = () => { AU.prime(); if (!viewFull() && TMK && !TM.on) document.body.classList.add('snkm'); listenNow(); };
  AU.on('note', m => toast(m, 3600));
  AU.on('ayah', async (k, st) => {
    // قارئ بلا توقيت آيات: لا تظليل لآية بعينها، والعنوان باسم السورة
    playingKey = st.notime ? null : k;
    // v26z3: إن كان التتبع ممكنًا فلا يُظلَّل جسم الآية كاملًا (كان يظهر لحظة ثم يبدأ الشريط)
    document.body.classList.toggle('snkm', !st.notime && !viewFull() && !!TMK && !TM.on);
    paint();
    const r = AU.reciter(st.rid);
    const tot = st.count === 0 ? 'بدون حد' : ar(st.count);
    const title = st.notime ? 'سورة ' + ((chapters[+k.split(':')[0] - 1] || {}).name_arabic || '') : keyLabel(k);
    $('#player').hidden = false;
    $('#pNow').textContent = title + ' · ' + r.name;
    $('#pRep').textContent = st.notime ? 'السورة كاملة · بلا تتبع للآيات' : st.kind === 'surah' ? `السورة كاملة · ${ar(st.i + 1)} من ${ar(st.keys.length)}` : st.mode === 'ayah' ? `تكرار الآية ${ar(st.ayRep + 1)}/${tot}` : (st.count !== 1 ? `التكرار ${ar(st.rep + 1)}/${tot}` : 'تلاوة');
    reserve();
    if ('mediaSession' in navigator) {
      try { st.meta = true; navigator.mediaSession.metadata = new MediaMetadata({ title, artist: r.name, album: APPN }); navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
    }
    const p = await pageOfKey(k);
    // الصفحة تتبع التلاوة؛ إن كان التقليب جاريًا نعيد المحاولة بعد انتهائه
    const follow = (n) => { const s2 = AU.state(); if (!s2 || s2.keys[s2.i] !== k) return; if (p === cur || pageVisible(p)) return; if (busy) { if (n < 10) setTimeout(() => follow(n + 1), 250); return; } goPage(p, true, false); };
    follow(0);
  });
  AU.on('state', (s) => {
    try { snkState(s); } catch (e) {}
    // استئناف من إيقاف مؤقت: تبقى الأزرار ظاهرة 4 ثوانٍ (قد يريد المستخدم الإيقاف)، ثم تختفي
    try { const was = IMM.st; IMM.st = s; immSet(s === 'playing' && !TM.on); if (s === 'playing' && was === 'paused' && IMM.on) immShow(); } catch (e) {}
    document.body.classList.toggle('playing', s !== 'stopped');
    if (s === 'stopped') { playingKey = null; document.body.classList.remove('snkm'); $('#player').hidden = true; paint(); }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = s === 'stopped' ? 'none' : s; } catch (e) {} }
    try { ixPaint(); } catch (e) {}
    const paused = s === 'paused';
    $('#pToggle').setAttribute('aria-label', paused ? 'تشغيل' : 'إيقاف مؤقت');
    $('#pToggle').innerHTML = paused ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
    reserve();
  });
  AU.on('error', e => (!AU.state() && document.body.classList.remove('snkm'), toast(e && e.message && /^[\u0600-\u06FF]/.test(e.message) ? e.message : 'تعذّر تشغيل هذه الآية.')));
  // شريط تقدّم رفيع في المشغّل (موضع التلاوة في ملف السورة أو الآية)
  AU.el.addEventListener('timeupdate', () => { const d = AU.el.duration, b = $('#pBar'); if (b) b.style.width = (d > 0 ? Math.min(100, 100 * AU.el.currentTime / d) : 0).toFixed(2) + '%'; });
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
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20a2 2 0 004 0"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    up: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
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
      `<p class="muted sm">${sel ? 'الآية المحددة: ' + esc(rangeLabel(sel.a, sel.b)) : 'تبدأ التلاوة من أول آية في هذه الصفحة، أو اضغط على آية لتبدأ منها.'}</p>` +
      `<div class="seg" id="lMode" role="radiogroup" aria-label="طريقة الاستماع">${[['surah', 'السورة كاملة'], ['ayah', 'الآية أو المقطع']].map(([v, n]) => `<button data-lm="${v}" role="radio" aria-checked="${listenMode() === v}" class="${listenMode() === v ? 'on' : ''}">${n}</button>`).join('')}</div>` +
      tdlHTML() +
      hi('play', 'listen', 'استماع', listenMode() === 'surah' ? 'تستمر التلاوة حتى آخر السورة، وتتقلب الصفحات معها' : 'تلاوة الآية أو المقطع المحدد مرّة واحدة') +
      hi('repeat', 'repeat', 'تكرار', 'كرّر الآية أو المقطع بالعدد الذي تختاره') +
      hi('range', 'range', 'تحديد مقطع', 'اختر أول آية في المقطع، ثم آخر آية'), 'tilawa');
    tdlPaint();
  }
  /* «تنزيل السورة» في لوحة التلاوة: اختصار لتحميل السورة الحالية بصوت القارئ الحالي، بنفس منطق سهم الفهرس وحالاته */
  function tdlSurah() { const pd0 = pageData.get(cur); const k = sel ? sel.list[0] : pd0 && pd0.ayat && pd0.ayat[0] && pd0.ayat[0].k; return k ? +String(k).split(':')[0] : 0; }
  function tdlHTML() {
    const sNo = tdlSurah(); if (!sNo) return '';
    const c = chapters[sNo - 1], r = AU.reciter(ST.get().reciter);
    return `<button class="li hub tdl" data-h="tdl" data-s="${sNo}" data-rid="${r.id}" data-name="${c.name_arabic}"><span class="n tdlic" data-ic="dl">${IXI.dl}</span><span class="m"><b>تنزيل السورة</b><small>سورة ${c.name_arabic} بصوت ${r.name}، للاستماع دون إنترنت</small></span></button>`;
  }
  async function tdlPaint() {
    const b = document.querySelector('#hubBody .tdl'); if (!b) return;
    const sNo = +b.dataset.s, rid = +b.dataset.rid, nm = b.dataset.name, r = AU.reciter(rid);
    const j = AU.dl.job(rid, sNo);
    const stt = j ? null : (await AU.dl.status(rid)).get(sNo);
    if (!b.isConnected) return;
    const ic = b.querySelector('.tdlic'), sm = b.querySelector('.m small'), bb = b.querySelector('.m b');
    let k = 'dl', lab = 'تنزيل السورة', sub = `سورة ${nm} بصوت ${r.name}، للاستماع دون إنترنت`;
    if (j) { const f = j.total ? j.got / j.total : 0; k = 'run'; lab = 'جارٍ تنزيل السورة'; sub = (j.state === 'queued' ? 'في الانتظار' : j.total ? `${Math.floor(f * 100)}% · ${MB(j.total)}` : 'جارٍ التنزيل') + ' · اضغط للإلغاء'; ic.innerHTML = IXI.run(f); ic.dataset.ic = 'run'; }
    else if (stt === 'done') { k = 'done'; lab = 'السورة متاحة دون إنترنت'; sub = `بصوت ${r.name} · اضغط لإزالة التنزيل`; }
    else if (stt === 'part') { sub = 'التنزيل لم يكتمل · اضغط للمتابعة'; }
    if (k !== 'run' && ic.dataset.ic !== k) { ic.innerHTML = IXI[k]; ic.dataset.ic = k; }
    b.classList.toggle('done', k === 'done'); b.classList.toggle('run', k === 'run');
    bb.textContent = lab; sm.textContent = sub;
    b.setAttribute('aria-label', lab + '، ' + sub);
  }
  function openTafsirPanel() { return openTafsir(sel ? sel.list.slice() : null); }
  const PAPERS = [['madinah', 'مصحف المدينة', '#155A3A'], ['beige', 'بيج', '#FFFBF7'], ['blue', 'أزرق', '#F2F9FE'], ['white', 'أبيض', '#FFFFFF'], ['cream', 'كريمي', '#FBF3E2'], ['grey', 'رمادي فاتح', '#D9D6D2'], ['night', 'ليلي', '#0E0E0E'], ['glass', 'زجاجي', '#1F2120']];

  // v26z10: الاسم ونوع النسخة من js/config.js؛ أيقونات التواصل والمعرّف اللاتيني لا تظهر في نسخة الجمعية
  const APPN = (window.APP && APP.NAME) || 'المصحف الذكي', SOC = !window.APP || APP.SOCIAL;
  const SOCIAL = [
    ['x', 'إكس', 'https://x.com/alsaloomart', '<path d="M5 5l14 14M19 5L5 19"/>'],
    ['ig', 'إنستغرام', 'https://instagram.com/alsaloomart', '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.7" cy="7.3" r=".8"/>'],
    ['sc', 'سناب شات', 'https://snapchat.com/add/alsaloomart', '<path d="M12 3.6c2.8 0 5 2.5 5 5.6 0 1 .5 1.7 1.2 2.4.5.5.6 1 .2 1.4-.4.4-.9.3-1.4.6.6 1 1.6 1.6 1.6 2.3 0 .6-1 .7-1.8.5-.3 1.1-1.5 1.8-3.1 1.8-.9 0-1.4-.4-1.7-.4s-.8.4-1.7.4c-1.6 0-2.8-.7-3.1-1.8-.8.2-1.8.1-1.8-.5 0-.7 1-1.3 1.6-2.3-.5-.3-1-.2-1.4-.6-.4-.4-.3-.9.2-1.4.7-.7 1.2-1.4 1.2-2.4 0-3.1 2.2-5.6 5-5.6z"/>'],
    ['tt', 'تيك توك', 'https://www.tiktok.com/@alsaloomart', '<path d="M13.4 4v9.4a3.3 3.3 0 11-2.6-3.2v2.4a1.4 1.4 0 101 .13V4h1.6z"/><path d="M13.4 7.6c1.1 1.6 2.6 2.5 4.2 2.7v2.3c-1.9-.3-3.4-1.1-4.2-2.2"/>'],
    ['wa', 'واتساب', 'https://wa.me/966504797651', '<path d="M5.2 19.2l1.2-3.8A7.2 7.2 0 1112 19.3a7 7 0 01-3.3-.8z"/><path d="M9.2 9c.2-.4.3-.5.6-.5h.4c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.1-.1.3.1.5.4.5.9.9 1.4 1.3.2.1.4.1.6 0l.5-.4c.2-.1.4-.1.5 0l1.6.8c.2.1.3.3.3.5v.4c0 .3-.2.5-.5.6-.9.4-2.5.3-4.3-1.3-1.6-1.4-2.2-3.1-2.2-4.3 0-.4.2-.5.6-.6z"/>']
  ];
  function creditHTML(opts = {}) {
    const desk = !!opts.desktop;
    const social = `<ul class="credit-social">${SOCIAL.map(([id, name, href, svg]) =>
      `<li><a href="${href}" target="_blank" rel="noopener" aria-label="${name}" title="${name}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg></a></li>`
    ).join('')}</ul>`;
    return `<div class="credit"${desk ? ' id="deskCreditInner"' : ''}>
      ${desk ? '' : `<p class="credit-app">${APPN}</p>`}
      <p class="credit-name">تصميم وتطوير: فهد السلوم${SOC ? ' | alsaloomart' : ''}</p>
      <p class="credit-note">هذا التصميم للتطبيق. نص المصحف وحقوقه لمجمع الملك فهد لطباعة المصحف الشريف.</p>
      ${SOC ? social : ''}
    </div>`;
  }

  function openSettings() {
    const s = ST.get(), dark = document.documentElement.classList.contains('dark'), cur = s.theme === 'glass' ? 'glass' : dark ? 'night' : (s.paper || 'beige'), rid = s.reciter;
    openList('الإعدادات',
      `<div class="sw-row" id="sNightRow" role="presentation"><b>الوضع الليلي</b><button class="switch" id="sNight" role="switch" aria-checked="${dark}" aria-label="الوضع الليلي"></button></div>
       <label class="lbl">لون الصفحة</label>
       <div class="swatches" id="sPaper">${PAPERS.map(([k, n, c]) => `<button data-paper="${k}" class="${k === cur ? 'on' : ''}" aria-label="${n}"><i style="background:${c}"></i>${n}</button>`).join('')}</div>
       <p class="muted sm">لون الخلفية للعرض فقط؛ نص المصحف كما هو.</p>
       <label class="lbl">القارئ</label>` +
      `<div class="rgrid">${AU.RECITERS.map(r => `<button class="rcard${r.id === rid ? ' on' : ''}" data-r="${r.id}" aria-pressed="${r.id === rid}"><span class="rc-h"><b>${r.name}</b>${r.id === rid ? CK : ''}</span><small>${r.style}</small><span class="rbadge${r.notime ? ' off' : ''}">${r.notime ? 'السورة كاملة فقط' : 'تظليل الآية أثناء التلاوة'}</span></button>`).join('')}</div>` +
      `<label class="lbl">التنزيلات</label><div id="dlBox"><p class="muted sm">…</p></div>` +
      `<label class="lbl">عرض الصفحة</label><div class="seg" id="mView">${[['screen', 'ملء الشاشة'], ['full', 'الصفحة بإطارها']].map(([v, n]) => `<button data-v="${v}" class="${(s.view === 'full' ? 'full' : 'screen') === v ? 'on' : ''}">${n}</button>`).join('')}</div>
       <div class="sw-row" id="sFlipRow" role="presentation"><b>تقليب ثلاثي الأبعاد</b><button class="switch" id="sFlip" role="switch" aria-checked="${wantFlip()}" aria-label="تقليب ثلاثي الأبعاد"></button></div>
       ${window.ADHKAR ? ADHKAR.settingsHTML() : ''}
       <label class="lbl">التذكير</label>` + hi('bell', 'rem', 'تذكير الورد', remSub()) + (window.CLOUD && CLOUD.state().on ? `<label class="lbl">الحساب</label><div id="clBox">${CLOUD.html()}</div>` : '<label class="lbl">الحساب</label><p class="muted sm">هذه النسخة تعمل على جهازك فقط، دون حساب ولا مزامنة.</p>') + BKP_HTML() + SRC_HTML() + creditHTML(), 'settings');
    if (window.CLOUD && CLOUD.state().on) CLOUD.prep();
    dlBox();
  }
  /* ---------- الأشرطة ---------- */
  function navOn(k) { $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (k || 'mushaf'))); $$('[data-nav="tasmee"]').forEach(b => b.setAttribute('aria-pressed', String(k === 'tasmee'))); }
  $$('[data-nav]').forEach(b => b.onclick = () => {
    const k = b.dataset.nav;
    if (k !== 'tasmee') AU.unlock(); noteClose();
    if (TM.on && k !== 'tasmee' && k !== 'mushaf') tmEnd();   // فتح لوحة أخرى ينهي التسميع
    if (k === 'mushaf') { closeSheets(); return; }
    if (k === 'index') { $('#btnIndex').click(); navOn('index'); }
    if (k === 'wird') openWirdPanel();
    if (k === 'notes') { openNotes(); navOn('notes'); }
    if (k === 'settings') openSettings();
    if (k === 'search') { $('#btnGo').click(); navOn('search'); }
    if (k === 'tasmee') { if (TM.on) tmEnd(); else tmStart(); return; }
    if (k === 'tilawa') openTilawa();
    if (k === 'tafsir') openTafsirPanel();
    if (k === 'more') { openMore(); navOn('more'); }
    if (k === 'adhkar' && window.ADHKAR) { window.ADHKAR.open(); navOn('adhkar'); }
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
    const sf = e.target.closest('#sFlipRow'); if (sf) { ST.set('flip3d', !wantFlip()); openSettings(); return; }
    const sa = e.target.closest('[data-adhopt]'); if (sa && window.ADHKAR) { if (sa.getAttribute('aria-disabled') !== 'true') ADHKAR.toggle(sa.dataset.adhopt); const y = e.target.closest('.sh-b'), t = y && y.scrollTop; openSettings(); if (y) y.scrollTop = t; return; }
    const sp = e.target.closest('#sPaper [data-paper]');
    if (sp) { const k = sp.dataset.paper; if (k === 'glass') setTheme('glass'); else if (k === 'night') setTheme('dark'); else { ST.set('paper', k); setTheme('light'); } openSettings(); return; }
    const lm = e.target.closest('#lMode [data-lm]'); if (lm) { ST.set('listen', lm.dataset.lm); openTilawa(); return; }
    const dx = e.target.closest('.dlx');
    if (dx) { const nm = chapters[+dx.dataset.s - 1].name_arabic; if (await ask('حذف سورة ' + nm + ' بصوت ' + AU.reciter(+dx.dataset.rid).name + ' من جهازك؟ ستحتاج إلى الإنترنت لتشغيلها بعد الحذف.', 'احذف')) { await AU.dl.remove(+dx.dataset.rid, +dx.dataset.s); dlBox(); } return; }
    if (e.target.closest('#dlAll')) { if (await ask('حذف كل السور التي نزّلتها لجميع القرّاء؟', 'احذف')) { await AU.dl.removeAll(); toast('حُذِفت كل التنزيلات.'); dlBox(); } return; }
    const rr = e.target.closest('[data-r]'); if (rr) { ST.setReciter(+rr.dataset.r); openSettings(); return; }
    const vw = e.target.closest('#mView [data-v]'); if (vw) { ST.set('view', vw.dataset.v); applyTheme(); layout(); rebuildLeaves(); requestAnimationFrame(refit); openSettings(); return; }
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
    if (h === 'tdl') { await dlTap(+b.dataset.s, b.dataset.name, +b.dataset.rid); tdlPaint(); return; }
    if (h === 'listen') { AU.prime(); if (!sel) await selectFirst(); closeSheets(); listenNow(); }
    if (h === 'range') { closeSheets(); if (!sel) await selectFirst(); $('#btnRange').click(); }
    if (h === 'more') openMore();
    if (h === 'rem') openRem();
    if (h === 'bkx') bkpExport();
    if (h === 'bki') bkpPick();
    if (h === 'priv') openPriv();
    if (h === 'notes') openNotes();
  };

  /* ---------- ملاحظات الحفظ: تظهر على الصفحة نفسها التي كُتبت فيها ----------
   * محفوظة على الجهاز فقط (localStorage: mushaf.notes). */
  const NK = 'mushaf.preview.notes';
  const notesAll = () => { try { return JSON.parse(localStorage.getItem(NK) || '[]'); } catch (e) { return []; } };
  const notesSave = a => localStorage.setItem(NK, JSON.stringify(a));
  const dLabel = t => new Date(t).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
  let noteCur = null, noteT = 0;
  function notesPaint(p) {
    const el = leaves.get(p); if (!el) return;
    const box = el.querySelector('.nmk'), pg = el.querySelector('.pg'), svg = el.querySelector('svg.tx'); if (!box || !svg) return;
    const ns = notesAll().filter(n => n.p === p), pn = el.querySelector('.pnote');
    if (pn) { pn.hidden = !ns.length; pn.innerHTML = ns.length ? `<svg viewBox="0 0 24 24"><path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 013 3L9 18z"/><path d="M14 7l3 3"/></svg><span>${cnt(ns.length, 'note')}</span>` : ''; }
    const na = el.querySelector('.nadd');
    if (na) {
      const lab = ns.length ? cnt(ns.length, 'note') : 'ملاحظة';
      na.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 013 3L9 18z"/><path d="M14 7l3 3"/></svg><span>' + lab + '</span>';
      na.setAttribute('aria-label', ns.length ? (lab + ' على هذه الصفحة. اضغط لإضافة ملاحظة.') : 'ملاحظة جديدة على هذه الصفحة');
    }
    if (!ns.length) { box.innerHTML = ''; return; }
    const pr = pg.getBoundingClientRect(), sr = svg.getBoundingClientRect();
    const used = []; let free = 0;
    box.innerHTML = ns.sort((a, b) => a.t - b.t).map(n => {
      let y = null;
      if (n.k && /^\d{1,3}:\d{1,3}$/.test(n.k)) { const pa = el.querySelector(`g.hot path[data-k="${n.k}"]`); if (pa) { const r = pa.getBoundingClientRect(); if (r.height) y = r.top - pr.top + 2; } }
      if (y == null) y = sr.top - pr.top + 4 + 26 * free++;
      while (used.some(u => Math.abs(u - y) < 24)) y += 24;
      used.push(y);
      return `<button data-id="${esc(n.id)}" style="top:${Math.round(y - 2)}px" aria-label="ملاحظة${n.k ? ' على ' + esc(keyLabel(n.k)) : ''}"></button>`;
    }).join('');
  }
  function noteMeta(n) { return `<bdi>صفحة ${esc(ar(n.p))}</bdi>${n.k ? ' · <bdi>' + esc(n.kb && n.kb !== n.k ? rangeLabel(n.k, n.kb) : keyLabel(n.k)) + '</bdi>' : ''} · <bdi>${dLabel(n.u || n.t)}</bdi>`; }
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
      try { const dl = JSON.parse(localStorage.getItem('mushaf.preview.notes.del') || '{}'); dl[n.id] = Date.now(); localStorage.setItem('mushaf.preview.notes.del', JSON.stringify(dl)); } catch (e) {}
      notesSave(notesAll().filter(x => x.id !== n.id)); noteCur = null; c.hidden = true; c.innerHTML = '';
      notesPaint(n.p); toast('حُذِفت الملاحظة.');
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
    notesSave(all); const st = $('#noteSt'); if (st) st.textContent = 'حُفِظت';
    notesPaint(n.p);
  }
  function noteClose() {
    if (!noteCur) { $('#noteCard').hidden = true; return; }
    noteCommit(); noteCur = null; $('#noteCard').hidden = true;
  }
  function openNotes(page) {
    const all = notesAll().filter(n => !page || n.p === page).sort((a, b) => (b.u || b.t) - (a.u || a.t));
    $('#sh-notes .sh-h b').textContent = page ? `ملاحظات صفحة ${ar(page)}` : 'ملاحظاتي';
    $('#notesBody').innerHTML = all.length ? all.map(n => `<button class="li" data-id="${esc(n.id)}"><span class="m"><b>${esc(n.text.length > 90 ? n.text.slice(0, 90) + '…' : n.text)}</b><small>${noteMeta(n)}</small></span></button>`).join('')
      : '<p class="muted">لا توجد ملاحظات بعد. اضغط «ملاحظة» في الشريط العلوي لتكتب ملاحظة على الصفحة.</p>';
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
  // v26z11: قيم مزامَنة تُعرض في حقول: تُقبل بالشكل المتوقع فقط
  const tOK = t => /^\d{2}:\d{2}$/.test(String(t)) ? String(t) : '';
  const nOK = n => { n = parseInt(n, 10); return n > 0 && n < 10000 ? n : ''; };
  function remSub() { const r = rem(); return r.on ? `${esc(tLabel(tOK(r.times[0])))} و${esc(tLabel(tOK(r.times[1])))}` : 'غير مفعّل'; }
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
      <label class="lbl">التذكير الأول</label><input type="time" id="remT1" value="${esc(tOK(r.times[0]))}" step="300">
      <label class="lbl">التذكير الثاني</label><input type="time" id="remT2" value="${esc(tOK(r.times[1]))}" step="300">
      <p class="muted sm">بتوقيت الرياض.</p>
      ${note ? `<p class="muted sm warn" id="remNote">${note}</p>` : ''}
      ${r.on ? '<button class="btn full" id="remTest">إشعار تجريبي</button><button class="btn full" id="remOff">إيقاف التذكير</button>'
             : `<button class="btn gold full" id="remOn" ${pushOK() && !(isIOS && !isStandalone()) && perm !== 'denied' ? '' : 'disabled'}>تفعيل التذكير</button>`}
      ${PUSH.live ? '' : '<p class="muted sm" id="remSrv">الإرسال اليومي من الخادم لم يُفعَّل بعد، لذلك لن تصلك التذكيرات المجدولة حتى يُفعَّل. الإشعار التجريبي يعمل الآن.</p>'}`;
    openSheet('rem');
    const saveTimes = () => { const x = rem(); x.times = [$('#remT1').value || '06:00', $('#remT2').value || '20:00']; ST.set('rem', x); remSync(); };
    $('#remT1').onchange = saveTimes; $('#remT2').onchange = saveTimes;
    if ($('#remOn')) $('#remOn').onclick = async () => {
      // يجب أن يُطلب الإذن مباشرة داخل الضغطة
      let p; try { p = await Notification.requestPermission(); } catch (e) { p = 'default'; }
      if (p !== 'granted') { toast(p === 'denied' ? 'لم يُسمح بالإشعارات.' : 'لم يُفعَّل التذكير.'); return openRem(); }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(PUSH.vapid) });
        const x = rem(); x.on = true; x.sub = sub.toJSON(); ST.set('rem', x);
      } catch (e) { const x = rem(); x.on = true; x.sub = null; ST.set('rem', x); }
      await remSync(); toast('فُعِّل التذكير.'); openRem();
    };
    if ($('#remOff')) $('#remOff').onclick = async () => {
      try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {}
      const x = rem(); x.on = false; x.sub = null; ST.set('rem', x); await remSync(); toast('أُوقِف التذكير.'); openRem();
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
      if (await ask(n > 1 ? 'إزالة هذه الآيات من محفوظك؟' : 'إزالة هذه الآية من محفوظك؟', 'إزالة')) { ST.unMem(sel.list); toast('أُزِيلت من محفوظك.'); }
    } else {
      ST.markMem(sel.list);
      toast(`أُضِيفت ${cnt(n)} إلى محفوظك، ${n === 2 ? 'ومراجعتهما' : 'ومراجعتها'} غدًا.`);
    }
    select(sel.a, sel.b); refreshToday(); badge();
  };
  $('#aRev').onclick = () => {
    if (!sel) return;
    ST.addReview(sel.list); badge();
    toast(`أُضِيفت ${rangeLabel(sel.a, sel.b)} إلى قائمة المراجعة.`);
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
      <input id="plA" type="number" min="1" value="${esc(nOK(a))}" style="max-width:96px" inputmode="numeric" aria-label="الآية"></div>
      <label class="lbl">مقدار الحفظ اليومي</label>
      <div class="seg" id="plU">${Object.entries(UNITS).map(([k, v]) => `<button data-u="${k}" class="${k === pl.unit ? 'on' : ''}">${v}</button>`).join('')}</div>
      <input id="plN" type="number" min="1" max="50" value="${esc(nOK(pl.amount))}" inputmode="numeric">
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
        toast('حُفِظت الخطة');
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
        <p>${memN ? `حفظت ${cnt(memN, 'aya', 'acc')} حتى الآن.` : 'بداية طيبة، واصل ورد اليوم.'}</p>
      </div>
      <button class="btn full" id="plEdit">تعديل الخطة</button>
      <button class="btn full ghost" id="plDel">حذف الخطة</button>`;
    if ($('#plOpen')) {
      $('#plOpen').onclick = async () => { closeSheets(); goPage(await pageOfKey(t.a)); select(t.a, t.b); };
      $('#plListen').onclick = async () => { closeSheets(); goPage(await pageOfKey(t.a)); await select(t.a, t.b); startPlay(ST.get().repeat.count || 1, ST.get().repeat.mode); };
    }
    $('#plEdit').onclick = () => openPlan(true);
    $('#plDel').onclick = async () => { if (await ask('حذف الخطة؟ لن يُحذف المحفوظ ولا المراجعة.', 'احذف')) { ST.setPlan(null); refreshToday(); closeSheets(); } };
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
      // الصف يفتح السورة للقراءة، وزر التشغيل المنفصل يشغّلها كاملة
      L.innerHTML = chapters.map(c => `<div class="li ixs"><button class="ixo" data-p="${c.pages[0]}"><span class="n">${ar(c.id)}</span><span class="m"><b>${c.name_arabic}</b><small>${c.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · <span class="cnw" dir="rtl">${cnt(c.verses_count, 'aya', false, true)}</span></small></span><span class="pgn">ص ${ar(c.pages[0])}</span></button><button class="ixdl" data-s="${c.id}" data-name="${c.name_arabic}" aria-label="تنزيل سورة ${c.name_arabic}">${IXI.dl}</button><button class="ixplay" data-s="${c.id}" data-name="${c.name_arabic}" aria-label="تشغيل سورة ${c.name_arabic}">${IXI.play}</button></div>`).join('');
      dlRid = ST.get().reciter;
      L.insertAdjacentHTML('afterbegin', `<div class="ixrc"><label for="ixRec">تنزيل السور بصوت</label><select id="ixRec">${AU.RECITERS.map(r => `<option value="${r.id}"${r.id === dlRid ? ' selected' : ''}>${r.name}${r.style !== 'مرتّل' || AU.RECITERS.filter(x => x.name === r.name).length > 1 ? ' (' + r.style + ')' : ''}</option>`).join('')}</select></div>`);
      $('#ixRec').onchange = e => { dlRid = +e.target.value; dlRefresh(); };
      ixPaint(); dlRefresh();
    } else {
      if (!juzs) juzs = await QD.juzStarts();
      L.innerHTML = juzs.map(j => `<button class="li" data-k="${j.k}"><span class="n">${ar(j.n)}</span><span class="m"><b>الجزء ${ar(j.n)}</b><small>يبدأ من ${keyLabel(j.k)}</small></span></button>`).join('');
    }
  }
  $('#sh-index .seg').onclick = e => { const b = e.target.closest('button'); if (b) openIndex(b.dataset.ix); };
  $('#ixList').onclick = async e => {
    const db = e.target.closest('.ixdl');
    if (db) { e.stopPropagation(); return dlTap(+db.dataset.s, db.dataset.name); }
    const pb = e.target.closest('.ixplay');
    if (pb) {
      e.stopPropagation();
      const sNo = +pb.dataset.s, st = AU.state();
      if (ixPlaying(sNo)) { AU.el.paused ? AU.resume() : AU.pause(); ixPaint(); return; }
      AU.prime();   // داخل اللمسة نفسها: يفتح عنصر الصوت على iOS قبل جلب الروابط
      const c = chapters[sNo - 1];
      // دون إنترنت: نشغّل المحمّل فقط (بصوت القارئ الحالي، أو بصوت قارئ آخر حمّلت له هذه السورة)
      let rid = ST.get().reciter;
      if (navigator.onLine === false && !(await AU.dl.has(rid, sNo))) {
        let alt = null; for (const r of AU.RECITERS) if (await AU.dl.has(r.id, sNo)) { alt = r; break; }
        if (!alt) { toast('لا يوجد اتصال بالإنترنت، وسورة ' + c.name_arabic + ' لم تُنزَّل بعد. نزّلها بزر التنزيل لتستمع إليها دون إنترنت.', 4200); return; }
        rid = alt.id; toast('تُشغَّل بصوت ' + alt.name + '، لأنك نزّلت هذه السورة بصوته.', 3200);
      }
      closeSheets(); if (sel) clearSel();
      goPage(c.pages[0], true, false);
      const keys = []; for (let i = 1; i <= c.verses_count; i++) keys.push(sNo + ':' + i);
      AU.play(keys, rid, 1, 'range', { kind: 'surah' });
      return;
    }
    const b = e.target.closest('.ixo, .li'); if (!b) return;
    closeSheets(); goPage(b.dataset.p ? +b.dataset.p : await pageOfKey(b.dataset.k));
  };
  $('#btnIndex').onclick = () => openIndex('s');
  // «ملاحظة» في الشريط العلوي: ملاحظة جديدة على الصفحة الحالية (كانت بجانب رقم الصفحة)
  $('#tbNote').onclick = () => { if (busy) return; if (TM.on) tmEnd(); closeSheets(); noteNew(); };
  const IXI = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.8v10.4a.8.8 0 001.2.7l8.2-5.2a.8.8 0 000-1.4l-8.2-5.2a.8.8 0 00-1.2.7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5v11M15.5 6.5v11"/></svg>',
    dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10.5M7.5 10.8l4.5 4.5 4.5-4.5M5.5 19.5h13"/></svg>',
    done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.6 3.6 7.4-7.6"/></svg>',
    run: (f) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="rg0" cx="12" cy="12" r="9"/><circle class="rg1" cx="12" cy="12" r="9" pathLength="100" stroke-dasharray="${Math.max(2, f * 100).toFixed(1)} 100" transform="rotate(-90 12 12)"/><rect class="rgs" x="9.2" y="9.2" width="5.6" height="5.6" rx="1.2"/></svg>`
  };
  /* ---------- تحميل السور للاستماع دون إنترنت ---------- */
  let dlRid = 6, dlStat = new Map();
  const MB = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' جيجابايت' : (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' ميجابايت';
  async function dlRefresh() { dlStat = await AU.dl.status(dlRid); dlPaint(); }
  function dlPaint(only) {
    $$('#ixList .ixdl').forEach(b => {
      const sNo = +b.dataset.s; if (only && only !== sNo) return;
      const j = AU.dl.job(dlRid, sNo), stt = dlStat.get(sNo), nm = b.dataset.name;
      const em = b.parentNode.querySelector('.ixo small');
      let ic = 'dl', lab = 'تنزيل سورة ' + nm, note = '';
      if (j) { const f = j.total ? j.got / j.total : 0; ic = 'run'; lab = 'إلغاء تنزيل سورة ' + nm; note = j.state === 'queued' ? 'في الانتظار' : j.total ? `جارٍ التنزيل ${Math.floor(f * 100)}% · ${MB(j.total)}` : 'جارٍ التنزيل'; b.innerHTML = IXI.run(f); b.dataset.ic = 'run'; }
      else if (stt === 'done') { ic = 'done'; lab = 'تم تنزيل سورة ' + nm + '، اضغط لحذفها'; note = 'تم تنزيلها'; }
      else if (stt === 'part') { lab = 'متابعة تنزيل سورة ' + nm; note = 'تنزيل لم يكتمل'; }
      if (ic !== 'run' && b.dataset.ic !== ic) { b.innerHTML = IXI[ic]; b.dataset.ic = ic; }
      b.classList.toggle('done', ic === 'done'); b.classList.toggle('run', ic === 'run');
      b.setAttribute('aria-label', lab);
      if (em) { let t = em.querySelector('.ixst'); if (!t) { t = document.createElement('span'); t.className = 'ixst'; em.appendChild(t); } t.textContent = note ? ' · ' + note : ''; t.classList.toggle('ok', ic === 'done'); }
    });
  }
  async function dlTap(sNo, nm, rid = dlRid) {
    const r = AU.reciter(rid);
    if (AU.dl.job(rid, sNo)) { AU.dl.cancel(rid, sNo); toast('أُلغِي تنزيل سورة ' + nm + '.'); return; }
    if ((await AU.dl.status(rid)).get(sNo) === 'done') {
      if (!(await ask('حذف سورة ' + nm + ' بصوت ' + r.name + ' من جهازك؟ ستحتاج إلى الإنترنت لتشغيلها بعد الحذف.', 'احذف'))) return;
      await AU.dl.remove(rid, sNo); toast('حُذِفت سورة ' + nm + ' من جهازك.'); return;
    }
    if (navigator.onLine === false) { toast('لا يوجد اتصال بالإنترنت. التنزيل يحتاج إلى اتصال.'); return; }
    AU.dl.start(rid, sNo);
  }
  AU.dl.on(async (rid, sNo, err) => {
    if (err) toast(err, 4200);
    tdlPaint();
    if (!document.querySelector('#ixList .ixdl')) { if (document.getElementById('dlBox')) dlBox(); return; }
    if (rid === undefined || rid === dlRid) {
      const j = sNo && AU.dl.job(rid, sNo);
      if (j && j.state === 'run' && j.got) dlPaint(sNo);   // تحديث التقدم فقط
      else await dlRefresh();
    }
    if (rid !== undefined && !AU.dl.job(rid, sNo) && !err) { const st2 = (await AU.dl.status(rid)).get(sNo); if (st2 === 'done') toast('اكتمل تنزيل سورة ' + chapters[sNo - 1].name_arabic + '، وأصبحت متاحة دون إنترنت.', 3600); }
  });
  /* قسم «التحميلات» في الإعدادات */
  async function dlBox() {
    const box = $('#dlBox'); if (!box) return;
    const items = await AU.dl.list(), est = await AU.dl.estimate(), per = await AU.dl.persisted();
    if (!$('#dlBox')) return;
    const tot = items.reduce((a, x) => a + (x.bytes || 0), 0);
    const by = new Map(); items.forEach(x => { if (!by.has(x.rid)) by.set(x.rid, []); by.get(x.rid).push(x); });
    box.innerHTML = (items.length ? [...by].map(([rid, xs]) => { const r = AU.reciter(rid); return `<div class="dlg"><b>${r.name}<small> · ${r.style}</small></b>${xs.map(x => `<div class="dlr"><span>سورة ${chapters[x.s - 1].name_arabic}</span><small>${MB(x.bytes || 0)}</small><button class="dlx" data-rid="${rid}" data-s="${x.s}" aria-label="حذف سورة ${chapters[x.s - 1].name_arabic} من الجهاز"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join('')}</div>`; }).join('') +
      `<p class="muted sm">المجموع: ${cnt(items.length, 'surah')} · ${MB(tot)}</p>`
      : `<p class="muted sm">لم تُنزّل أي سورة بعد. اضغط سهم التنزيل بجانب زر التشغيل في الفهرس لتستمع إلى السورة دون إنترنت.</p>`) +
      (est && est.quota ? `<p class="muted sm">مساحة التطبيق المستخدمة ${MB(est.usage || 0)} من نحو ${MB(est.quota)} متاحة له على هذا الجهاز.${per ? ' التخزين محمي من الحذف التلقائي.' : ''}</p>` : '') +
      (items.length ? `<button class="btn full" id="dlAll">حذف كل التنزيلات</button>` : '');
  }

  function ixPlaying(sNo) { const st = AU.state(); return !!(st && st.kind === 'surah' && +st.keys[0].split(':')[0] === sNo); }
  function ixPaint() {
    $$('#ixList .ixplay').forEach(b => {
      const sNo = +b.dataset.s, on = ixPlaying(sNo), run = on && !AU.el.paused;
      b.classList.toggle('on', on);
      const want = run ? 'pause' : 'play';
      if (b.dataset.ic !== want) { b.innerHTML = IXI[want]; b.dataset.ic = want; }
      b.setAttribute('aria-label', (run ? 'إيقاف مؤقت لسورة ' : 'تشغيل سورة ') + b.dataset.name);
    });
  }

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
    info.textContent = hits.length ? (hits.length > 100 ? `أول 100 من ${cnt(hits.length, 'aya', false, true)}` : cnt(hits.length, 'aya', false, true)) : 'لا توجد نتائج';
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
    $('#sList').innerHTML = list.map(c => `<button class="li" data-p="${c.pages[0]}"><span class="n">${ar(c.id)}</span><span class="m"><b>${c.name_arabic}</b><small>${c.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · <span class="cnw" dir="rtl">${cnt(c.verses_count, 'aya', false, true)}</span></small></span><span class="pgn">ص ${ar(c.pages[0])}</span></button>`).join('');
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
    const glass = t === 'glass';
    const dark = glass || t === 'dark' || (t === 'system' && mqDark.matches);
    const H = document.documentElement;
    H.classList.toggle('dark', dark);
    H.classList.toggle('glass', glass);
    H.classList.remove('darkpage');
    H.dataset.paper = s.paper || 'beige';
    H.classList.toggle('vfull', s.view === 'full');
    try { if (dark) setTimeout(ornAll, 50); } catch (e) {}
    document.querySelector('meta[name="theme-color"]').content = glass ? '#1F2120' : dark ? '#171818' : ({ white: '#F7F7F6', cream: '#F4EAD6', grey: '#CDC9C4', blue: '#E6F0F8', madinah: '#EDE4D0' }[s.paper] || '#FBF4EC');
  }
  function setTheme(t) { ST.setTheme(t); applyTheme(); }
  mqDark.addEventListener ? mqDark.addEventListener('change', applyTheme) : mqDark.addListener(applyTheme);
  $('#btnTheme').onclick = () => { setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'); };

  /* ---------- v26z11: الخصوصية (نافذة قصيرة تطابق المزامنة الفعلية) والنسخة الاحتياطية في ملف ---------- */
  const SYNC_ON = () => !!(window.CLOUD && CLOUD.state().on);
  const PRIV_LINE = () => SYNC_ON()
    ? 'بياناتك (الخطة، والمحفوظ، والمراجعة، والملاحظات، وآخر صفحة) محفوظة على جهازك، ولا تُرسَل إلى أي خادم إلا إن سجّلت الدخول بحساب Google، فتُحفظ نسخة منها في حسابك لتنتقل معك بين أجهزتك.'
    : 'بياناتك (الخطة، والمحفوظ، والمراجعة، والملاحظات، وآخر صفحة) محفوظة على جهازك فقط، ولا تُرسَل إلى أي خادم.';
  function openPriv() {
    const li = SYNC_ON() ? [
      'بياناتك محفوظة على جهازك، والتطبيق يعمل كاملًا دون تسجيل دخول.',
      'إن سجّلت الدخول بحساب Google تُحفظ نسخة من الملاحظات والخطة والمحفوظ والمراجعة والإعدادات في حسابك لتنتقل معك بين أجهزتك. الخروج لا يحذفها، ولك أن تحذفها من الإعدادات.',
      'الأذكار ومتابعة الصلاة والمدينة، ورابط إشعارات التذكير، تبقى على جهازك فقط.',
      'لا تتبُّع ولا إعلانات. والتلاوات تُبَثّ من خوادم مصادرها عند التشغيل.'
    ] : [
      'بياناتك محفوظة على جهازك فقط، ولا دخول ولا مزامنة في هذه النسخة.',
      'لك أن تحفظ نسخة احتياطية في ملف من الإعدادات.',
      'لا تتبُّع ولا إعلانات. والتلاوات تُبَثّ من خوادم مصادرها عند التشغيل.'
    ];
    $('#pvBody').innerHTML = '<ul class="pvl">' + li.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>';
    const prev = $$('.sheet').find(s => !s.hidden && s.id !== 'sh-priv');
    $('#sh-priv').hidden = false; $('#scrim').hidden = false; $('#scrim').classList.add('top');
    $('#pvOk').onclick = () => { $('#sh-priv').hidden = true; $('#scrim').classList.remove('top'); if (!prev) $('#scrim').hidden = true; };
  }
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[data-priv]'); if (a) { e.preventDefault(); openPriv(); } });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#sSrcD,[data-srcd]')) { e.preventDefault(); openSources(); } });
  // v26z12: «مصادر المحتوى» — سطر لكل مصدر «الاسم: الاستعمال» مع رابطه، والتفاصيل (الرخص والإصدارات) في openSources()
  const SRC_HTML = () => `<label class="lbl">مصادر المحتوى</label><ul class="srcl"><li><b>مجمع الملك فهد لطباعة المصحف الشريف:</b> صفحات المصحف، بنسختها الرقمية الرسمية. <bdi dir="ltr"><a href="https://qurancomplex.gov.sa/mushaf-printing" target="_blank" rel="noopener">qurancomplex.gov.sa</a></bdi></li><li><b>مركز تفسير للدراسات القرآنية:</b> «المختصر في تفسير القرآن الكريم». <bdi dir="ltr"><a href="https://tafsir.net" target="_blank" rel="noopener">tafsir.net</a></bdi></li><li><b>موسوعة القرآن الكريم QuranEnc.com:</b> نصّا المختصر وتفسير السعدي، منقولان كما وردا دون تعديل. <bdi dir="ltr"><a href="https://quranenc.com/ar" target="_blank" rel="noopener">quranenc.com</a></bdi></li><li><b>الدرر السنية:</b> مراجعة تخريج الأحاديث والأذكار. <bdi dir="ltr"><a href="https://dorar.net" target="_blank" rel="noopener">dorar.net</a></bdi></li><li><b>صحيح البخاري وصحيح مسلم:</b> مصدر الأذكار وفضائلها، بالرجوع إلى sunnah.com. <bdi dir="ltr"><a href="https://sunnah.com" target="_blank" rel="noopener">sunnah.com</a></bdi></li><li><b>Quran Foundation:</b> التلاوات (الحصري، والعفاسي، والمنشاوي، والسديس، والشريم، وعبد الباسط) وتوقيت آياتها. <bdi dir="ltr"><a href="https://quran.com" target="_blank" rel="noopener">quran.com</a></bdi></li><li><b>المكتبة الصوتية للقرآن الكريم MP3Quran.net:</b> تلاوتا ماهر المعيقلي وبدر التركي، وتوقيت آيات «المصحف المجوّد». <bdi dir="ltr"><a href="https://www.mp3quran.net" target="_blank" rel="noopener">mp3quran.net</a></bdi></li><li><b>quran-ws/quran-svg:</b> مواضع الآيات على الصفحة. <bdi dir="ltr"><a href="https://github.com/quran-ws/quran-svg" target="_blank" rel="noopener">github.com/quran-ws/quran-svg</a></bdi></li><li><b>Tanzil:</b> أسماء السور والأجزاء والأحزاب. <bdi dir="ltr"><a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a></bdi></li><li><b>adhan-js:</b> أوقات الصلاة بطريقة أم القرى، محسوبة على جهازك. <bdi dir="ltr"><a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noopener">github.com/batoulapps/adhan-js</a></bdi></li></ul><button class="btn full" id="sSrcD" type="button">التفاصيل</button>`;
  const BK_PFX = /\/preview\//.test(location.pathname) ? 'mushaf.preview.' : 'mushaf.';
  const BK_KEYS = { v1: 'o', notes: 'a', 'notes.del': 'o', adhkar: 'o' };   // المفاتيح ونوع كل منها (كائن/مصفوفة)
  const BK_MAX = 5 * 1024 * 1024;
  const BKP_HTML = () => `<label class="lbl">النسخة الاحتياطية</label>` + hi('dl', 'bkx', 'احفظ نسخة في ملف', 'ملاحظاتك وخطتك ومحفوظك وإعداداتك وأذكارك') + hi('up', 'bki', 'استرجع من ملف', 'يحلّ محلّ بيانات هذا الجهاز بعد التأكيد') + hi('lock', 'priv', 'الخصوصية', 'ما يُحفظ على جهازك وما يُزامَن');
  function bkpExport() {
    const data = {};
    for (const [k, t] of Object.entries(BK_KEYS)) { const v = localStorage.getItem(BK_PFX + k); if (v == null) continue; try { const o = JSON.parse(v); if (k === 'v1' && o && o.rem) { o.rem = Object.assign({}, o.rem); delete o.rem.sub; } data[k] = o; } catch (e) {} }
    const out = JSON.stringify({ app: 'mushaf', kind: 'backup', v: 1, created: new Date().toISOString(), data }, null, 1);
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/json' })); a.download = `mushaf-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('حُفِظت النسخة في ملف.');
  }
  function bkpCheck(txt) {   // يرجع البيانات المقبولة أو رسالة خطأ
    if (txt.length > BK_MAX) return 'الملف أكبر من المسموح.';
    let j; try { j = JSON.parse(txt); } catch (e) { return 'الملف ليس نسخة احتياطية صالحة.'; }
    if (!j || j.app !== 'mushaf' || j.kind !== 'backup' || j.v !== 1 || !j.data || typeof j.data !== 'object') return 'الملف ليس نسخة احتياطية من هذا التطبيق.';
    const out = {};
    for (const [k, v] of Object.entries(j.data)) {
      const t = BK_KEYS[k]; if (!t) return 'في الملف بيانات غير معروفة.';
      if (t === 'a' ? !Array.isArray(v) : (!v || typeof v !== 'object' || Array.isArray(v))) return 'بنية الملف غير صحيحة.';
      out[k] = v;
    }
    if (out.notes && !out.notes.every(n => n && typeof n.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(n.id) && Number.isInteger(+n.p) && +n.p >= 1 && +n.p <= 604 && typeof n.text === 'string' && (n.k == null || /^\d{1,3}:\d{1,3}$/.test(n.k)))) return 'في الملاحظات قيم غير صحيحة.';
    if (out.v1 && out.v1.rem) delete out.v1.rem.sub;
    return out;
  }
  function bkpPick() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > BK_MAX) { toast('الملف أكبر من المسموح.'); return; }
      const r = bkpCheck(await f.text()); if (typeof r === 'string') { toast(r); return; }
      const ok = await ask('سيحلّ محتوى الملف محلّ بياناتك الحالية على هذا الجهاز (الملاحظات، والخطة، والمحفوظ، والإعدادات، والأذكار). أتريد المتابعة؟', 'استرجع');
      if (!ok) return;
      for (const [k, v] of Object.entries(r)) { if (k === 'v1') { const cur = JSON.parse(localStorage.getItem(BK_PFX + 'v1') || '{}'); if (cur.rem && cur.rem.sub) { v.rem = Object.assign({}, v.rem, { sub: cur.rem.sub }); } } localStorage.setItem(BK_PFX + k, JSON.stringify(v)); }
      toast('استُرجِعت بياناتك.'); setTimeout(() => location.reload(), 900);
    };
    inp.click();
  }
  /* ---------- المزيد والمصادر ---------- */
  const CK = '<svg class="ck" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  function openMore() {
    openSheet('more');
    const s = ST.get(), rid = s.reciter;
    const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, n]) => `<button data-v="${v}" class="${val === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    $('#moreBody').innerHTML = `
       <button class="btn full dl" id="mDl"><b>تنزيل المصحف كاملًا</b><small>نحو ${viewFull() ? 61 : 89} ميجابايت، للقراءة دون إنترنت</small></button>
       <div class="bar" id="dlBar" hidden><i style="width:0%"></i></div>
       <button class="btn full" id="mSrc">المصادر</button>
       <button class="btn full" id="mInst">طريقة التثبيت على الآيفون</button>
       <button class="btn full" id="mPriv">الخصوصية</button>
       <p class="muted sm" style="line-height:1.8;margin-top:14px">${PRIV_LINE()} صفحات المصحف هي النسخة الرسمية من مجمع الملك فهد، وتُحفظ على جهازك بعد فتحها. والتلاوات تُبَثّ عند التشغيل، إلا السور التي تنزّلها بنفسك فتُحفظ على جهازك.</p>` + creditHTML();
    $('#moreBody').onclick = e => {
      const r = e.target.closest('[data-r]');
      if (r) { ST.setReciter(+r.dataset.r); openMore(); return; }
      const vw = e.target.closest('#mView [data-v]'); if (vw) { ST.set('view', vw.dataset.v); applyTheme(); layout(); rebuildLeaves(); requestAnimationFrame(refit); openMore(); return; }
      if (e.target.closest('#mDl')) downloadAll();
      if (e.target.closest('#mSrc')) openSources();
      if (e.target.closest('#mPriv')) openPriv();
      if (e.target.closest('#mInst')) { closeSheets(); showInstall(true); }
    };
  }
  async function downloadAll() {
    const bar = $('#dlBar'), btn = $('#mDl'); bar.hidden = false; btn.disabled = true;
    const c = await caches.open('mushaf-preview-pages-v2'); let done = 0;
    const ps = [...Array(N).keys()].map(i => i + 1);
    const pad = p => String(p).padStart(3, '0');
    const urls = p => [viewFull() ? `../pages/${pad(p)}.webp` : `../lines/${pad(p)}.webp`];
    const worker = async () => { while (ps.length) { const p = ps.shift(); for (const rel of urls(p)) { const u = new URL(rel, location.href).href; if (!(await c.match(u))) { try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (e) {} } } done++; bar.firstElementChild.style.width = (done / N * 100).toFixed(1) + '%'; btn.innerHTML = `<b>جارٍ التنزيل… ${ar(done)}/${ar(N)}</b>`; } };
    await Promise.all([1, 2, 3, 4].map(worker));
    btn.innerHTML = '<b>تم تنزيل المصحف كاملًا.</b>'; toast('أصبح المصحف كاملًا متاحًا دون إنترنت.');
  }
  const L = t => `<bdi dir="ltr">${t}</bdi>`;
  function openSources() {
    openSheet('sources');
    $('#srcBody').innerHTML = `
      <p>المصحف المعروض هو النسخة الرقمية الرسمية الصادرة عن مجمع الملك فهد لطباعة المصحف الشريف (رواية حفص، إصدار 1441هـ، 604 صفحات).</p>
      <h4>صفحات المصحف</h4>
      <p>الصفحات من النسخة الرسمية الصادرة عن المجمع، من صفحة «مصحف المدينة النبوية لأعمال الطباعة»:<br>${L('<a href="https://qurancomplex.gov.sa/mushaf-printing" target="_blank" rel="noopener">qurancomplex.gov.sa/mushaf-printing</a>')}</p>
      <p>وتُعرض كما أصدرها المجمع، بدون تعديل في النص أو في ترتيب الأسطر. في عرض «الصفحة بإطارها» تظهر بإطارها وألوانها الرسمية وعناوين السور وترويسة الجزء ورقم الصفحة. وفي عرض «ملء الشاشة» تُعرض أسطر الصفحة نفسها بكلماتها وترتيبها، مع مسافة أوسع بين الأسطر، وزخرفة فواصل الآيات وإطارات أسماء السور باللون الذي تختاره، البيج أو الأزرق، بدلًا من الأخضر.</p>
      <p><b>حقوق الاستخدام (من صفحة المجمع):</b> «يمكن استخدام النسخة المذكورة مجانًا في المجالات الشخصية والأعمال الفردية كافة… ومواقع الإنترنت والبرامج الحاسوبية وغيرها، داخل المملكة وخارجها». والمجمع غير مسؤول عن الأخطاء الفنية الناتجة عن الاستخدام.</p>
      <h4>تحديد الآيات</h4>
      <p>مواضع الآيات طبقة شفافة فوق الصورة، من مشروع ${L('quran-ws/quran-svg')} المستخرج من ملفات المجمع (رخصة ${L('CC BY 4.0')}). التظليل لا يغيّر صورة المصحف.</p>
      <p>أسماء السور والأجزاء والأحزاب من بيانات ${L('Tanzil')} (رخصة ${L('CC BY 3.0')}).</p>
      <h4>التلاوات</h4>
      <p>التسجيلات من ${L('Quran Foundation')} ومرآة ${L('EveryAyah')}، وحقوقها لأصحابها. الاستماع بالبث، ولك أن تنزّل سورة بطلبك للاستماع دون إنترنت: تبقى في تخزين التطبيق الخاص على جهازك، ولا تُصدَّر لتطبيقات أخرى، وتُحذف متى حذفتها. لا إعادة نشر. التلاوة المتصلة من ملف السورة كاملًا مع توقيت كل آية من ${L('Quran Foundation')}.</p>
      <p>تلاوة الشيخ ماهر المعيقلي من ${L('MP3Quran.net')}، المكتبة الصوتية للقرآن الكريم: «المصحف المجود» برواية حفص عن عاصم (رقم 133) مع توقيت الآيات المنشور في واجهة الموقع، فيعمل معه تتبع الآيات والتكرار والتلاوة المتصلة؛ و«المرتّل» (رقم 102)، ولأن المصدر لا ينشر توقيت آياته فقد ولّدنا التوقيت آليًا من ملفات السور نفسها بمواءمة نص الآيات مع الصوت بنموذج تعرّف كلام عربي مفتوح المصدر، فقد تتقدم حدود بعض الآيات أو تتأخر قليلًا.</p>
      <p>تلاوة الشيخ بدر التركي (رواية حفص عن عاصم، مرتّل) من ${L('MP3Quran.net')}، المكتبة الصوتية للقرآن الكريم، القارئ رقم 254. وينص موقع MP3Quran على أن حقوق مواده متاحة للجميع، ويأذن لأي زائر أو مطور باستخدام روابطه: ${L('<a href="https://www.mp3quran.net/privacy-en.html" target="_blank" rel="noopener">mp3quran.net/privacy-en.html</a>')}. المصدر لا ينشر توقيت الآيات لهذه التلاوة، فولّدناه آليًا من ملفات السور نفسها بالطريقة ذاتها، فقد تتقدم حدود بعض الآيات أو تتأخر قليلًا.</p>
      <p>القارئ الحالي: ${AU.reciter(ST.get().reciter).name}.</p>
      <p>التطبيق يتأكد قبل التشغيل أن التسجيل يطابق الآية المحددة.</p>
      <p>${L('<a href="https://api-docs.quran.com/legal/developer-terms/" target="_blank" rel="noopener">Quran Foundation — Developer Terms</a>')}</p>
      <h4>التفسير</h4>
      <p><b>المختصر في تفسير القرآن الكريم</b>، إعداد مركز تفسير للدراسات القرآنية ${L('<a href="https://tafsir.net" target="_blank" rel="noopener">tafsir.net</a>')}. منقول كما ورد دون تعديل من موسوعة القرآن الكريم ${L('QuranEnc.com')} (المفتاح ${L('arabic_mokhtasar')})، عبر واجهتها البرمجية. الإصدار على صفحة المصدر في 27 نوفمبر 2026: ${L('V1.0.0')} (${L('15/02/2017')}). تاريخ نقل نسخة التطبيق: 21 نوفمبر 2026.<br>${L('<a href="https://quranenc.com/ar/browse/arabic_mokhtasar" target="_blank" rel="noopener">quranenc.com/ar/browse/arabic_mokhtasar</a>')}</p>
      <p><b>تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)</b>، للشيخ عبد الرحمن بن ناصر السعدي. منقول كما ورد دون تعديل من صفحات موسوعة القرآن الكريم ${L('QuranEnc.com')} (${L('arabic_saadi')}). الإصدار على صفحة المصدر في 27 نوفمبر 2026: ${L('V1.0.0')} (${L('27/07/2026')}). تاريخ نقل نسخة التطبيق: 21 نوفمبر 2026.<br>${L('<a href="https://quranenc.com/ar/browse/arabic_saadi" target="_blank" rel="noopener">quranenc.com/ar/browse/arabic_saadi</a>')}</p>
      <p>شروط ${L('QuranEnc.com')} لإعادة النشر: عدم التعديل أو الإضافة أو الحذف، والإشارة بوضوح إلى الناشر وإلى المصدر (${L('QuranEnc.com')})، وذكر رقم الإصدار، وإبقاء معلومات النسخة، وإفادة المصدر بأي ملاحظة، وتحديث النص وفق الإصدارات الجديدة، وعدم تضمين إعلانات لا تليق بمعاني القرآن. التطبيق مجاني وبلا إعلانات.</p>
      <h4>الأذكار</h4>
      <p>لا يدخل في الأذكار والمسبحة إلا القرآن الكريم وما رواه البخاري أو مسلم، بالرجوع إلى صحيحي البخاري ومسلم في ${L('<a href="https://sunnah.com" target="_blank" rel="noopener">sunnah.com</a>')} والدرر السنية ${L('<a href="https://dorar.net" target="_blank" rel="noopener">dorar.net</a>')}. ولكل ذكر زر «المصدر» يفتح صفحة الحديث أو الآية نفسها.</p>
      <p>نص الآيات في الأذكار: نص مجمع الملك فهد لطباعة المصحف الشريف (حفص) عبر ${L('Quran Foundation')}، بخط ${L('KFGQPC HAFS Uthmanic Script')} (الإصدار 2.2) من المجمع، يُستخدم مجانًا ولا يُعدَّل ولا يُباع.</p>
      <p>${L('Tanzil Quran Text (Uthmani, Version 1.1) Copyright (C) 2007-2026 Tanzil Project. License: Creative Commons Attribution 3.0.')} استُعمِل للمطابقة فقط ولا يُعرض. ${L('<a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a>')} · ${L('<a href="https://tanzil.net/docs/text_license" target="_blank" rel="noopener">text_license</a>')}</p>
      <p>أوقات الصلاة والشروق: ${L('adhan-js')} (رخصة ${L('MIT')})، بطريقة أم القرى، والحساب على جهازك دون إرسال موقعك. ${L('<a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noopener">github.com/batoulapps/adhan-js</a>')}</p>
      <p>التاريخ الهجري: تقويم أم القرى من تقويم المتصفح على جهازك.</p>
      <h4>الخصوصية وشروط الاستخدام</h4>
      <p><a href="privacy.html" target="_blank" rel="noopener" data-priv>سياسة الخصوصية</a> · <a href="terms.html" target="_blank" rel="noopener">شروط الاستخدام</a></p>`;
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
    if (e.target.matches('input,select,textarea') || e.target.isContentEditable) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); $('#navNext').click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); $('#navPrev').click(); }
    if (e.key === 'Escape') { closeSheets(); clearSel(); }
  });
  let wheelLock = 0;
  document.addEventListener('wheel', e => {
    if (e.target.closest('input,select,textarea,.sheet,.tmbar,#player,#tool,.notecard')) return;
    if (!e.target.closest('#reader,.nav')) return;
    const dy = e.deltaY, dx = e.deltaX;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    e.preventDefault();
    if (Date.now() < wheelLock) return;
    wheelLock = Date.now() + 420;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) $('#navNext').click(); else $('#navPrev').click();
    } else {
      if (dy > 0) $('#navNext').click(); else $('#navPrev').click();
    }
  }, { passive: false });

  /* ---------- التثبيت ---------- */
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function showInstall(force) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (standalone && !force) return;
    if (!force && localStorage.getItem('mushaf.preview.inst')) return;
    const box = $('#install');
    box.innerHTML = `<b>ثبّت المصحف الذكي على الآيفون</b><br>افتح الرابط في ${L('Safari')}، ثم زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، ثم «إضافة».<br>بعدها يفتح كتطبيق مستقل بدون شريط المتصفح.<div style="text-align:left;margin-top:6px"><button class="btn" id="instOk">تم</button></div>`;
    box.hidden = false;
    $('#instOk').onclick = () => { box.hidden = true; localStorage.setItem('mushaf.preview.inst', '1'); };
  }

  /* ---------- البدء ---------- */
  async function boot() {
    applyTheme(); layout(); navOn('mushaf');
    const dc = $('#deskCredit'); if (dc) dc.innerHTML = creditHTML({ desktop: true });
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
    tmkLoad(); wlLoad();   // حدود كلمات الآيات للتظليل اللطيف
    if (params.has('wird')) { history.replaceState(null, '', location.pathname); setTimeout(openWird, 300); }
    setTimeout(() => showInstall(false), 1500);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/mushaf/preview/sw.js', { scope: '/mushaf/preview/' }).catch(() => {});
  }
  /* ---------- التسميع: الآيات مخفية، وتنكشف كل آية عند تلاوتها صحيحة أو باللمس ---------- */
  // المطابقة على نص Tanzil (Simple Clean) بعد التطبيع، بسماحية خطأ حرف واحد في الكلمة. لا يُعرض أي نص: الكشف يكون على صورة الصفحة نفسها.
  // المطابقة في js/tmatch.js (TMM): تطبيع، تسامح مع أخطاء التعرف، الحروف المقطعة، البسملة والاستعاذة، وخاتمة الآية شرط
  /* ---------- غطاء التسميع: سطر واحد في وسط كل سطر، والميداليات مكشوفة ---------- */
  const tmAnim = new Set();
  function tmReduce() { return !window.__tmShotDur && !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function tmDur() { return window.__tmShotDur || (tmReduce() ? 200 : 320); }
  function tmLineFade() { const d = tmDur(); return window.__tmShotDur ? Math.max(80, Math.round(d * 200 / 320)) : (tmReduce() ? 200 : 200); }
  function tmTextDelay() { const d = tmDur(); return window.__tmShotDur ? Math.round(d * 80 / 320) : (tmReduce() ? 0 : 80); }
  function tmTextDur() { return Math.max(80, tmDur() - tmTextDelay()); }
  function tmMap(svg) {
    const vb = svg && svg.viewBox && svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const vw = (vb && vb.width) || 1, vh = (vb && vb.height) || 1;
    const s = Math.min(r.width / vw, r.height / vh) || 1;
    return { vx: vb ? vb.x : 0, vy: vb ? vb.y : 0, s, ox: (r.width - vw * s) / 2, oy: (r.height - vh * s) / 2, u: 1 / s };
  }
  function tmXY(m, x, y) { return { x: m.ox + (x - m.vx) * m.s, y: m.oy + (y - m.vy) * m.s }; }
  function tmEscK(k) { return String(k).replace(/[^0-9:.-]/g, ''); }
  function tmMaskId(p, k) { return 'tmM' + p + '_' + String(k).replace(':', '-'); }
  function tmVisible(k) {
    const v = TM.rv.get(k);
    if (!v || v === 'skip' || v === 'miss') return false;
    if (TM.mode === 'page' && !TM.flush) return false;
    return true;
  }
  function tmSubs(d) {
    return String(d || '').split('Z').filter(t => t.trim()).map(sub => {
      const n = (sub.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      if (n.length < 4) return null;
      const xs = [], ys = [];
      for (let i = 0; i < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return { x0, x1, y0, y1, yc: (y0 + y1) / 2, h: y1 - y0, w: x1 - x0 };
    }).filter(Boolean);
  }
  function tmBands(pd) {
    const L = pd && pd.lines, s = LS || 0;
    if (!L || !pd.crop) return null;
    const cy = pd.crop[1], m = L.m;
    if (!m || !m.length) return null;
    const diffs = [];
    for (let i = 1; i < m.length; i++) diffs.push(m[i] - m[i - 1]);
    diffs.sort((a, b) => a - b);
    const typ = diffs.length ? diffs[diffs.length >> 1] : 27;
    const bands = [];
    const n = m.length + 1;
    for (let i = 0; i < n; i++) {
      const top = i === 0 ? cy : m[i - 1];
      const bot = i < m.length ? m[i] : m[m.length - 1] + typ;
      const y0 = top + i * s - (i > 0 ? s / 2 : 0);
      const y1 = bot + i * s + (i < n - 1 ? s / 2 : 0);
      const yc = (top + bot) / 2 + i * s;
      bands.push({ i, y0, y1, yc, h: y1 - y0 });
    }
    return bands;
  }
  function tmSplitSubs(subs, bands) {
    const out = [];
    if (bands && bands.length) {
      for (const s of subs) {
        const hit = bands.filter(b => Math.min(s.y1, b.y1) - Math.max(s.y0, b.y0) > 5);
        if (!hit.length) { out.push(s); continue; }
        for (const b of hit) {
          const y0 = Math.max(s.y0, b.y0), y1 = Math.min(s.y1, b.y1);
          if (y1 - y0 < 4) continue;
          out.push({ x0: s.x0, x1: s.x1, y0, y1, yc: b.yc, h: y1 - y0, w: s.w, k: s.k, how: s.how, nx: s.nx, li: b.i });
        }
      }
      return out;
    }
    const hs = subs.filter(s => s.h < 42).map(s => s.h).sort((a, b) => a - b);
    const typ = hs.length ? hs[hs.length >> 1] : 28;
    for (const s of subs) {
      if (s.h <= typ * 1.45) { out.push(s); continue; }
      const n = Math.max(2, Math.round(s.h / typ));
      const h = s.h / n;
      for (let i = 0; i < n; i++) {
        const y0 = s.y0 + i * h, y1 = (i === n - 1) ? s.y1 : y0 + h;
        out.push(Object.assign({}, s, { y0, y1, yc: (y0 + y1) / 2, h: y1 - y0, li: i }));
      }
    }
    return out;
  }
  function tmMedal(subs) {
    if (!subs.length) return null;
    let last = subs[0];
    for (const s of subs) {
      const later = (s.li != null && last.li != null) ? s.li > last.li : (s.yc > last.yc + 0.2);
      if (later || (!later && (s.li == null || s.li === last.li) && Math.abs(s.yc - last.yc) <= 0.8 && s.x0 < last.x0)) last = s;
    }
    const r = Math.max(5.2, Math.min(last.h * 0.36, last.w * 0.42, 11.6));
    return { cx: last.x0 + r, cy: last.yc, r, y0: last.y0, y1: last.y1, li: last.li };
  }
  function tmMergeX(segs) {
    const a = segs.map(s => [s.x0, s.x1]).sort((u, v) => u[0] - v[0]);
    const out = [];
    for (const s of a) {
      if (!out.length || s[0] > out[out.length - 1][1] + 0.4) out.push(s.slice());
      else out[out.length - 1][1] = Math.max(out[out.length - 1][1], s[1]);
    }
    return out;
  }
  function tmSplitAround(intervals, hole, gapL, gapR) {
    if (!hole) return intervals;
    if (gapR == null) gapR = gapL;
    const L = hole.cx - hole.r - gapL, R = hole.cx + hole.r + gapR;
    const out = [];
    for (const [a, b] of intervals) {
      if (b <= L || a >= R) out.push([a, b]);
      else {
        if (a < L - 0.4) out.push([a, L]);
        if (b > R + 0.4) out.push([R, b]);
      }
    }
    return out;
  }
  function tmCluster(items) {
    const list = items.slice().sort((a, b) => a.yc - b.yc);
    const lines = [];
    for (const s of list) {
      const last = lines[lines.length - 1];
      const tol = Math.max(4, Math.min(s.h, last ? last.h : s.h) * 0.45);
      if (last && Math.abs(s.yc - last.yc) < tol) {
        last.segs.push(s);
        last.y0 = Math.min(last.y0, s.y0);
        last.y1 = Math.max(last.y1, s.y1);
        last.h = last.y1 - last.y0;
        const mids = last.segs.map(x => x.yc).sort((a, b) => a - b);
        last.yc = mids[(mids.length - 1) >> 1];
      } else lines.push({ yc: s.yc, y0: s.y0, y1: s.y1, h: s.h, segs: [s] });
    }
    return lines;
  }
  /* الغطاء الجديد: الحبر نفسه يُخفى بقناع SVG على شرائط الصورة، فيبقى الورق كما هو تمامًا (وفي الليلي يُعكس معه).
     حدود كل آية وكل ميدالية وخط القاعدة محسوبة مسبقًا من الصور في data/tmk.json. الميداليات لا تُغطّى أبدًا. */
  let TMK = null, TMKp = null;
  function tmkLoad() {
    return TMKp || (TMKp = fetch('data/tmk.json').then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => { TMK = j; for (const [p, el] of leaves) { const pd = pageData.get(p); if (pd) hlBuild(el, p, pd); } if (TM.on) tmPaintOverlay(); }).catch(() => { TMKp = null; }));
  }
  function tmCut(iv, holes, g) {
    let out = [iv];
    for (const h of holes) {
      const L = h[0] - g, R = h[1] + g, nx = [];
      for (const [a, b] of out) { if (b <= L || a >= R) nx.push([a, b]); else { if (a < L) nx.push([a, L]); if (b > R) nx.push([R, b]); } }
      out = nx;
    }
    return out;
  }
  function tmClearLeaf(el) {
    el.querySelectorAll('[data-tmm]').forEach(n => n.remove());
    el.querySelectorAll('svg.tx [mask]').forEach(n => n.removeAttribute('mask'));
    const pp = el.querySelector('.tm-paper'); if (pp) pp.style.display = 'none';
    const ov = el.querySelector('svg.tm-ov'); if (ov && ov.firstChild) ov.replaceChildren();
    const ui = el.querySelector('.tm-ui'); if (ui && ui.firstChild) ui.replaceChildren();
    const t2 = el.querySelector('svg.tx'); if (t2) t2.__tmSig = '';
  }
  function tmPaintOverlay(root) {
    const leavesEl = root ? [root] : [...leaves.values()];
    if (TM.on && !TMK) tmkLoad();
    for (const el of leavesEl) {
      const tx = el.querySelector('svg.tx'), ov = el.querySelector('svg.tm-ov');
      if (!tx || !ov) continue;
      if (ov.getAttribute('viewBox') !== tx.getAttribute('viewBox')) ov.setAttribute('viewBox', tx.getAttribute('viewBox') || '');
      const p = +el.dataset.p, pd = pageData.get(p), data = TMK && TMK[p];
      if (!TM.on || p !== TM.p || !pd || !data || viewFull()) { if (tx.__tmSig !== '') tmClearLeaf(el); continue; }
      const flash = new Set([...el.querySelectorAll('g.hot path.fl')].map(x => x.dataset.k));
      const L = pd.lines, s = LS || 0, D = L ? L.D : 0, p12 = !L;
      const masked = k => !flash.has(k) && (!tmVisible(k) || tmAnim.has(k));
      const durStyle = `--tm-dur:${tmWipeDur()}ms;--tm-hl-dur:${Math.round(tmWipeDur() * .55)}ms`;
      const masks = new Map();   // مفتاح القناع ← محتواه
      let hl = '';
      const animOrder = new Map();
      for (const ln of data) {
        const segs = ln.segs.filter(sg => masked(sg[0]));
        if (!segs.length) continue;
        const key = p12 ? 'p' : 'l' + ln.i;
        const meds = ln.m;
        const dy = ln.i != null ? ln.i * (s - D) : 0;
        let body = masks.get(key) || '';
        const xs = ln.segs.map(sg => [sg[1], sg[2]]);
        const minX = Math.min(...xs.map(v => v[0])), maxX = Math.max(...xs.map(v => v[1]));
        for (const sg of segs) {
          const k = sg[0];
          let x0 = sg[1], x1 = sg[2];
          if (!p12) { if (x0 <= minX + 0.01 && ln.xa != null) x0 = Math.min(x0, ln.xa); if (x1 >= maxX - 0.01 && ln.xb != null) x1 = Math.max(x1, ln.xb); }
          const y0 = sg.length > 3 ? sg[3] : ln.y0, y1 = sg.length > 3 ? sg[4] : ln.y1;
          const anim = tmAnim.has(k);
          let ord = 0;
          if (anim) { ord = animOrder.get(k) || 0; animOrder.set(k, ord + 1); }
          const cls = 'tmc' + (anim ? ' tm-out' : '');
          const st = anim ? ` style="${durStyle};animation-delay:${ord * 90}ms"` : '';
          body += `<rect class="${cls}" data-k="${tmEscK(k)}" x="${x0.toFixed(2)}" y="${(y0 - 0.5).toFixed(2)}" width="${(x1 - x0).toFixed(2)}" height="${(y1 - y0 + 1).toFixed(2)}" fill="${p12 ? '#fff' : '#000'}"${st}/>`;
          const how = TM.rv.get(k), bad = how === 'skip' || how === 'miss';
          for (const [a, b] of tmCut([x0 + 0.6, x1 - 0.6], meds, 2.2)) {
            if (b - a < 3) continue;
            const y = (ln.hy + dy).toFixed(2);
            hl += `<line class="tm-hl${bad ? ' bad' : ''}${anim ? ' tm-out' : ''}" data-k="${tmEscK(k)}" x1="${a.toFixed(2)}" y1="${y}" x2="${b.toFixed(2)}" y2="${y}"${anim ? ` style="${durStyle};animation-delay:${ord * 90}ms"` : ''}/>`;
          }
        }
        masks.set(key, body);
      }
      // الميداليات دائمًا مكشوفة: تُرسم فوق الغطاء بلون «اظهر»
      const sig = [...masks].map(([k, v]) => k + v).join('|') + hl + '@' + s.toFixed(3);
      if (tx.__tmSig === sig) continue;
      tx.__tmSig = sig;
      el.querySelectorAll('[data-tmm]').forEach(n => n.remove());
      tx.querySelectorAll('[mask]').forEach(n => n.removeAttribute('mask'));
      const pp = el.querySelector('.tm-paper'); if (pp) pp.style.display = 'none';
      let defs = tx.querySelector('defs'); if (!defs) { defs = document.createElementNS(NS, 'defs'); tx.prepend(defs); }
      const vb = (tx.getAttribute('viewBox') || '0 0 1 1').split(/[ ,]+/).map(Number);
      const big = `x="${vb[0] - 20}" y="${vb[1] - 200}" width="${vb[2] + 40}" height="${vb[3] + 400}"`;
      let html = '';
      const medsAll = p12 ? data.flatMap(ln => ln.m) : null;
      for (const [key, body] of masks) {
        const id = `tmk${p}_${key}`;
        let medR = '';
        const mm = p12 ? medsAll : (data.find(ln => 'l' + ln.i === key) || { m: [] }).m;
        for (const m of mm) medR += `<ellipse cx="${((m[0] + m[1]) / 2).toFixed(2)}" cy="${((m[2] + m[3]) / 2).toFixed(2)}" rx="${((m[1] - m[0]) / 2 + 0.2).toFixed(2)}" ry="${((m[3] - m[2]) / 2 + 0.2).toFixed(2)}" fill="${p12 ? '#000' : '#fff'}"/>`;
        html += `<mask id="${id}" data-tmm="1" maskUnits="userSpaceOnUse" ${big}><rect ${big} fill="${p12 ? '#000' : '#fff'}"/>${body}${medR}</mask>`;
      }
      defs.insertAdjacentHTML('beforeend', html);
      for (const key of masks.keys()) {
        const id = `url(#tmk${p}_${key})`;
        if (p12) { if (pp) { pp.style.display = ''; pp.setAttribute('mask', id); } }
        else { const g = tx.querySelectorAll('g.st')[+key.slice(1)]; const im = g && g.querySelector('image'); if (im) im.setAttribute('mask', id); }
      }
      ov.innerHTML = hl ? `<g class="tm-hls">${hl}</g>` : '';
    }
  }
  function tmWipeDur() { return window.__tmShotDur || (tmReduce() ? 200 : 450); }
  function tmClearOverlays() {
    tmAnim.clear(); tmAnimT.clear();
    leaves.forEach(el => tmClearLeaf(el));
  }
  // الكشف: الغطاء ينكمش من اليسار إلى اليمين ويتلاشى معًا (~450ms). يُحرَّك بالخصائص نفسها عبر rAF لأن Safari لا يعيد رسم القناع مع حركات CSS داخله
  const tmAnimT = new Map();
  let tmRaf = 0;
  function tmEase(t) { return 1 - Math.pow(1 - t, 3); }
  function tmAnimFrame() {
    tmRaf = 0;
    const now = performance.now(), dur = tmWipeDur();
    for (const [k, t0] of tmAnimT) {
      const rs = book.querySelectorAll(`rect.tmc.tm-out[data-k="${tmEscK(k)}"]`);
      rs.forEach((r, i) => {
        if (r.__x0 == null) { r.__x0 = +r.getAttribute('x'); r.__w0 = +r.getAttribute('width'); }
        const t = Math.max(0, Math.min(1, (now - t0 - i * 90) / dur)), e = tmEase(t);
        r.setAttribute('x', (r.__x0 + r.__w0 * e).toFixed(2));
        r.setAttribute('width', Math.max(0, r.__w0 * (1 - e)).toFixed(2));
        r.setAttribute('opacity', (1 - e).toFixed(3));
      });
    }
    if (tmAnimT.size) tmRaf = requestAnimationFrame(tmAnimFrame);
  }
  function tmStartAnim(k) {
    if (!TM.on || !tmVisible(k)) return Promise.resolve();
    if (tmReduce() || window.__tmShotHold) { tmPaintOverlay(); return Promise.resolve(); }
    tmAnim.add(k);
    tmPaintOverlay();
    const sel = `rect.tmc.tm-out[data-k="${tmEscK(k)}"]`;
    const gs = [...book.querySelectorAll(sel)];
    if (!gs.length) { tmAnim.delete(k); tmPaintOverlay(); return Promise.resolve(); }
    tmAnimT.set(k, performance.now());
    if (!tmRaf) tmRaf = requestAnimationFrame(tmAnimFrame);
    return new Promise(res => {
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        tmAnimT.delete(k);
        tmAnim.delete(k);
        tmPaintOverlay();
        res();
      };
      setTimeout(finish, tmWipeDur() + 90 * Math.max(0, gs.length - 1) + 60);
    });
  }
  async function tmFlush() {
    if (!TM.on || TM.flush) return;
    TM.flush = true;
    for (const k of TM.keys) if (!TM.rv.has(k)) TM.rv.set(k, 'miss');
    tmPaint();
    const order = TM.keys.filter(k => { const v = TM.rv.get(k); return v === 'speech' || v === 'tap'; });
    for (const k of order) await tmStartAnim(k);
    tmPaint();
  }
  function tmSetMode(mode) {
    const m = mode === 'page' ? 'page' : 'ayah';
    if (TM.mode === m) return;
    TM.mode = m;
    if (m === 'ayah') TM.flush = TM.flush || false;
    if (m === 'page') TM.flush = false;
    tmPaint();
  }

    async function tmExpect() {
    const k = TM.keys[TM.i], k2 = TM.keys[TM.i + 1]; if (!k) { TM.E = []; TM.En = null; return; }
    try { const rows = await loadText(); const r = rows.find(x => x.k === k), r2 = k2 && rows.find(x => x.k === k2); TM.E = r ? TMM.expect(r.t, k) : []; TM.En = r2 ? TMM.expect(r2.t, k2) : null; } catch (e) { TM.E = []; TM.En = null; }
  }
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  if (/(?:^|[?&])tmdebug=1(?:&|$)/.test(location.search)) TM.debug = true;
  function tmSafariUrl() {
    const can = document.querySelector('link[rel="canonical"]');
    const u = new URL((can && can.href) || (location.origin + location.pathname), location.href);
    u.searchParams.set('p', String(cur || TM.p || 1));
    return u.toString();
  }
  function tmDbgPaint(ev, txt) {
    const box = $('#tmDbg'); if (!box || !TM.debug) return;
    if (ev) { TM.dbgLines = TM.dbgLines || []; TM.dbgLines.push((Date.now() % 1e6) + ' ' + ev + (txt ? ' ' + txt : '')); if (TM.dbgLines.length > 40) TM.dbgLines.splice(0, TM.dbgLines.length - 40); }
    const k = TM.keys[TM.i] || '—', heard = (TM.sess && TM.sess.length ? TM.sess.join(' ') : (TM.heardTxt || ''));
    let score = '';
    if (TM.E && TM.E.length && heard) {
      const r = TMM.judge(TMM.words(heard), TM.E, k, { next: TM.En });
      score = 'المطابقة: ' + r.j + '/' + TM.E.length + '  نهاية=' + (r.end || 0).toFixed(2) + '  ' + (r.done ? 'تُكشف' : 'لا') + '  used=' + r.used;
    }
    box.textContent = 'lang=' + (TM.lang || 'ar-SA') + '  standalone=' + (STANDALONE ? '1' : '0') + '  iOS=' + (IOS ? '1' : '0') + '  src=' + (SRC ? '1' : '0') + '\nالمتوقع (' + k + '): ' + (TM.E || []).join(' ') + '\nالمسموع: ' + TMM.norm(heard) + '\n' + score + '\n----\n' + (TM.dbgLines || []).join('\n');
    box.scrollTop = box.scrollHeight;
  }
  function tmPaint() {
    const el = leaves.get(TM.p);
    book.querySelectorAll('.hot path.rv,.hot path.rvt,.hot path.nx,.hot path.fl').forEach(s => s.classList.remove('rv', 'rvt', 'nx', 'fl'));
    if (TM.on && el) el.querySelectorAll('.hot path').forEach(s => { const v = TM.rv.get(s.dataset.k); if (v) s.classList.add(v === 'speech' ? 'rv' : 'rvt'); else if (s.dataset.k === TM.keys[TM.i]) s.classList.add('nx'); });
    const done = TM.i >= TM.keys.length || (TM.mode === 'page' && TM.flush);
    const nv = [...TM.rv.values()], bySpeech = nv.filter(v => v === 'speech').length, bySkip = nv.filter(v => v === 'skip' || v === 'miss').length, byTap = nv.filter(v => v === 'tap').length;
    const shown = TM.keys.filter(k => tmVisible(k)).length;
    $("#tmPg").textContent = `صفحة ${ar(TM.p)} — كُشفت ${ar(shown)} من ${ar(TM.keys.length)}`;
    let st;
    if (done && (TM.mode === 'ayah' || TM.flush)) st = `أتممت الصفحة: ${ar(bySpeech)} بالتلاوة، ${ar(byTap)} باللمس` + (bySkip ? `، ${ar(bySkip)} لم تُتبيَّن` : '') + '.';
    else if (TM.why) st = TM.why;
    else if (TM.mode === 'page' && !TM.flush && TM.listening) st = 'أسمعك… تلاوة الوجه كاملًا، والنتيجة بعد الختام' + (TM.prog && TM.keys[TM.i] ? ` · الآية ${ar(TM.keys[TM.i].split(':')[1])}` : '');
    else if (TM.listening) st = `أسمعك… الآية ${ar(TM.keys[TM.i].split(':')[1])}` + (TM.prog ? ` · طابقت ${ar(TM.prog)} من ${cnt(TM.E.length, 'word', true)}` : '');
    else if (!SRC) st = IOS && STANDALONE ? 'التعرف على الصوت غير متاح في وضع التطبيق على الآيفون. افتح الرابط في Safari، أو المس الآية بعد تلاوتها لتنكشف.' : 'المس الآية بعد تلاوتها لتنكشف. التعرف على الصوت غير متاح في هذا المتصفح.';
    else if (TM.mode === 'page') st = 'اضغط «سمّع» واتْلُ الوجه كاملًا، ثم «أظهر النتيجة».';
    else st = IOS && STANDALONE ? 'اضغط «سمّع» وابدأ التلاوة. إن لم يعمل الصوت في وضع التطبيق فافتح الرابط في Safari، أو المس الآية لكشفها.' : 'اضغط «سمّع» وابدأ التلاوة، أو المس الآية لكشفها.';
    $('#tmSt').textContent = st;
    const hd = $('#tmHeard'); hd.hidden = !SRC || done || !(TM.listening || TM.heardTxt); hd.textContent = TM.heardTxt ? 'سُمع: ' + TM.heardTxt : 'سُمع: …';
    $('#tmMic').hidden = !SRC || done; $('#tmMic').classList.toggle('on', TM.listening);
    $('#tmMic span').textContent = TM.listening ? 'إيقاف' : 'سمّع';
    const pageHold = TM.mode === 'page' && !TM.flush;
    $('#tmRev').hidden = done || pageHold;
    const flushBtn = $('#tmFlush'); if (flushBtn) flushBtn.hidden = !pageHold;
    $('#tmHint').hidden = done || pageHold || !!(IOS && STANDALONE) || !!TM.needSafari;
    $('#tmNext').hidden = !done || TM.p >= N; $('#tmAgain').hidden = !done;
    const mA = $('#tmModeAyah'), mP = $('#tmModePage');
    if (mA && mP) { mA.setAttribute('aria-checked', String(TM.mode === 'ayah')); mP.setAttribute('aria-checked', String(TM.mode === 'page')); }
    tmPaintOverlay();
    const sf = $('#tmSafari');
    if (sf) {
      const show = !done && !!(IOS && STANDALONE || TM.needSafari);
      sf.hidden = !show;
      if (show) sf.href = tmSafariUrl();
    }
    const dbg = $('#tmDbg');
    if (dbg) { dbg.hidden = !TM.on || !TM.debug; if (TM.on && TM.debug) tmDbgPaint(); }
  }
  async function tmLoad(p) {
    const pd = await QD.page(p);
    TM.p = p; TM.keys = pd.ayat.map(a => a.k); TM.i = 0; TM.rv = new Map(); TM.prog = 0; TM.why = ''; TM.flush = false; tmAnim.clear(); tmDiscard();
    await tmExpect(); tmPaint();
  }
  async function tmStart() {
    if (TM.on) return;
    closeSheets(); noteClose(); if (sel) clearSel(); AU.stop && AU.stop();
    TM.on = true; TM.heardTxt = ''; document.body.classList.add('tm'); navOn('tasmee'); $('#tm').hidden = false; layout(); refit();
    notesPaintVisible(cur); await tmLoad(cur);
    loadText().catch(() => { TM.why = 'تعذّر تحميل النص للمطابقة. يمكنك الكشف باللمس.'; tmPaint(); });
  }
  // الإغلاق يعمل دائمًا: نوقف التعرف أولًا ونخفي الشريط حتى لو تعثّر أي جزء آخر
  function tmEnd() {
    try { tmListen(false, true); if (TM.drain) { tmDrop(TM.drain); try { TM.drain.abort(); } catch (e) {} TM.drain = null; } } catch (e) {}
    TM.on = false; TM.flush = false; document.body.classList.remove('tm'); $('#tm').hidden = true;
    try { tmClearOverlays(); tmPaint(); layout(); refit(); notesPaintVisible(cur); navOn('mushaf'); } catch (e) {}
  }
  async function tmReveal(k, how) {
    if (!TM.on || TM.rv.has(k)) return;
    if (TM.mode === 'page' && !TM.flush && how === 'tap') return;
    TM.rv.set(k, how);
    if (how === 'tap') tmDiscard();   // ما سُمع قبل الكشف باللمس لا يُطابَق بالآيات التالية
    const adv = k === TM.keys[TM.i];
    if (adv) { while (TM.i < TM.keys.length && TM.rv.has(TM.keys[TM.i])) TM.i++; TM.prog = 0; TM.why = ''; }
    tmPaint();   // الكشف يظهر فورًا، قبل تحميل كلمات الآية التالية
    if (tmVisible(k)) tmStartAnim(k);
    if (adv) { await tmExpect(); tmPaint(); }
    if (TM.i >= TM.keys.length) {
      tmListen(false);
      if (TM.mode === 'page' && !TM.flush) await tmFlush();
    }
  }
  function tmHint() {
    const k = TM.keys[TM.i]; if (!k) return;
    const s = leaves.get(TM.p) && leaves.get(TM.p).querySelector(`.hot path[data-k="${k}"]`); if (!s) return;
    s.classList.add('fl'); tmPaintOverlay();
    setTimeout(() => { s.classList.remove('fl'); tmPaintOverlay(); }, 1200);
  }
  // يطابق نصًّا مسموعًا بالآية التالية فما بعدها، ويعيد عدد الكلمات المستهلكة في كشف آيات
  async function tmFeed(text, final) {
    if (!TM.on || TM.i >= TM.keys.length) return 0;
    if (!TM.E.length) await tmExpect();
    const W = TMM.words(text); if (!W.length || !TM.E.length) return 0;
    const r = TMM.judge(W, TM.E, TM.keys[TM.i], { next: TM.En });
    TM.prog = Math.min(r.j, TM.E.length);
    if (r.done) {
      tmLog('reveal', TM.keys[TM.i] + ' ' + r.j + '/' + TM.E.length + ' «' + W.slice(0, r.used).join(' ') + '»');
      await tmReveal(TM.keys[TM.i], 'speech');
      const rest = W.slice(r.used).join(' ');
      return r.used + (rest ? await tmFeed(rest, final) : 0);
    }
    // تجاوز: المسموع يطابق الآية التالية كاملة بعد كلام للحالية لم يُتبيَّن (تعرّف ضعيف أو تخطٍّ)؛ تُكشف الحالية بلون «للمراجعة» ولا تُحسب تلاوة، كي لا تتوقف بقية الصفحة
    const k2 = TM.keys[TM.i + 1];
    if (k2 && TM.En && TM.En.length && W.length >= TMM.need(TM.En.length) + Math.max(2, Math.ceil(TM.E.length * 0.4)) && TMM.judge(W, TM.En, k2).done) {
      const k = TM.keys[TM.i], n = k.split(':')[1];
      tmLog('skip', k); await tmReveal(k, 'skip');
      const used = await tmFeed(text, final);
      if (!TM.why && TM.i < TM.keys.length) { TM.why = `لم أتبيّن الآية ${ar(n)} فكشفتها للمراجعة. أكمل التلاوة.`; tmPaint(); }
      return used;
    }
    TM.why = (final && W.length >= TM.E.length + 4 && r.j < TM.E.length / 2) ? 'لم تطابق الآية التالية. أعد تلاوتها، أو المسها لكشفها.' : '';
    tmPaint();
    return 0;
  }
  /* المسموع: acc كلمات جلسات سابقة لم تُستهلك، sess نص الجلسة الحالية (يُستبدل مع كل نتيجة)، skip عدد ما استُهلك من (acc+sess).
     - كروم الأندرويد وسفاري الآيفون قد يعيدان النتائج تراكميًا («بسم»، «بسم الله»...) مع resultIndex = 0: نزيل التكرار.
     - سفاري قد يرسل نتائج مؤقتة فقط (بلا isFinal)، أو يصفّر القائمة داخل الجلسة، أو يرسل نتيجة نهائية واحدة عند الإيقاف.
     - الجلسة تنتهي كل بضع ثوانٍ على الجوال: نحفظ ما سُمع ونكمل في جلسة جديدة دون عدّ مكرر. */
  function tmResultsText(results) {
    const parts = [];
    for (let x = 0; x < results.length; x++) {
      const a = results[x]; if (!a || !a[0]) continue;
      const t = String(a[0].transcript || '').trim(); if (!t) continue;
      const nt = TMM.norm(t), L = parts.length ? TMM.norm(parts[parts.length - 1]) : null;
      if (L !== null && (nt === L || nt.startsWith(L + ' '))) parts[parts.length - 1] = t;  // نتيجة تراكمية تحتوي السابقة
      else if (L !== null && nt === L) continue;                            // تكرار مطابق
      else parts.push(t);
    }
    return parts.join(' ');
  }
  function tmComb() { return TM.acc.concat(TM.sess); }
  function tmCommit() { const c = tmComb(); TM.acc = c.slice(Math.min(TM.skip, c.length)).slice(-150); TM.sess = []; TM.skip = 0; }
  function tmDiscard() { TM.acc = []; TM.sess = []; TM.skip = 0; TM.sessGone = true; TM.sessBase = (TM.raw || []).length; }
  let tmQ = Promise.resolve();
  function tmHeardUpdate(raw, fin) {
    const W = TMM.words(raw), P = TM.raw || [];
    // صفّرت سفاري القائمة داخل الجلسة (النص الجديد أقصر كثيرًا ولا يبدأ بالقديم): نحفظ القديم ثم نبدأ من جديد
    // أو لم تطل ولم تعد بداية للنص السابق (يُسمح بتصحيح آخر كلمة فقط). قد تبدأ بنفس الكلمات، مثل «ومن شر» في آيات متتالية
    const pre = () => { const k = W.length; for (let x = 0; x < k - 1; x++) if (W[x] !== P[x]) return false; return k === 0 || TMM.sim(W[k - 1], P[k - 1]) >= .5; };
    if (P.length >= 2 && ((W.length < P.length * 0.6 && W.slice(0, 2).join(' ') !== P.slice(0, 2).join(' ')) || (W.length <= P.length && !pre()))) { tmCommit(); TM.sessBase = 0; }
    TM.raw = W;
    TM.sess = TM.sessBase ? W.slice(Math.min(TM.sessBase, W.length)) : W;   // بعد كشف باللمس أو تقليب الصفحة: نتجاهل ما سُمع قبله في الجلسة نفسها
    TM.heardTxt = String(raw).replace(/\s+/g, ' ').trim().split(' ').slice(-8).join(' ');
    tmQ = tmQ.then(async () => {
      const c = tmComb(), from = Math.min(TM.skip, c.length);
      const used = await tmFeed(c.slice(from).join(' '), fin);
      if (used) { TM.skip = from + used; tmPaint(); return; }
      // إذا بقيت كلمات قديمة لم تُتبيَّن، جرّب نص الجلسة الجديدة وحده (محاولة جديدة أو الآية التالية) حتى لا يفسد البقايا الصفحة
      if (!TM.listening && TM.acc.length && TM.sess.length && TM.on && TM.i < TM.keys.length) {
        const used2 = await tmFeed(TM.sess.join(' '), fin);
        if (used2) { TM.acc = []; TM.skip = used2; tmPaint(); return; }
        const k2 = TM.keys[TM.i + 1];
        if (fin && k2 && TM.En && TM.En.length && TMM.judge(TM.sess, TM.En, k2).done) {
          const k = TM.keys[TM.i], n = k.split(':')[1];
          tmLog('skip', k + ' new'); await tmReveal(k, 'skip');
          const used3 = await tmFeed(TM.sess.join(' '), fin);
          if (used3) { TM.acc = []; TM.skip = used3; }
          if (!TM.why && TM.i < TM.keys.length) { TM.why = `لم أتبيّن الآية ${ar(n)} فكشفتها للمراجعة. أكمل التلاوة.`; }
        }
      }
      tmPaint();
    }).catch(() => {});
    tmPaint();
  }
  // سجل تشخيص محلي (آخر 120 حدثًا)؛ لمس سطر «سُمع» ينسخه لإرساله عند الحاجة. لا يُرسل لأي خادم.
  function tmLog(ev, txt) { TM.log.push([Date.now() % 1e8, ev, String(txt || '').slice(0, 300)]); if (TM.log.length > 120) TM.log.shift(); if (TM.debug) tmDbgPaint(ev, txt); }
  $('#tmHeard').addEventListener('click', () => {
    const t = JSON.stringify({ ua: navigator.userAgent, standalone: STANDALONE, sr: !!SRC, page: TM.p, i: TM.i, keys: TM.keys, log: TM.log });
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('نُسِخ سجل التسميع.')).catch(() => toast('تعذّر النسخ.'));
  });
  function tmDrop(r) { r.onresult = r.onerror = r.onend = r.onstart = r.onaudiostart = null; }
  function tmListen(on, hard) {
    if (!SRC) {
      if (on) {
        TM.why = IOS && STANDALONE
          ? 'التعرف على الصوت غير متاح في وضع التطبيق على الآيفون. افتح الصفحة في Safari ثم اضغط «سمّع»، أو المس الآية لكشفها.'
          : 'التعرف على الصوت غير متاح في هذا المتصفح. اكشف الآيات باللمس.';
        if (IOS && STANDALONE) TM.needSafari = true;
        tmLog('fail', 'no-SRC'); tmPaint();
      }
      return;
    }
    clearTimeout(TM.wd);
    if (!on) {
      TM.listening = false; const r = TM.rec; TM.rec = null; TM.stopAt = Date.now();
      if (r && hard) { tmDrop(r); try { r.abort(); } catch (e) {} }
      else if (r) {
        // نطلب النتيجة الأخيرة بـ stop (سفاري قد يرسل النص كله عند الإيقاف)، ثم نغلق نهائيًا بعد لحظة
        tmLog('stop');
        TM.drain = r; try { r.stop(); } catch (e) {}
        setTimeout(() => { if (TM.drain === r) TM.drain = null; tmDrop(r); try { r.abort(); } catch (e) {} }, 1500);
      }
      if (TM.on) tmPaint(); return;
    }
    if (TM.rec) tmListen(false);
    if (TM.drain) { tmDrop(TM.drain); try { TM.drain.abort(); } catch (e) {} TM.drain = null; }
    // ما سُمع ولم يُستهلك في المرة السابقة (مثل نتيجة سفاري النهائية عند «إيقاف») يبقى إن عاد خلال دقيقة، ليُكمَل أو يُتجاوز به
    if (TM.stopAt && Date.now() - TM.stopAt < 60000 && !TM.sessGone) { tmCommit(); TM.acc = TM.acc.slice(-40); } else { TM.acc = []; TM.sess = []; TM.skip = 0; }
    TM.why = ''; TM.sessGone = false; TM.sessBase = 0; TM.heardTxt = ''; TM.empty = 0;
    TM.listening = true; tmSession();
  }
  function tmSession() {
    clearTimeout(TM.wd);
    const r = new SRC();
    r.lang = TM.lang || 'ar-SA';
    r.continuous = !IOS;          // آيفون: continuous=true غالباً لا يعمل
    r.interimResults = true;
    r.maxAlternatives = 3;
    TM.rec = r; const t0 = Date.now(); let started = false, got = false, noSpeech = false;
    TM.sess = []; TM.raw = []; TM.sessBase = 0; TM.sessGone = false;
    const live = () => TM.rec === r || TM.drain === r;
    const safariMsg = 'التعرف على الصوت لا يعمل من أيقونة الشاشة الرئيسية على الآيفون. افتح الصفحة في Safari ثم اضغط «سمّع»، أو المس الآية لكشفها.';
    const fail = m => {
      if (TM.rec !== r && TM.rec) return;
      TM.why = m; tmLog('fail', m);
      if (IOS && STANDALONE) TM.needSafari = true;
      tmListen(false);
    };
    r.onstart = () => { started = true; if (TM.why && /لم يُلتقط|لم يبدأ/.test(TM.why)) TM.why = ''; tmLog('start-ok', r.lang); tmPaint(); };
    r.onaudiostart = () => { started = true; tmLog('audiostart'); };
    r.onsoundstart = r.onspeechstart = () => { started = true; TM.empty = 0; tmLog('speechstart'); };
    r.onresult = ev => {
      if (!live()) return;
      got = true; let fin = true;
      for (let x = 0; x < ev.results.length; x++) if (ev.results[x] && !ev.results[x].isFinal) fin = false;
      const txt = tmResultsText(ev.results);
      let bits = ev.resultIndex + '/' + ev.results.length;
      if (TM.debug) {
        const parts = [];
        for (let i = 0; i < ev.results.length; i++) {
          const a = ev.results[i]; if (!a || !a[0]) continue;
          parts.push('#' + i + (a.isFinal ? ' F' : ' ~') + ' «' + a[0].transcript + '» c=' + (a[0].confidence != null ? Number(a[0].confidence).toFixed(2) : '—'));
        }
        bits += ' ' + parts.join(' | ');
      } else bits += ' ' + txt;
      tmLog(fin ? 'final' : 'interim', bits);
      tmHeardUpdate(txt, fin);
    };
    r.onerror = ev => {
      if (TM.rec !== r) return;
      const e = ev && ev.error; tmLog('error', e);
      if (e === 'aborted') return;
      if (e === 'no-speech') {
        noSpeech = true;
        TM.why = 'لم يُلتقط كلام في هذه الوقفة. أكمل التلاوة.';
        tmPaint();
        return;
      }
      if (e === 'language-not-supported' && (TM.lang || 'ar-SA') !== 'ar') {
        TM.lang = 'ar';
        TM.why = 'سأستخدم العربية العامة.';
        tmLog('lang', 'ar');
        tmPaint();
        return;
      }
      const m = {
        'not-allowed': 'لم يُسمح باستخدام الميكروفون أو التعرف على الكلام. اسمح بهما من الإعدادات، أو اكشف الآيات باللمس.',
        'service-not-allowed': IOS && STANDALONE ? safariMsg : (IOS ? 'التعرف على الكلام غير مفعّل. فعّل «سيري» و«الإملاء» من إعدادات الآيفون، أو اكشف الآيات باللمس.' : 'التعرف على الصوت غير متاح هنا. اكشف الآيات باللمس.'),
        'network': 'التعرف على الصوت يحتاج إنترنت. اكشف الآيات باللمس.',
        'audio-capture': 'لم يُعثر على ميكروفون. اكشف الآيات باللمس.',
        'language-not-supported': 'التعرف على العربية غير متاح في هذا الجهاز. اكشف الآيات باللمس.'
      }[e];
      fail(m || ('تعذّر التعرف على الصوت (' + (e || 'خطأ') + '). اكشف الآيات باللمس.'));
    };
    // الجوال ينهي الجلسة عند كل وقفة: نعيد التشغيل ما دامت الجلسات تُرجع كلامًا.
    // في وضع الشاشة الرئيسية على الآيفون: إن لم يصل صوت من أول جلسة نتوقف فورًا ونوجّه إلى Safari.
    r.onend = () => {
      if (TM.rec !== r || !TM.listening || !TM.on) return;
      tmLog('end', (Date.now() - t0) + 'ms ' + (got ? 'words' : 'empty') + (noSpeech ? ' no-speech' : ''));
      TM.empty = got ? 0 : TM.empty + 1;
      if (IOS && STANDALONE && !got && TM.empty >= 1 && !TM.everGot) return fail(safariMsg);
      const limit = TM.everGot ? 8 : 3;
      if (TM.empty >= limit) return fail('توقف الاستماع. اضغط «سمّع» للمتابعة.');
      if (got) TM.everGot = true;
      tmDrop(r); tmCommit();
      if (TM.rec === r) TM.rec = null;
      const delay = IOS ? 0 : (got ? 150 : 400);
      setTimeout(() => {
        if (!TM.listening || !TM.on || TM.rec) return;
        try { tmSession(); } catch (e) { fail('توقف الاستماع. اضغط «سمّع» للمتابعة.'); }
      }, delay);
    };
    TM.wd = setTimeout(() => {
      if (TM.rec !== r || started || got) return;
      fail(IOS && STANDALONE ? safariMsg : 'لم يبدأ الميكروفون. اسمح بالميكروفون والتعرف على الكلام، أو اكشف الآيات باللمس.');
    }, IOS && STANDALONE ? 1500 : 6000);
    // start() هنا تزامنيًا داخل لمسة المستخدم (لا await ولا setTimeout قبله) حتى يظهر إذن الميكروفون
    tmLog('start', r.lang + (r.continuous ? ' cont' : ' oneshot') + (STANDALONE ? ' standalone' : ''));
    try { r.start(); }
    catch (e) {
      tmLog('start-throw', (e && (e.name || e.message)) || 'error');
      fail(IOS && STANDALONE ? safariMsg : 'تعذّر تشغيل الميكروفون. اكشف الآيات باللمس.');
      return;
    }
    tmPaint();
  }

  // أزرار شريط التسميع ما عدا «سمّع»: تستجيب للمس مباشرة (touchend) وللنقر، مرة واحدة لكل لمسة
  function tmBtn(id, fn) {
    const el = $(id); let tt = 0;
    el.addEventListener('touchend', e => { if (el.hidden) return; e.preventDefault(); e.stopPropagation(); tt = Date.now(); fn(); }, { passive: false });
    el.addEventListener('click', e => { e.stopPropagation(); if (Date.now() - tt < 700) return; fn(); });
  }
  // «سمّع»: start() يجب أن يُستدعى داخل click (آيفون لا يعتبر touchend+preventDefault إيماءة كافية لإذن الميكروفون، وpreventDefault يلغي click)
  $('#tmMic').addEventListener('click', e => {
    e.stopPropagation();
    if ($('#tmMic').hidden) return;
    tmListen(!TM.listening);
  });
  tmBtn('#tmRev', () => { const k = TM.keys[TM.i]; if (k) tmReveal(k, 'tap'); });
  tmBtn('#tmFlush', () => { tmFlush(); });
  tmBtn('#tmHint', tmHint);
  tmBtn('#tmEnd', tmEnd);
  tmBtn('#tmAgain', () => tmLoad(TM.p));
  tmBtn('#tmNext', () => { if (TM.p < N) goPage(TM.p + 1, true, true); });
  tmBtn('#tmModeAyah', () => tmSetMode('ayah'));
  tmBtn('#tmModePage', () => tmSetMode('page'));
  // ضغط مطوّل على عنوان «التسميع» يفتح سجل التشخيص (أو ?tmdebug=1)
  (function () {
    const el = $('#tm .tmh b'); if (!el) return;
    let id = 0;
    const down = () => { clearTimeout(id); id = setTimeout(() => { TM.debug = !TM.debug; if (TM.debug) TM.dbgLines = TM.dbgLines || []; tmPaint(); toast(TM.debug ? 'وضع تشخيص التسميع.' : 'أُغلِق التشخيص.'); }, 650); };
    const up = () => clearTimeout(id);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  })();
  document.addEventListener('visibilitychange', () => { if (document.hidden && TM.listening) { tmListen(false, true); TM.why = 'توقف الاستماع. اضغط «سمّع» للمتابعة.'; tmPaint(); } });
  /* ---------- التفسير: المختصر والسعدي، كما وردا في المصدر بلا أي تعديل ---------- */
  // الملفات لكل سورة في tafsir/{mukhtasar|saadi}/NNN.json، تُحمَّل عند الحاجة وتُخزَّن بعد أول فتح (sw.js)
  const TF = {
    mukhtasar: { name: 'المختصر', title: 'المختصر في تفسير القرآن الكريم', pub: 'مركز تفسير للدراسات القرآنية', key: 'arabic_mokhtasar' },
    saadi: { name: 'السعدي', title: 'تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)', pub: 'الشيخ عبد الرحمن بن ناصر السعدي', key: 'arabic_saadi' }
  };
  const tfCache = new Map();
  function tfLoad(t, s) {
    const id = t + s;
    if (!tfCache.has(id)) tfCache.set(id, fetch(`../tafsir/${t}/${String(s).padStart(3, '0')}.json`).then(r => { if (!r.ok) throw new Error('tafsir'); return r.json(); }).catch(e => { tfCache.delete(id); throw e; }));
    return tfCache.get(id);
  }
  let tfKeys = [], tfScope = '';
  const tfWhich = () => (ST.get().tafsir === 'saadi' ? 'saadi' : 'mukhtasar');
  const segHTML = x => x.map(([c, t]) => c ? `<span class="tq-${c}">${esc(t)}</span>` : esc(t)).join('');
  function tfDate(iso) { try { return new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso.slice(0, 10); } }
  function tfSource(t, d, s) {
    const m = TF[t];
    // v26z12: نسبة قصيرة تشمل QuranEnc (شرطها الثاني)؛ السعدي لا يُنسب إلى مركز تفسير. الإصدار وتاريخه في نافذة التفاصيل
    const line = t === 'mukhtasar' ? `المختصر في تفسير القرآن الكريم، مركز تفسير للدراسات القرآنية، عبر موسوعة القرآن الكريم ${L('QuranEnc.com')}` : `تفسير السعدي، عبر ${L('QuranEnc.com')}`;
    return `<p class="tfsrc">${line}<br>${L(`<a href="${esc(d.src)}" target="_blank" rel="noopener">${esc(d.src.replace('https://', ''))}</a>`)} · <button class="lnk" type="button" data-srcd>التفاصيل</button></p>`;
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
          // آية بلا فقرة مرقّمة وحدها: هي داخل كتلة مجموعة (k=g)؛ نعرض المجموعة والفقرتين المجاورتين داخلها
          const force = new Set(), grp = new Map();
          for (const a of ayat) {
            if (B.some(b => b.k === 'a' && a >= b.a && a <= b.b)) continue;
            const gi = B.findIndex(b => b.k === 'g' && a >= b.a && a <= b.b); if (gi < 0) continue;
            const g = B[gi]; grp.set(a, g.l);
            let pv = -1, nx = -1;
            for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.k !== 'a' || b.b < g.a || b.a > g.b) continue; if (b.b < a) pv = i; else if (b.a > a && nx < 0) nx = i; }
            if (pv >= 0) force.add(pv); if (nx >= 0) force.add(nx); if (pv < 0 && nx < 0) force.add(gi);
          }
          const hit = i => force.has(i) || (B[i].k === 'a' && ayat.some(a => a >= B[i].a && a <= B[i].b));
          const shown = new Set();
          for (const [a, l] of grp) html += `<p class="muted sm tfgrp" data-k="${s}:${a}">${esc(sName(s))} · الآية ${ar(a)}: ليس لها في المصدر فقرة مستقلة، ويشرحها السعدي ضمن المجموعة (${esc(l)})؛ وهذا تفسير ما يجاورها منها.</p>`;
          for (let i = 0; i < B.length; i++) {
            if (!hit(i)) continue;
            let j = i; while (j > 0 && B[j - 1].k !== 'a') j--;   // ما قبل الفقرة من تمهيد أو نص الآيات يُعرض معها كما في المصدر
            for (let q = j; q <= i; q++) if (!used.has(q)) { used.add(q); const b = B[q];
              if (b.k === 'a') for (let a = b.a; a <= b.b; a++) shown.add(a);
              html += `<article class="tfa tfs-${b.k}" data-k="${s}:${b.k === 'i' ? '' : b.a}">${b.l ? `<h5>${esc(sName(s))} · ${esc(b.l)}</h5>` : ''}<div class="tftx">${segHTML(b.x)}</div></article>`; }
          }
          for (const a of ayat) if (!shown.has(a) && !grp.has(a)) html += `<article class="tfa tfgap" data-k="${s}:${a}"><h5>${esc(sName(s))} · الآية ${ar(a)}</h5><p class="muted">لا توجد في المصدر فقرة مستقلة لهذه الآية.</p></article>`;
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
  window.__BUILD='26z16';
  window.__app = { ask, closeSheets, openSheet, esc, hzLabel, snk: SNK, imm: () => ({ on: IMM.on, show: document.body.classList.contains('imm-show') }), immShow, snkKnots, snkPath, hlPieces, wl: () => WL, leaves, listenMode, playSurah, surahKeys, isWide, wantSpread, spreadPair, nextPage, creditHTML, tmFlush, tmSetMode, tmPaintOverlay, openTafsir, tfState: () => ({ keys: tfKeys.slice(), which: tfWhich(), scope: tfScope }), reloadData: () => { applyTheme(); refreshToday(); notesPaintVisible(cur); updateTitle(); }, toast, tmStart, tmEnd, tmFeed, tmReveal, TM: () => ({ on: TM.on, p: TM.p, keys: TM.keys.slice(), i: TM.i, rv: [...TM.rv], E: TM.E.slice(), prog: TM.prog, why: TM.why, listening: TM.listening, sr: !!SRC, acc: TM.acc.slice(), sess: TM.sess.slice(), skip: TM.skip, heardTxt: TM.heardTxt, log: TM.log.slice(), debug: TM.debug, lang: TM.lang || 'ar-SA', needSafari: !!TM.needSafari, mode: TM.mode, flush: !!TM.flush }), openSettings, openTilawa, navOn, notesAll, notesPaint, noteNew, noteOpen, noteClose, openNotes, openHub, openRem, openWird, rem, refit, LS: () => LS, goPage, flip, wantFlip, setAngle, prepFlip, showOnly, select, clearSel, chrome, state: () => ({ cur, sel, playingKey, busy, play: AU.state() && AU.state().kind }), keyPage, pageData, cnt, after };
  boot();
})();
