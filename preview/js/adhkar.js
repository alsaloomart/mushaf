/* أذكاري — أذكار الصباح والمساء، المسبحة، أذكار بعد الصلاة، الإحصاءات.
   النصوص من data/adhkar.json فقط: القائمة المعتمدة «أذكار معتمدة.md» (القرآن الكريم وما رواه البخاري أو مسلم)،
   بلفظ الكاتب وترقيم المدقق وتشكيله (adhkar/adhkar.json → changelog_step5).
   كل شيء محفوظ على الجهاز فقط (localStorage). */
(() => {
  'use strict';
  const A = window.__app; if (!A) return;
  const esc = A.esc, cnt = A.cnt, toast = A.toast;
  // v26z10: زر «المصدر» — رابط عميق متحقَّق منه لصفحة الحديث أو الآية (data/adhkar.json → url)؛ بلا رابط مؤكد لا زر
  const LNK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>';
  const $ = s => document.querySelector(s);
  const KEY = /\/preview\//.test(location.pathname) ? 'mushaf.preview.adhkar' : 'mushaf.adhkar';
  const fmt = n => n >= 1000 ? n.toLocaleString('en-US') : String(n);
  const OPEN = new Set();   // بطاقات مكتملة فتحها المستخدم لإعادة القراءة (في الذاكرة فقط)
  const CITIES = [['الرياض',24.7136,46.6753],['بريدة',26.3260,43.9750],['عنيزة',26.0840,43.9940],['جدة',21.5433,39.1728],['مكة المكرمة',21.3891,39.8579],['المدينة المنورة',24.5247,39.5692],['الدمام',26.4207,50.0888],['الخبر',26.2172,50.1971],['الأحساء',25.3830,49.5860],['تبوك',28.3838,36.5550],['أبها',18.2164,42.5053],['حائل',27.5114,41.7208],['الطائف',21.2703,40.4158],['جازان',16.8892,42.5511],['نجران',17.4924,44.1277],['الجوف',29.8117,39.8678]];
  // أذكار المسبحة — القائمة المعتمدة («أذكار معتمدة.md»، القسم 3؛ مطابقة لـ data/adhkar.json → tasbeeh)
  const PRESETS = [
    { t: "سُبْحَانَ اللَّهِ", n: 33, src: "رواه مسلم" },
    { t: "الْحَمْدُ لِلَّهِ", n: 33, src: "رواه مسلم" },
    { t: "اللَّهُ أَكْبَرُ", n: 33, src: "رواه مسلم" },
    { t: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ، وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", n: 100, src: "متفق عليه", v: "«كَانَتْ لَهُ عَدْلَ عَشْرِ رِقَابٍ، وَكُتِبَتْ لَهُ مِائَةُ حَسَنَةٍ، وَمُحِيَتْ عَنْهُ مِائَةُ سَيِّئَةٍ، وَكَانَتْ لَهُ حِرْزًا مِنَ الشَّيْطَانِ يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ»" },
    { t: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", n: 100, src: "رواه مسلم", v: "«مَنْ قَالَ حِينَ يُصْبِحُ وَحِينَ يُمْسِي: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ مِائَةَ مَرَّةٍ، لَمْ يَأْتِ أَحَدٌ يَوْمَ الْقِيَامَةِ بِأَفْضَلَ مِمَّا جَاءَ بِهِ، إِلَّا أَحَدٌ قَالَ مِثْلَ مَا قَالَ أَوْ زَادَ عَلَيْهِ»" },
    { t: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ", n: 3, src: "رواه مسلم", v: "«لَقَدْ قُلْتُ بَعْدَكِ أَرْبَعَ كَلِمَاتٍ ثَلَاثَ مَرَّاتٍ، لَوْ وُزِنَتْ بِمَا قُلْتِ مُنْذُ الْيَوْمِ لَوَزَنَتْهُنَّ»" },
    { t: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ", n: 0, src: "متفق عليه", v: "«كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ، حَبِيبَتَانِ إِلَى الرَّحْمَنِ»" },
    { t: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", n: 0, src: "متفق عليه", v: "«أَلَا أَدُلُّكَ عَلَى كَنْزٍ مِنْ كُنُوزِ الْجَنَّةِ»" },
    { t: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", n: 10, src: "رواه مسلم", v: "«كَانَ كَمَنْ أَعْتَقَ أَرْبَعَةَ أَنْفُسٍ مِنْ وَلَدِ إِسْمَاعِيلَ»" },
    { t: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ", n: 100, src: "رواه البخاري، والعدد عند مسلم" }
  ];
  const LABELS = ['سُبْحَانَ اللَّهِ', 'الْحَمْدُ لِلَّهِ', 'اللَّهُ أَكْبَرُ', 'التهليل (100)', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ (100)', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', 'التهليل (10)', 'الاستغفار (100)'];
  const short = t => { const i = PRESETS.findIndex(x => x.t === t); return i >= 0 ? LABELS[i] : /^ل(?:َا|اَ) إِلَهَ/.test(t) ? 'التهليل' : t; };   // اسم كامل بلا قطع كلمات
  const DONE_LINES = n => ['تقبّل الله منك.', n ? `أتممت ${cnt(n, 'tasbeeha', 'acc')}. بارك الله فيك.` : 'تقبّل الله منك.', 'تمّ العدد. تقبّل الله.', 'أحسنت، تقبّل الله ذكرك.'];

  /* ---------- الحالة ---------- */
  const def = () => ({ city: 0, prog: {}, tas: { p: 0, target: 33, c: 0, h: [] }, goal: 100, vib: 1, snd: 0, auto: 1, log: {}, flow: { i: 0, c: [0, 0, 0, 0], skip: 0 }, fajr: { start: null, d: {}, hist: [] } });
  let S; try { S = Object.assign(def(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = def(); }
  if (!S.fajr || typeof S.fajr !== 'object') S.fajr = { start: null, d: {}, hist: [] };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dkey(new Date());
  const day = k => S.log[k] || (S.log[k] = { t: 0, by: {}, m: 0, e: 0, p: 0 });
  const addT = (t, n = 1) => { const L = day(today()); L.t = Math.max(0, L.t + n); L.by[t] = Math.max(0, (L.by[t] || 0) + n); };

  let D = null, V = null, TIMES = null, period = 'd', MENU = false, PMENU = false;
  const body = () => $('#adhBody');

  /* ---------- أوقات الشروق والغروب (adhan-js، أم القرى) ---------- */
  function loadAdhan() {
    if (window.adhan) return Promise.resolve();
    return new Promise(r => { const s = document.createElement('script'); s.src = 'js/adhan.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
  }
  function calcTimes() {
    TIMES = null; if (!window.adhan) return;
    try {
      const c = CITIES[S.city] || CITIES[0], ad = window.adhan;
      const pt = new ad.PrayerTimes(new ad.Coordinates(c[1], c[2]), new Date(), ad.CalculationMethod.UmmAlQura());
      TIMES = pt;
    } catch (e) { TIMES = null; }
  }
  const hm = d => d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '—';
  const autoTab = () => { const n = new Date(); if (!TIMES) return n.getHours() >= 15 || n.getHours() < 4 ? 'e' : 'm'; return (n >= TIMES.asr || n < TIMES.fajr) ? 'e' : 'm'; };

  /* ---------- أدوات العرض ---------- */
  const ring = (frac, inner, cls = '') => {
    const R = 100, C = 2 * Math.PI * R, f = Math.max(0, Math.min(1, frac || 0));
    return `<svg class="adh-ring ${cls}" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="${R}" class="rt"/><circle cx="120" cy="120" r="${R}" class="rf" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - f)).toFixed(1)}" transform="rotate(-90 120 120)"/></svg>${inner || ''}`;
  };
  const bar = f => `<div class="adh-bar"><i style="width:${(Math.max(0, Math.min(1, f)) * 100).toFixed(1)}%"></i></div>`;
  /* v26z16: الاهتزاز يُعرض فقط حيث يعمل فعلًا (navigator.vibrate دالة، وشاشة لمس، وليس iOS: سفاري الآيفون بلا vibrate).
     النبضة 20ms على الأقل (بعض أجهزة أندرويد تتجاهل ما دونها)، ونمط أوضح عند تمام العدد. الاستدعاء دائمًا داخل نقرة المستخدم. */
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const VOK = typeof navigator.vibrate === 'function' && !IOS && matchMedia('(pointer: coarse)').matches;
  function buzz(strong) { if (S.vib && VOK) try { navigator.vibrate(strong ? [40, 60, 40] : 20); } catch (e) {} }
  let AC = null;
  /* v26z16: «نقرة صوتية خفيفة» بـ WebAudio: دفقة ضجيج قصيرة جدًا (نحو 6ms) عبر مرشح عالٍ، بلا ملف ولا نغمة.
     تُفتح على أول لمسة (شرط iOS)، وتُستأنف إن علّقها النظام. عند تمام العدد نقرتان. على الآيفون يكتمها مفتاح الصامت. */
  let CLK = null;
  function actx() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state !== 'running') AC.resume().catch(() => {});
      if (!CLK) { const n = Math.round(AC.sampleRate * .006); CLK = AC.createBuffer(1, n, AC.sampleRate); const d = CLK.getChannelData(0); for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3); }
      return AC;
    } catch (e) { return null; }
  }
  function unlock() {
    if (!S.snd) return;   // لا نُنشئ سياق صوت لمن لم يفعّل النقرة (حتى لا يُقاطَع صوت آخر على الجهاز)
    const a = actx(); if (!a) return;
    try { const b = a.createBufferSource(); b.buffer = a.createBuffer(1, 1, a.sampleRate); b.connect(a.destination); b.start(0); } catch (e) {}
    if (a.state === 'running') ['touchend', 'click'].forEach(t => document.removeEventListener(t, unlock, true));
  }
  ['touchend', 'click'].forEach(t => document.addEventListener(t, unlock, true));
  function click1(at, vol) { const a = AC, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = CLK; f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = vol; src.connect(f).connect(g).connect(a.destination); src.start(at); }
  function tick(strong) {
    if (!S.snd) return;
    const a = actx(); if (!a || !CLK) return;
    try { const t = a.currentTime + .005; click1(t, .22); if (strong) click1(t + .09, .18); } catch (e) {}
  }
  /* v26z16: ومضة خفيفة على العدّاد عند تمام الذكر (ذهبية خفيفة؛ وبلا حركة مع prefers-reduced-motion) */
  function flash(sel) { requestAnimationFrame(() => { const el = body() && body().querySelector(sel); if (!el) return; el.classList.remove('adh-flash'); void el.offsetWidth; el.classList.add('adh-flash'); setTimeout(() => el.classList.remove('adh-flash'), 700); }); }

  /* ---------- البطاقات ---------- */
  function quranHTML(it) {
    return it.quran.map(q => `<div class="adh-q">${q.bas ? `<p class="adh-bas">${esc(D.basmala_qpc)}</p>` : ''}<p class="adh-qt">${q.ayat.map(a => `${esc(a.t)} <span class="adh-an">﴿${a.k.split(':')[1]}﴾</span>`).join(' ')}</p></div>`).join('') +
      `<button class="adh-read" data-page="${it.quran[0].page}">اقرأ في المصحف (صفحة ${it.quran[0].page})</button>`;
  }
  const txt = (it, m) => (m === 'e' ? it.text_evening : m === 'm' ? it.text_morning : null) || it.text || it.text_morning || '';
  const total = it => it.steps ? it.steps.reduce((a, x) => a + x.count, 0) : (it.count || 0);
  function card(id, m, done) {
    const it = D.items[id]; if (!it) return '';
    const n = total(it), left = Math.max(0, n - done), fin = n ? done >= n : done > 0;
    let body;
    if (it.type === 'quran') body = (it.prefix ? `<p class="adh-x adh-pre">${esc(it.prefix)}</p>` : '') + quranHTML(it);
    else if (it.steps) { let acc = 0; body = it.steps.map(x => { const on = done >= acc && done < acc + x.count; acc += x.count; return `<p class="adh-x adh-step${on && !fin ? ' on' : ''}">${esc(x.text)} <span class="adh-sc">${cnt(x.count, 'marra')}</span></p>`; }).join(''); }
    else body = `<p class="adh-x">${esc(txt(it, m))}</p>`;
    const vir = it.virtue ? `<p class="adh-v"><b>الفضل:</b> «${esc(it.virtue)}»${it.virtue_source ? ` (${esc(it.virtue_source)})` : ''}</p>` : '';
    const cnum = n ? `<b>${fmt(fin ? n : left)}</b><span>من ${fmt(n)}</span>` : `<b>${fmt(done)}</b><span>بلا عدد</span>`;
    const shut = fin && (m === 'm' || m === 'e') && !OPEN.has(m + '|' + id);   // البطاقة المكتملة تنطوي بهدوء، وتنفتح بلمسة
    if (shut) { const tt = (it.title || '').split(' / '); body = `<p class="adh-shut-t">${esc(tt[m === 'e' && tt[1] ? 1 : 0])}</p>`; }   // لا يُقتطع نص آية أو ذكر: يظهر عنوانه فقط حتى يُفتح
    return `<article class="adh-card${fin ? ' fin' : ''}${shut ? ' shut' : ''}" data-id="${id}"${fin && (m === 'm' || m === 'e') ? ` aria-expanded="${!shut}"` : ''}>
      ${body}
      <div class="adh-meta"><p class="adh-src">المصدر: ${esc(it.source || '')}${it.url ? ` <a class="adh-slink" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" data-src aria-label="افتح المصدر في صفحة جديدة">${LNK}<span>المصدر</span></a>` : ''}</p>${vir}</div>
      <button class="adh-tap" data-tap aria-label="اضغط للعدّ">${fin ? '<svg viewBox="0 0 24 24" class="ok"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}<span class="cn">${cnum}</span><small>${fin ? 'تمّ' : 'اضغط للعدّ'}</small></button>
    </article>`;
  }

  /* ---------- الصباح والمساء ---------- */
  function progOf(m) { const k = today() + '|' + m; for (const x of Object.keys(S.prog)) if (!x.startsWith(today())) delete S.prog[x]; return S.prog[k] || (S.prog[k] = {}); }
  function renderME(m) {
    const ids = D.sections[m === 'm' ? 'morning' : 'evening'], P = progOf(m);
    const doneN = ids.filter(id => { const n = total(D.items[id]); return n ? (P[id] || 0) >= n : (P[id] || 0) > 0; }).length;
    const c = CITIES[S.city] || CITIES[0];
    return `<div class="adh-city"><span><b>${esc(c[0])}</b> · الشروق ${hm(TIMES && TIMES.sunrise)} · الغروب ${hm(TIMES && TIMES.maghrib)}</span><button class="lnk" data-v="city">تغيير المدينة</button></div>
      <div class="adh-prog"><div class="row"><b>اكتمل ${doneN} من ${ids.length}</b>${doneN === ids.length ? '<span class="ok">تقبّل الله منك.</span>' : ''}</div>${bar(doneN / ids.length)}</div>
      <div class="adh-list">${ids.map(id => card(id, m, P[id] || 0)).join('')}</div>
      <p class="adh-note">التذكير: على الآيفون لا تصل إشعارات المصحف إلا إذا فُتح من الشاشة الرئيسية (iOS 16.4 فأحدث). ولم يُفعَّل بعدُ ضبط التذكير على الشروق والغروب تلقائيًا؛ والتذكير المجدول من الخادم غير مفعّل حاليًا.</p>`;
  }
  function tapCard(el, m) {
    const id = el.dataset.id, it = D.items[id];
    if (m === 'p') { const P = progOf('p'); const n = total(it) || 1; if ((P[id] || 0) >= n) return; P[id] = (P[id] || 0) + 1; const dn = P[id] >= n; buzz(dn); tick(dn); save(); el.outerHTML = card(id, 'p', P[id]); if (dn) flash('.adh-card[data-id="' + id + '"]'); return; }
    const P = progOf(m), n = total(it), key = m + '|' + id;
    if (n && (P[id] || 0) >= n) { OPEN.has(key) ? OPEN.delete(key) : OPEN.add(key); return render(); }
    P[id] = (P[id] || 0) + 1; const justDone = n ? P[id] >= n : P[id] === 1; buzz(n && P[id] >= n); tick(n && P[id] >= n);
    const ids = D.sections[m === 'm' ? 'morning' : 'evening'];
    const isDone = x => { const k = total(D.items[x]); return k ? (P[x] || 0) >= k : (P[x] || 0) > 0; };
    const all = ids.every(isDone);
    if (all) { day(today())[m] = 1; toast('تقبّل الله منك.'); }
    save(); render(); if (n && P[id] >= n) flash('.adh-card[data-id="' + id + '"]');
    if (justDone && !all) {   // تمرير هادئ إلى أول ذكر لم يكتمل بعد هذا الذكر (أو قبله إن لم يبق بعده شيء)
      const i = ids.indexOf(id), next = ids.slice(i + 1).find(x => !isDone(x)) || ids.find(x => !isDone(x));
      if (next) setTimeout(() => scrollToCard(next), 380);
    }
  }
  function scrollToCard(id) {
    const b = body(), el = b && b.querySelector('.adh-card[data-id="' + id + '"]'); if (!el) return;
    const tabs = b.querySelector('.adh-tabs'), pr = b.querySelector('.adh-prog');
    const head = (tabs ? tabs.offsetHeight + 12 : 0) + (pr ? pr.offsetHeight + 10 : 0);
    const top = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - head;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    b.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' });
  }

  /* ---------- المسبحة ---------- */
  function renderT() {
    if (!(S.tas.p < PRESETS.length)) { S.tas.p = 0; S.tas.target = PRESETS[0].n; }
    const T = S.tas, p = PRESETS[T.p] || PRESETS[0], tg = T.target, L = day(today());
    const fin = tg && T.c >= tg;
    return `<div class="adh-psel"><button class="chip" data-pmenu aria-haspopup="true" aria-expanded="${PMENU}" aria-label="اختر الذكر"><span>${esc(LABELS[T.p] || '')}</span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
        ${PMENU ? `<div class="adh-menu wide" role="menu">${PRESETS.map((x, i) => `<button role="menuitemradio" aria-checked="${i === T.p}" data-preset="${i}">${esc(LABELS[i])}</button>`).join('')}</div>` : ''}</div>
      <div class="adh-tas">
        <p class="adh-dh">${esc(p.t)}</p>
        <button class="adh-big${fin ? ' fin' : ''}" data-tas aria-label="سبّح">${ring(tg ? T.c / tg : (T.c ? 1 : 0), `<span class="in"><b>${fmt(T.c)}</b><span>${tg ? 'من ' + fmt(tg) : 'بلا عدد'}</span><small>${fin ? esc(T.msg || 'تمّ العدد. تقبّل الله.') : 'اضغط للعدّ'}</small></span>`)}</button>
        <div class="adh-ctl">
          <button class="ib" data-undo aria-label="تراجع" title="تراجع" ${T.h.length ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg></button>
          <div class="adh-tsel"><button class="chip" data-tmenu aria-haspopup="true" aria-expanded="${MENU ? 'true' : 'false'}" aria-label="الهدف">${tg ? 'الهدف ' + fmt(tg) : 'بلا عدد'}<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
            ${MENU ? `<div class="adh-menu" role="menu">${[33, 100].map(n => `<button role="menuitemradio" aria-checked="${tg === n}" data-target="${n}">${n}</button>`).join('')}<button role="menuitemradio" aria-checked="${!!(tg && tg !== 33 && tg !== 100)}" data-target="c">مخصص${tg && tg !== 33 && tg !== 100 ? ' (' + fmt(tg) + ')' : ''}</button><button role="menuitemradio" aria-checked="${!tg}" data-target="0">بلا عدد</button></div>` : ''}</div>
          <button class="ib" data-reset aria-label="تصفير" title="تصفير"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/></svg></button>
        </div>
        <p class="adh-today">${L.t ? `مجموع تسبيحك اليوم: <b class="n">${fmt(L.t)}</b>` : 'لم تبدأ تسبيح اليوم بعد.'}</p>
        <p class="adh-src c">المصدر: ${esc(p.src)}</p>${p.v ? `<p class="adh-v c"><b>الفضل:</b> ${esc(p.v)}</p>` : ''}
      </div>
      <div class="adh-entry">
        <button data-v="flow"><b>أذكار بعد الصلاة</b><span>${cnt(4, 'step')} · نحو ${cnt(2, 'minute', true)}</span></button>
        <button data-v="stats"><b>الإحصاءات</b><span class="lnk2">عرض اليوم والأسبوع</span></button>
      </div>`;
  }
  function tapTas() {
    const T = S.tas, p = PRESETS[T.p] || PRESETS[0];
    T.c++; T.h.push(1); if (T.h.length > 200) T.h.shift(); addT(p.t);
    const hit = T.target && T.c === T.target;
    if (hit) { const ls = DONE_LINES(T.target); T.msg = ls[Math.floor(Math.random() * ls.length)]; }
    buzz(hit); tick(hit); save(); render(); if (hit) flash('[data-tas]');
  }

  /* ---------- أذكار بعد الصلاة (تدفق موجَّه) ---------- */
  let FLOW = [];   // من data/adhkar.json → items.p_tasbih_33.steps (رواه مسلم)
  function renderFlow() {
    const F = S.flow, i = Math.min(F.i, 3), st = FLOW[i], c = F.c[i] || 0, tot = F.c.reduce((a, b, k) => a + Math.min(b, FLOW[k][1]), 0);
    const end = F.i > 3, P = progOf('p');
    const others = D.sections.after_prayer.filter(x => x !== 'p_tasbih_33');
    const head = `<div class="adh-sub"><button class="lnk back" data-v="t">رجوع</button><b>أذكار بعد الصلاة</b><span class="muted sm">${esc(D.items.p_tasbih_33.source)}</span></div>`;
    if (end) return head + `<div class="adh-end">${ring(1, '<span class="in"><b>100</b><span>من 100</span></span>', 'sm')}<h3>تمّت أذكار بعد الصلاة</h3><p>${F.skip ? (F.skip === 1 ? 'تمّت، وتخطّيت خطوةً واحدةً.' : `تمّت، وتخطّيت ${cnt(F.skip, 'step', 'acc')}.`) : 'تقبّل الله صلاتك وذكرك.'}</p><p class="adh-v c"><b>الفضل:</b> «${esc(D.items.p_tasbih_33.virtue)}»</p><div class="adh-nav"><button class="pri" data-frestart>ابدأ من جديد</button><button data-v="t">إغلاق</button></div></div>` + othersHTML(others, P);
    return head + `<div class="adh-steps">${FLOW.map((s, k) => `<button class="${k === i ? 'on' : ''}${(F.c[k] || 0) >= s[1] ? ' ok' : ''}" data-fstep="${k}">${esc(short(s[0]))}${s[1] > 1 ? ' ' + s[1] : ''}</button>`).join('')}</div>
      <div class="adh-prog"><div class="row"><b>المرحلة ${i + 1} من 4</b><span>${tot} من 100</span></div>${bar(tot / 100)}</div>
      <div class="adh-tas">
        <p class="adh-dh">${esc(st[0])}</p>
        <button class="adh-big" data-flow aria-label="اضغط للعدّ">${ring(c / st[1], `<span class="in"><b>${st[1] > 1 ? fmt(c) : (c ? '1' : '0')}</b><span>${st[1] > 1 ? 'من ' + st[1] : 'مرّة واحدة'}</span><small>${st[1] > 1 ? 'اضغط للعدّ' : 'اضغط إذا قلته'}</small></span>`)}</button>
        ${i < 3 ? `<p class="muted sm c">التالي: ${esc(short(FLOW[i + 1][0]))}</p>` : ''}
        <div class="adh-nav"><button data-fprev ${i ? '' : 'disabled'}>السابق</button><button class="pri" data-fnext>التالي</button></div>
        <label class="adh-tog1"><input type="checkbox" data-opt="auto" ${S.auto ? 'checked' : ''}> الانتقال تلقائيًا عند تمام العدد</label>
      </div>` + othersHTML(others, P);
  }
  const othersHTML = (ids, P) => `<h4 class="adh-h4">بقية أذكار بعد الصلاة</h4><div class="adh-list">${ids.map(id => card(id, 'p', P[id] || 0)).join('')}</div>`;
  function tapFlow() {
    const F = S.flow, i = F.i, st = FLOW[i]; if (!st) return;
    if ((F.c[i] || 0) >= st[1]) { if (S.auto) { F.i++; save(); render(); } return; }
    F.c[i] = (F.c[i] || 0) + 1; addT(st[0]);
    const full = F.c[i] >= st[1]; buzz(full); tick(full);
    if (full && (S.auto || i === 3)) { F.i++; if (F.i > 3) finishFlow(); }
    save(); render(); if (full) flash(S.flow.i > 3 ? '.adh-end .adh-ring' : '[data-flow]');
  }
  function finishFlow() { const F = S.flow; F.skip = F.c.filter((x, k) => x < FLOW[k][1]).length; day(today()).p++; }

  /* ---------- متابعة الصلاة: تقويم 30 يومًا للصلوات الخمس (على الجهاز فقط) ---------- */
  /* v26z3: كانت «متابعة الفجر». البيانات القديمة S.fajr تبقى كما هي (لا حذف)، وتُنسخ مرة واحدة إلى S.pr: كل يوم صُلّي فجره ← {f:1}. */
  const FN = 30, PR = [['f', 'الفجر'], ['d', 'الظهر'], ['a', 'العصر'], ['m', 'المغرب'], ['i', 'العشاء']], PN = Object.fromEntries(PR);
  if (!S.pr || typeof S.pr !== 'object') {
    const o = S.fajr || {}, d = {};
    for (const k of Object.keys(o.d || {})) if (o.d[k]) d[k] = { f: 1 };
    S.pr = { start: o.start || null, d, hist: (o.hist || []).map(h => ({ start: h.start, n: h.n, by: { f: h.n }, fajrOnly: 1 })), pf: 'all' };
    save();
  }
  let PSEL = null;   // اليوم المختار للتسجيل (افتراضيًا اليوم)
  const kday = (k, n) => { const d = new Date(k + 'T00:00'); d.setDate(d.getDate() + n); return dkey(d); };
  const diffD = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
  const pCnt = k => { const x = S.pr.d[k]; return x ? PR.filter(([p]) => x[p]).length : 0; };
  // التاريخ في الدائرة: هجري (أم القرى) / اليوم / ميلادي، بأرقام غربية
  const HF = (() => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }); } catch (e) { return null; } })();
  const WF = (() => { try { return new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long' }); } catch (e) { return null; } })();
  const hij = d => { if (!HF) return ''; try { const o = {}; for (const x of HF.formatToParts(d)) o[x.type] = x.value; return o.year && o.month && o.day ? `${parseInt(o.year, 10)}/${+o.month}/${+o.day}` : ''; } catch (e) { return ''; } };
  // v26z9: رقم اليوم واسم الشهر والسنة الهجرية (أم القرى) من Intl، واسم الشهر الميلادي بالعربية
  const HM = (() => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long' }); } catch (e) { return null; } })();
  const GM = (() => { try { return new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long' }); } catch (e) { return null; } })();
  const hParts = d => { const o = {}; try { if (HF) for (const x of HF.formatToParts(d)) o[x.type] = x.value; } catch (e) {} return { d: o.day ? String(+o.day) : '', y: o.year ? String(parseInt(o.year, 10)) : '', m: HM ? HM.format(d) : '' }; };
  const dParts = k => { const d = new Date(k + 'T12:00'); return { h: hij(d), w: WF ? WF.format(d) : '', g: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` }; };
  function fState() {
    const F = S.pr, t = today();
    const start = F.start || t, ti = diffD(start, t), days = [];
    for (let i = 0; i < FN; i++) {
      const k = kday(start, i), c = pCnt(k), x = F.d[k] || {};
      days.push({ k, i, c, x, past: i < ti, isT: i === ti, fut: i > ti });
    }
    const n = days.reduce((a, d) => a + d.c, 0);
    return { F, t, ti: F.start ? ti : -1, n, days, started: !!F.start };
  }
  // حالة الدائرة حسب العرض المختار: الكل (عدد الخمس) أو صلاة بعينها
  function dSt(d, pf) {
    if (pf === 'all') { if (d.c === 5) return 'done'; if (d.c > 0) return 'part'; return d.fut ? 'up' : d.isT ? 'today' : 'miss'; }
    if (d.x[pf]) return 'done'; return d.fut ? 'up' : d.isT ? 'today' : 'miss';
  }
  function fStreaks(st) {
    const on = st.days.map(x => x.c === 5); let best = 0, run = 0;
    for (const x of on) { run = x ? run + 1 : 0; best = Math.max(best, run); }
    let cur = 0, i = Math.min(st.ti, FN - 1); if (i >= 0 && !on[i]) i--;
    while (i >= 0 && on[i]) { cur++; i--; }
    return [cur, best];
  }
  const fDate = () => {
    const d = new Date();
    let h = ''; try { h = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) {}
    let g = ''; try { g = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { g = today(); }
    return (h ? h.replace(/\s*هـ$/, '') + ' هـ · ' : '') + g + ' م';
  };
  const CK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function renderFajr() {
    const st = fState(), F = st.F, ended = st.ti >= FN, pf = PR.some(([p]) => p === F.pf) ? F.pf : 'all';
    const valid = k => { const d = st.days.find(x => x.k === k); return d && !d.fut; };
    if (!PSEL || !valid(PSEL)) PSEL = ended ? null : st.t;
    const sd = PSEL && st.days.find(x => x.k === PSEL), isT = PSEL === st.t, sp = PSEL ? dParts(PSEL) : null;
    const dayCard = sd ? `<div class="adh-pday">
        <div class="adh-pdh"><b>${isT ? 'صلوات اليوم' : `صلوات يوم ${esc(sp.w)}`}</b><span>${fmt(sd.c)} من 5</span></div>
        ${isT ? '' : `<p class="adh-pdd">${esc(sp.h)} هـ · ${esc(sp.g)} م</p>`}
        <div class="adh-pbtns" role="group" aria-label="${isT ? 'صلوات اليوم' : 'صلوات اليوم المختار'}">${PR.map(([p, l]) => `<button class="${sd.x[p] ? 'on' : ''}" data-pr="${p}" aria-pressed="${sd.x[p] ? 'true' : 'false'}">${CK}<span>${l}</span></button>`).join('')}</div>
        <small class="adh-phint">${isT ? 'اضغط اسم الصلاة لتسجيلها، واضغطه مرّة أخرى للتراجع.' : 'تعديل يوم سابق: اضغط اسم الصلاة لتسجيلها أو للتراجع عنها.'}</small>
        ${isT ? '' : '<button class="lnk" data-ptoday>العودة إلى اليوم</button>'}
      </div>` : '';
    const legend = pf === 'all'
      ? '<span><i class="pdl p-done"></i>الخمس كلها</span><span><i class="pdl p-part"></i>بعضها</span><span><i class="pdl p-miss"></i>لم يُسجَّل</span><span><i class="pdl p-up"></i>قادم</span>'
      : '<span><i class="pdl p-done"></i>صلّيت</span><span><i class="pdl p-miss"></i>لم تُسجَّل</span><span><i class="pdl p-up"></i>قادم</span>';
    // v26z9 (سفيان): شبكة أسبوعية من 7 أعمدة تبدأ بالأحد، وصف أسماء أيام قصيرة؛ في الدائرة رقم اليوم الهجري، وتحته اليوم الميلادي صغيرًا باهتًا؛
    // اسما الشهرين الهجري والميلادي مرة واحدة في رأس التقويم؛ دائرة نحو 40px وحلقة ذهبية نحو 2px؛ نقطة ذهبية لليوم؛ الأيام القادمة باهتة بلا حلقة.
    const CIRC = 138.23;   // 2πr، r=22 في viewBox 48
    const pdays = st.days.map(d => { const dt = new Date(d.k + 'T12:00'); return { d, dt, h: hParts(dt) }; });
    const off = pdays.length ? pdays[0].dt.getDay() : 0;   // 0 = الأحد
    const cells = [];
    for (let i = 0; i < off; i++) cells.push('<span class="pc pc-e" aria-hidden="true"></span>');
    for (const { d, dt, h } of pdays) {
      const p = dParts(d.k), s2 = dSt(d, pf), fr = d.fut ? 0 : pf === 'all' ? d.c / 5 : d.x[pf] ? 1 : 0;
      const lab = `${p.w} ${p.h} هـ، ${p.g} م` + (d.fut ? '' : pf === 'all' ? `، ${d.c} من 5` : d.x[pf] ? '، صلّيت' : '');
      cells.push(`<button role="listitem" class="pc p-${s2}${d.isT ? ' is-t' : ''}${d.k === PSEL ? ' sel' : ''}" data-pday="${d.k}" ${d.fut ? 'disabled' : ''} aria-label="${esc(lab)}"><svg class="pr" viewBox="0 0 48 48" aria-hidden="true">${d.fut ? '' : '<circle class="tr" cx="24" cy="24" r="22"/>'}${fr > 0 ? `<circle class="fl" cx="24" cy="24" r="22" stroke-dasharray="${(fr * CIRC).toFixed(1)} ${CIRC}" transform="rotate(-90 24 24)"/>` : ''}</svg><span class="h">${esc(h.d)}</span><span class="g">${dt.getDate()}</span>${d.isT ? '<i class="tdot" aria-hidden="true"></i>' : ''}</button>`);
    }
    const WD = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const span = (a, b) => a === b ? a : `${a} – ${b}`;
    const f0 = pdays[0], f1 = pdays[pdays.length - 1];
    const hHead = f0 && f0.h.m ? (f0.h.y === f1.h.y ? `${span(f0.h.m, f1.h.m)} ${f0.h.y}` : `${f0.h.m} ${f0.h.y} – ${f1.h.m} ${f1.h.y}`) + ' هـ' : '';
    const gm = x => GM ? GM.format(x.dt) : '', gy = x => x.dt.getFullYear();
    const gHead = f0 ? (gy(f0) === gy(f1) ? `${span(gm(f0), gm(f1))} ${gy(f0)}` : `${gm(f0)} ${gy(f0)} – ${gm(f1)} ${gy(f1)}`) + ' م' : '';
    const cal = `<div class="adh-calh"><b>${esc(hHead)}</b><span>${esc(gHead)}</span></div>
      <div class="adh-wdays" aria-hidden="true">${WD.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="adh-wk" role="list" aria-label="أيام التقويم">${cells.join('')}</div>`;
    return `<p class="adh-fdate">${esc(fDate())}</p>
      <p class="adh-fday">${!st.started ? 'تقويم 30 يومًا يبدأ من أول تسجيل.' : ended ? 'انتهت الأيام الثلاثون.' : `اليوم ${fmt(st.ti + 1)} من ${FN}`}</p>
      ${dayCard}
      ${ended ? '<div class="adh-ctl"><button class="chip adh-fy" data-fnew>بدء تقويم جديد</button></div>' : ''}
      <div class="seg adh-pf" role="tablist" aria-label="عرض التقويم">${[['all', 'الكل'], ...PR].map(([k, l]) => `<button class="${pf === k ? 'on' : ''}" data-pf="${k}" role="tab" aria-selected="${pf === k}">${l}</button>`).join('')}</div>
      <div class="adh-cal2">${cal}</div>
      <div class="adh-fleg">${legend}</div>
      <div class="adh-entry one">
        <button data-v="freport"><b>التقرير</b><span class="lnk2">لكل صلاة وللصلوات كلها</span></button>
      </div>
      <p class="adh-note">متابعة الصلاة محفوظة على جهازك فقط، ولا تُرسَل إلى أي خادم.</p>`;
  }
  function renderFReport() {
    const st = fState(), [cur, best] = fStreaks(st), T = FN * 5;
    const pastN = st.ti < 0 ? 0 : Math.min(FN, st.ti);   // الأيام السابقة لليوم
    const tD = st.days.find(d => d.isT);
    const den = p => pastN + (tD && tD.x[p] && st.ti < FN ? 1 : 0);
    const per = PR.map(([p, l]) => { const n = st.days.filter(d => d.x[p]).length, e = den(p); return { p, l, n, e, pct: e ? Math.round(n / e * 100) : 0 }; });
    const eAll = per.reduce((a, x) => a + x.e, 0), pct = eAll ? Math.round(st.n / eAll * 100) : 0;
    const full = st.days.filter(d => d.c === 5).length, left = st.ti < 0 ? FN : Math.max(0, FN - st.ti - 1);
    const prev = (st.F.hist || [])[st.F.hist.length - 1];
    return `<div class="adh-sub"><button class="lnk back" data-v="f">رجوع</button><b>تقرير متابعة الصلاة</b><span></span></div>
      <div class="adh-goal">${ring(st.n / T, `<span class="in"><b>${fmt(st.n)}</b><span>من ${T}</span></span>`)}<div><b>${st.n ? `سجّلت ${cnt(st.n, 'salah', 'acc')} من ${T}` : 'لم تسجّل أي صلاة بعد.'}</b></div></div>
      <div class="adh-grid">
        <div class="adh-st"><span>نسبة الالتزام حتى اليوم</span><b>${fmt(pct)}%</b><small>${eAll ? 'من الصلوات التي مضى وقتها منذ البدء' : 'تبدأ مع أول تسجيل.'}</small></div>
        <div class="adh-st"><span>أيام كاملة (الصلوات الخمس)</span><b>${cnt(full, 'day')}</b><small>من ${FN}</small></div>
        <div class="adh-st"><span>أيام كاملة متتالية</span><b>${cnt(cur, 'day')}</b></div>
        <div class="adh-st"><span>أطول سلسلة</span><b>${cnt(best, 'day')}</b></div>
        <div class="adh-st w"><span>الأيام المتبقية</span><b>${st.ti >= FN ? 'انتهى التقويم' : cnt(left, 'day')}</b>${prev ? `<small>${prev.fajrOnly ? `التحدي السابق (الفجر): ${fmt(prev.n)} من ${FN}` : `التقويم السابق: ${fmt(prev.n)} من ${FN * 5}`}</small>` : ''}</div>
      </div>
      <div class="adh-pper"><b class="adh-pph">لكل صلاة</b>${per.map(x => `<div class="adh-prow"><b>${x.l}</b>${bar(x.e ? x.n / x.e : 0)}<span>${fmt(x.n)} من ${fmt(x.e)}</span><em>${fmt(x.pct)}%</em></div>`).join('')}</div>
      <p class="adh-note">التقرير محسوب على جهازك فقط، ولا يُرسَل إلى أي خادم.</p>`;
  }
  function tapPray(p) {
    const F = S.pr, t = today(), k = PSEL || t;
    if (!F.start) { if (k !== t) return; F.start = t; }
    const ti = diffD(F.start, t), di = diffD(F.start, k); if (ti >= FN || di < 0 || di > ti) return render();
    const x = F.d[k] || (F.d[k] = {});
    if (x[p]) { delete x[p]; if (!Object.keys(x).length) delete F.d[k]; if (!Object.keys(F.d).length && F.start === t) F.start = null; save(); return render(); }
    x[p] = 1; const all = PR.every(([q]) => x[q]); buzz(all); tick(); save(); render();
    toast(all ? (k === t ? 'أتممت الصلوات الخمس اليوم. تقبّل الله منك.' : 'اكتملت صلوات ذلك اليوم الخمس.') : `سُجِّلت صلاة ${PN[p]}.`);
  }
  function tapFajr(what) {
    const F = S.pr;
    if (what === 'new') {
      A.ask('بدء تقويم جديد لمدة 30 يومًا؟ تبقى نتيجة التقويم السابق في التقرير.', 'ابدأ').then(ok => { if (!ok) return;
      const st = fState(), by = {}; for (const [p] of PR) by[p] = st.days.filter(d => d.x[p]).length;
      (F.hist = F.hist || []).push({ start: F.start, n: st.n, by }); F.start = null; F.d = {}; PSEL = null; save(); render(); }); return;
    }
  }

  /* ---------- الإحصاءات ---------- */
  function range() {
    const keys = Object.keys(S.log).sort(), t = new Date(); const out = [];
    const n = period === 'd' ? 1 : period === 'w' ? 7 : period === 'm' ? 30 : (keys.length ? Math.max(1, Math.round((t - new Date(keys[0] + 'T00:00')) / 864e5) + 1) : 1);
    for (let k = 0; k < n; k++) { const d = new Date(t); d.setDate(t.getDate() - k); out.push(dkey(d)); }
    return out;
  }
  const active = L => L && (L.t || L.m || L.e || L.p);
  function streaks() {
    let cur = 0; const d = new Date(); if (!active(S.log[dkey(d)])) d.setDate(d.getDate() - 1);
    while (active(S.log[dkey(d)])) { cur++; d.setDate(d.getDate() - 1); }
    const ks = Object.keys(S.log).filter(k => active(S.log[k])).sort(); let best = 0, run = 0, prev = null;
    for (const k of ks) { const dt = new Date(k + 'T00:00'); run = prev && Math.round((dt - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = dt; }
    return [cur, best];
  }
  const streakLine = n => n === 0 ? 'ابدأ اليوم، وتُحسب الأيام من أول ذكر.' : n === 1 ? 'بداية طيبة.' : 'ثبّتك الله.';
  function renderStats() {
    const R = range(), Ls = R.map(k => S.log[k]).filter(Boolean), sum = f => Ls.reduce((a, L) => a + (L[f] || 0), 0);
    const tT = sum('t'), m = sum('m'), e = sum('e'), p = sum('p'), by = {};
    Ls.forEach(L => Object.entries(L.by || {}).forEach(([k, v]) => by[k] = (by[k] || 0) + v));
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    const td = S.log[today()] || { t: 0 }, g = S.goal || 100, [cur, best] = streaks();
    const empty = { d: 'لم تُسجَّل أذكار اليوم بعد.', w: 'لا إحصاءات لهذا الأسبوع بعد.', m: 'لا إحصاءات لهذا الشهر بعد.', a: 'لا إحصاءات بعد.' }[period];
    const daysLine = n => n ? `أتممتها ${cnt(n, 'day', 'acc')} من ${fmt(R.length)}` : 'لم تُتمّها بعد.';
    return `<div class="adh-sub"><button class="lnk back" data-v="t">رجوع</button><b>الإحصاءات</b><span></span></div>
      <div class="adh-goal">${ring(td.t / g, td.t >= g ? `<span class="in"><b>${fmt(td.t)}</b><span class="met">الهدف ${fmt(g)} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></span>` : `<span class="in"><b>${fmt(td.t)}</b><span>من ${fmt(g)}</span></span>`, 'sm')}<div><b>هدف اليوم</b><p class="muted sm">${td.t >= g ? 'أحسنت، تقبّل الله ذكرك.' : `${cnt(g, 'tasbeeha')} في اليوم`}</p><button class="lnk" data-goal>تعديل الهدف</button></div></div>
      <div class="seg adh-per">${[['d', 'اليوم'], ['w', 'الأسبوع'], ['m', 'الشهر'], ['a', 'الكل']].map(([k, l]) => `<button class="${period === k ? 'on' : ''}" data-per="${k}">${l}</button>`).join('')}</div>
      ${Ls.some(active) ? '' : `<p class="adh-empty">${empty}</p>`}
      <div class="adh-grid">
        <div class="adh-st"><span>مجموع التسبيح</span><b>${cnt(tT, 'tasbeeha')}</b></div>
        <div class="adh-st"><span>أيام متتالية</span><b>${cnt(cur, 'day')}</b><small>${streakLine(cur)}</small>${best > cur ? `<small>أطول سلسلة: ${cnt(best, 'day')}</small>` : ''}</div>
        <div class="adh-st"><span>أذكار الصباح</span>${period === 'd' ? `<b>${m ? 'تمّت' : '—'}</b><small>${m ? 'تقبّل الله منك.' : 'لم تُتمّها بعد.'}</small>` : `<b class="s">${daysLine(m)}</b>`}</div>
        <div class="adh-st"><span>أذكار المساء</span>${period === 'd' ? `<b>${e ? 'تمّت' : '—'}</b><small>${e ? 'تقبّل الله منك.' : 'لم تُتمّها بعد.'}</small>` : `<b class="s">${daysLine(e)}</b>`}</div>
        <div class="adh-st w"><span>أذكار بعد الصلاة</span><b>${cnt(p, 'salah')}</b><small>من ${fmt(5 * R.length)}</small></div>
        <div class="adh-st w"><span>أكثر ذكر</span><small>${top ? `أكثر ما سبّحت به: ${esc(short(top[0]))} (${fmt(top[1])})` : 'يظهر هنا الذكر الذي تكثر منه.'}</small></div>
      </div>
      <p class="adh-note">إحصاءاتك محفوظة على جهازك فقط، ولا تُرسَل إلى أي خادم.</p>
      <button class="adh-clear" data-clear>مسح الإحصاءات</button>`;
  }

  function renderCity() {
    return `<div class="adh-sub"><button class="lnk back" data-v="back">رجوع</button><b>اختر المدينة</b><span></span></div>
      <div class="adh-cities">${CITIES.map((c, i) => `<button class="${i === S.city ? 'on' : ''}" data-city="${i}">${esc(c[0])}</button>`).join('')}</div>
      <p class="adh-note">تُحسب أوقات الشروق والغروب على الجهاز بطريقة أم القرى، ولا يُرسَل موقعك إلى أي خادم.</p>`;
  }

  /* ---------- الهيكل ---------- */
  let last = 'm';
  function render() {
    const b = body(); if (!b || !D) return;
    const tabs = ['m', 'e', 't', 'f'], tb = tabs.includes(V) ? V : (V === 'flow' || V === 'stats' ? 't' : V === 'freport' ? 'f' : last);
    const sy = b.scrollTop;
    b.innerHTML = `<div class="seg adh-tabs">${[['m', 'أذكار الصباح'], ['e', 'أذكار المساء'], ['t', 'التسبيح'], ['f', 'متابعة الصلاة']].map(([k, l]) => `<button class="${tb === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="adh-view" data-view="${V}">${V === 'm' || V === 'e' ? renderME(V) : V === 't' ? renderT() : V === 'f' ? renderFajr() : V === 'freport' ? renderFReport() : V === 'flow' ? renderFlow() : V === 'stats' ? renderStats() : renderCity()}</div>`;
    b.scrollTop = sy;
  }
  function go(v) { if (v === 'back') v = last; if (v === 'm' || v === 'e') last = v; V = v; render(); body().scrollTop = 0;
    // v26z7: التقويم يفتح على الأسبوع الحالي واليوم ظاهر
    if (v === 'f') requestAnimationFrame(() => { const t = body().querySelector('.pc.is-t'); if (t) t.scrollIntoView({ block: 'nearest' }); }); }

  function onClick(ev) {
    const t = ev.target, q = s => t.closest(s);
    if (q('[data-src]')) { if (navigator.onLine === false) { ev.preventDefault(); toast('لا اتصال بالإنترنت الآن، افتح المصدر حين تتّصل.'); } return; }
    let el;
    if (MENU && !q('.adh-tsel')) { MENU = false; render(); return; }
    if (PMENU && !q('.adh-psel')) { PMENU = false; render(); return; }
    if (q('[data-pmenu]')) { PMENU = !PMENU; return render(); }
    if ((el = q('[data-v]'))) return go(el.dataset.v);
    if ((el = q('.adh-read'))) { const pg = +el.dataset.page; A.closeSheets(); A.goPage(pg, false, true); return; }
    if ((el = q('[data-preset]'))) { PMENU = false; const i = +el.dataset.preset; S.tas.p = i; S.tas.target = PRESETS[i].n; S.tas.c = 0; S.tas.h = []; S.tas.msg = ''; save(); return render(); }
    if (q('[data-tas]')) return tapTas();
    if (q('[data-undo]')) { const T = S.tas; if (T.h.length && T.c > 0) { T.h.pop(); T.c--; addT((PRESETS[T.p] || PRESETS[0]).t, -1); save(); render(); } return; }
    if (q('[data-reset]')) { const z = () => { S.tas.c = 0; S.tas.h = []; S.tas.msg = ''; save(); render(); }; if (!S.tas.c) return z(); A.ask('تصفير العداد؟ سيبقى مجموع اليوم محفوظًا.', 'صفّر').then(ok => ok && z()); return; }
    if (q('[data-tmenu]')) { MENU = !MENU; return render(); }
    if ((el = q('[data-target]'))) {
      let v = el.dataset.target; MENU = false;
      if (v === 'c') { const r = prompt('عدد مخصص — اكتب العدد', S.tas.target || ''); if (r === null) return; v = parseInt(String(r).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); if (!(v >= 1 && v <= 9999)) { toast('اكتب عددًا من 1 إلى 9999.'); return; } }
      S.tas.target = +v; S.tas.msg = ''; save(); return render();
    }
    if ((el = q('[data-pr]'))) return tapPray(el.dataset.pr);
    if ((el = q('[data-pday]'))) { if (el.disabled) return; PSEL = el.dataset.pday; render(); const c = body().querySelector('.adh-pday'); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if ((el = q('[data-pf]'))) { S.pr.pf = el.dataset.pf; save(); return render(); }
    if (q('[data-ptoday]')) { PSEL = today(); return render(); }
    if (q('[data-fnew]')) return tapFajr('new');
    if (q('[data-flow]')) return tapFlow();
    if (q('[data-fnext]')) { const F = S.flow; F.i++; if (F.i > 3) finishFlow(); save(); return render(); }
    if (q('[data-fprev]')) { S.flow.i = Math.max(0, S.flow.i - 1); save(); return render(); }
    if ((el = q('[data-fstep]'))) { S.flow.i = +el.dataset.fstep; save(); return render(); }
    if (q('[data-frestart]')) { S.flow = { i: 0, c: [0, 0, 0, 0], skip: 0 }; save(); return render(); }
    if ((el = q('[data-per]'))) { period = el.dataset.per; return render(); }
    if (q('[data-goal]')) { const r = prompt('تعديل الهدف — اكتب العدد', S.goal); if (r === null) return; const v = parseInt(String(r).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); if (!(v >= 1 && v <= 9999)) { toast('اكتب عددًا من 1 إلى 9999.'); return; } S.goal = v; save(); return render(); }
    if (q('[data-clear]')) { A.ask('مسح كل الإحصاءات؟ لا يمكن التراجع.', 'امسح').then(ok => { if (ok) { S.log = {}; save(); render(); } }); return; }
    if ((el = q('[data-city]'))) { S.city = +el.dataset.city; save(); calcTimes(); return go('back'); }
    if (q('details, summary, input, label, a')) return;
    if ((el = q('.adh-card'))) { const m = V === 'flow' ? 'p' : V; if (m === 'm' || m === 'e' || m === 'p') tapCard(el, m); }
  }
  function onChange(ev) { const o = ev.target.dataset && ev.target.dataset.opt; if (!o) return; S[o] = ev.target.checked ? 1 : 0; save(); }

  async function open(view) {
    A.openSheet('adhkar');
    const b = body();
    if (!b._wired) { b._wired = 1; b.addEventListener('click', onClick); b.addEventListener('change', onChange); }
    if (!D) {
      b.innerHTML = '<p class="muted c" style="padding:40px 0">…</p>';
      try { D = await (await fetch('data/adhkar.json')).json(); FLOW = D.items.p_tasbih_33.steps.map(x => [x.text, x.count]); } catch (e) { b.innerHTML = '<p class="muted c">تعذّر فتح الأذكار. تحقّق من الاتصال ثم أعد المحاولة.</p>'; return; }
    }
    await loadAdhan(); calcTimes();
    if (!V || view) { V = view || autoTab(); if (V === 'm' || V === 'e') last = V; }
    render();
  }
  function settingsHTML() {
    const row = (k, l, on) => `<div class="sw-row" data-adhopt="${k}" role="presentation"><b>${l}</b><button class="switch" role="switch" aria-checked="${!!on}" aria-label="${l}"></button></div>`;
    const note = VOK ? '' : `<p class="muted sm">${IOS ? 'الاهتزاز غير مدعوم على الآيفون، فاستخدم النقرة الصوتية. وتُسمَع النقرة إذا لم يكن الجهاز على الوضع الصامت.' : 'الاهتزاز غير مدعوم في هذا المتصفح، فاستخدم النقرة الصوتية.'}</p>`;
    return `<label class="lbl">أذكاري</label>${VOK ? row('vib', 'اهتزاز عند كل تسبيحة', S.vib) : ''}${row('snd', 'نقرة صوتية خفيفة', S.snd)}${note}`;
  }
  const toggle = k => {   // v26z16: يُستدعى داخل نقرة المستخدم، فنجرّب الإحساس فورًا عند التفعيل
    if (k === 'vib' && VOK) { S.vib = S.vib ? 0 : 1; save(); if (S.vib) buzz(false); }
    else if (k === 'snd') { S.snd = S.snd ? 0 : 1; save(); if (S.snd) { unlock(); tick(false); } }
  };
  window.ADHKAR = { open, go, settingsHTML, toggle, state: () => S, caps: () => ({ vib: VOK, ios: IOS, ac: AC ? AC.state : null }), _reset: () => { S = def(); save(); } };
})();
