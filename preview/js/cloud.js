/* الدخول بحساب Google (اختياري) ومزامنة الملاحظات والورد والإعدادات.
   الجهاز هو الأصل: التطبيق يعمل كاملًا بدون دخول، وإن تعذّر تحميل Firebase يبقى كل شيء على الجهاز.
   إعداد Firebase في js/config.js (APP.FIREBASE)؛ إن كان null فالتطبيق محلي بالكامل ولا تُحمَّل المكتبة. يُعاد حاليًا استخدام مشروع (english-hub-1d37b). مسار البيانات: users/{uid}/apps/mushaf
   (مستند مستقل، لا يلمس مستند منصة الإنجليزية users/{uid}). لا تُحمَّل مكتبة Firebase إلا عند فتح الإعدادات أو إن كان الجهاز داخلًا من قبل. */
const CLOUD = (() => {
  'use strict';
  const CFG = (window.APP && APP.FIREBASE) || null;
  const ON = !!CFG && !/[?&]nocloud\b/.test(location.search);   // مفتاح التشغيل: بلا إعداد = وضع محلي
  const FB_VER = '10.14.1';
  const KEYS = ['mushaf.preview.v1', 'mushaf.preview.notes', 'mushaf.preview.notes.del'], META = 'mushaf.preview.cloud', DEB = 8000;
  const G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Twitter|Snapchat|TikTok|Line\/|LinkedInApp|; wv\)/i.test(navigator.userAgent || '');
  /* v26z17 (auth): Safari وكل متصفحات الآيفون تعزل تخزين الطرف الثالث، فـsignInWithRedirect مع authDomain على firebaseapp.com
     لا يرجع بنتيجة أبدًا (ولا يمكن تمرير /__/auth عبر GitHub Pages). على هذه المتصفحات: نافذة الدخول (popup) فقط، بلا تحويل. */
  const UA = navigator.userAgent || '';
  const IOS = /iP(hone|ad|od)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const NO_REDIRECT = IOS || (/Safari\//.test(UA) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(UA));
  const STANDALONE = () => { try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } };
  let fb = null, loading = null, user = null, failed = false, st = { c: '', t: '' }, upT = 0, applying = false, lastPull = 0, busyIn = false, busyAt = 0;
  const USER = () => user;
  const esc = window.ESC;   // v26z11: دالة التهريب الموحّدة (js/esc.js)
  const rawSet = Storage.prototype.setItem;
  const lg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const ls = (k, v) => { try { rawSet.call(localStorage, k, v); } catch (e) {} };
  const J = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } };
  const meta = () => J(lg(META), {}) || {};
  const setMeta = m => ls(META, JSON.stringify(m));
  const say = m => { try { window.__app.toast(m); } catch (e) {} };
  const tm = t => { try { return new Date(t).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };

  /* ---------- الدمج: لا يضيع شيء من الجهازين ---------- */
  // v26z11: لا يُقبل من السحابة إلا ملاحظة بالشكل المتوقع (معرّف ضيق، صفحة رقم، آية بصيغة س:آ، نص)
  const okNote = n => !!n && typeof n.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(n.id) && Number.isInteger(+n.p) && +n.p >= 1 && +n.p <= 604
    && (n.k == null || /^\d{1,3}:\d{1,3}$/.test(n.k)) && (n.kb == null || /^\d{1,3}:\d{1,3}$/.test(n.kb)) && typeof n.text === 'string';
  function mergeNotes(L, C, dl) {
    const m = new Map();
    for (const n of [...(C || []), ...(L || [])]) { if (!okNote(n)) continue; const o = m.get(n.id); if (!o || (n.u || n.t || 0) >= (o.u || o.t || 0)) m.set(n.id, n); }
    return [...m.values()].filter(n => !(dl[n.id] && dl[n.id] >= (n.u || n.t || 0))).sort((a, b) => a.t - b.t);
  }
  function mergeDel(a, b) { const o = Object.assign({}, a || {}); for (const [k, v] of Object.entries(b || {})) if (!o[k] || v > o[k]) o[k] = v; return o; }
  function mergeState(L, C, localNewer) {
    L = L || {}; C = C || {};
    const base = Object.assign({}, localNewer ? C : L, localNewer ? L : C);   // الإعدادات والخطة وآخر صفحة: من الأحدث
    const mem = Object.assign({}, C.mem || {}); for (const [k, v] of Object.entries(L.mem || {})) if (!mem[k] || v > mem[k]) mem[k] = v;
    const rev = Object.assign({}, C.rev || {});
    for (const [k, r] of Object.entries(L.rev || {})) { const o = rev[k]; if (!o || (r.last || 0) > (o.last || 0) || ((r.last || 0) === (o.last || 0) && (r.due || 0) >= (o.due || 0))) rev[k] = r; }
    base.mem = mem; base.rev = rev;
    const lr = L.rem || {}; base.rem = Object.assign({}, base.rem || {}); delete base.rem.sub; if (lr.sub) base.rem.sub = lr.sub;   // اشتراك هذا الجهاز وحده
    return base;
  }
  // v26z11: اشتراك الإشعارات (rem.sub) يبقى على الجهاز فقط: يُحذف من نسخة المزامنة، ويُحفظ اشتراك هذا الجهاز عند الدمج
  const noSub = s => { try { const o = JSON.parse(s || '{}'); if (o && o.rem && 'sub' in o.rem) { o.rem = Object.assign({}, o.rem); delete o.rem.sub; } return JSON.stringify(o); } catch (e) { return '{}'; } };
  function snapshot() { return { st: noSub(lg('mushaf.preview.v1')), notes: lg('mushaf.preview.notes') || '[]', del: lg('mushaf.preview.notes.del') || '{}' }; }
  const sig = s => s.st + '|' + s.notes + '|' + s.del;

  /* ---------- مراقبة حفظ التطبيق ---------- */
  if (ON) Storage.prototype.setItem = function (k, v) {   // الوضع المحلي: لا مراقبة إطلاقًا
    rawSet.call(this, k, v);
    if (!applying && this === window.localStorage && KEYS.includes(k)) { const m = meta(); m.dirty = true; m.mt = Date.now(); setMeta(m); if (user) schedule(); }
  };

  /* ---------- تحميل Firebase عند الحاجة فقط ---------- */
  function load() {
    if (!ON) return Promise.reject(new Error('off'));
    if (loading) return loading;
    const base = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    loading = Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]).then(m => {
      const app = m[0].initializeApp(CFG, 'mushaf-preview');
      const auth = m[1].getAuth(app); auth.languageCode = 'ar';
      let db; try { db = m[2].initializeFirestore(app, { ignoreUndefinedProperties: true }); } catch (e) { db = m[2].getFirestore(app); }
      fb = { A: m[1], F: m[2], auth, db }; failed = false;
      if (sessionStorage.getItem('mushaf.redirect')) { sessionStorage.removeItem('mushaf.redirect'); m[1].getRedirectResult(auth).catch(authErr); }
      m[1].onAuthStateChanged(auth, onUser);
      return fb;
    }).catch(e => { failed = true; loading = null; render(); throw e; });
    return loading;
  }
  const prov = () => { const p = new fb.A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };
  function signIn() {
    if (IN_APP) { status('bad', 'افتح الرابط في Safari أو Chrome لتسجيل الدخول؛ متصفح التطبيقات لا يسمح بالدخول بحساب Google.'); return; }
    // لا نقفل الزر للأبد: في تطبيق الشاشة الرئيسية على الآيفون قد لا يصل خبر إغلاق نافذة الدخول، فنسمح بمحاولة جديدة بعد 15 ثانية
    // (محاولة popup جديدة تلغي السابقة تلقائيًا في Firebase).
    if (busyIn && Date.now() - busyAt < 15000) return;
    const go = () => { busyIn = true; busyAt = Date.now(); status('busy', 'جارٍ تسجيل الدخول…'); return fb.A.signInWithPopup(fb.auth, prov()).catch(e => {
      const c = (e && e.code) || '';
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
        if (NO_REDIRECT) throw e;   // التحويل لا يرجع بنتيجة على Safari/الآيفون؛ نطلب لمسة جديدة بدلًا منه
        sessionStorage.setItem('mushaf.redirect', '1'); return fb.A.signInWithRedirect(fb.auth, prov());
      }
      throw e;
    }).catch(authErr).then(() => { busyIn = false; }); };
    if (fb) return go();   // داخل نفس اللمسة، حتى لا يحجب المتصفح نافذة الدخول
    status('busy', 'جارٍ تجهيز الدخول…');
    load().then(go, () => status('bad', 'تعذّر تحميل خدمة الدخول. تحقّق من الاتصال؛ التطبيق يعمل بدونها.'));
  }
  function authErr(e) {
    busyIn = false;
    const c = (e && e.code) || '';
    if (/cancelled-popup/.test(c)) return;   // أُلغيت لأن محاولة أحدث بدأت
    if (/popup-closed|user-cancelled/.test(c)) {
      // في تطبيق الشاشة الرئيسية على الآيفون تُفتح صفحة Google في نافذة منفصلة؛ إن أغلقها المستخدم بعد صفحة خطأ من Google نعطيه طريقًا واضحًا
      if (IOS && STANDALONE()) status('', 'أُغلقت نافذة الدخول. إن ظهرت لك صفحة خطأ من Google فحاول مرة ثانية بعد قليل، أو افتح الرابط في Safari وسجّل الدخول منه.');
      else status('', '');
      return;
    }
    if (c === 'auth/network-request-failed') status('bad', 'لا يوجد اتصال بالإنترنت.');
    else if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') status('bad', 'منع المتصفح نافذة الدخول. اضغط الزر مرة ثانية، وإن تكرر المنع فاسمح بالنوافذ المنبثقة في إعدادات Safari.');
    else if (c === 'auth/unauthorized-domain') status('bad', 'هذا الرابط غير مفعّل لتسجيل الدخول.');
    else if (c === 'auth/operation-not-allowed') status('bad', 'الدخول بحساب Google غير مفعّل في المشروع.');
    else if (c === 'auth/too-many-requests') status('bad', 'محاولات كثيرة متتالية. حاول بعد دقائق.');
    else if (c === 'auth/web-storage-unsupported') status('bad', 'المتصفح يمنع التخزين اللازم للدخول. افتح الرابط في Safari خارج التصفح الخاص.');
    else if (c === 'auth/internal-error') status('bad', 'تعذّر الدخول من جهة Google. حاول بعد قليل.');
    else status('bad', 'تعذّر تسجيل الدخول، حاول مرة ثانية.' + (c ? ' (' + c + ')' : ''));
  }
  function signOut() {
    if (!fb) return;
    flush().then(() => fb.A.signOut(fb.auth)).then(() => { const m = meta(); delete m.uid; setMeta(m); say('خرجت من حسابك. بياناتك باقية على هذا الجهاز.'); });
  }

  /* v26z11: «احذف بياناتي من السحابة» — يحذف مستند هذا التطبيق وحده (users/{uid}/apps/mushaf) بعد تأكيد، ولا يمس بيانات الجهاز ولا مستند منصة الإنجليزية users/{uid} */
  async function delCloud() {
    const ok = await window.__app.ask('ستُحذف نسخة بياناتك المحفوظة في حسابك (الملاحظات، والخطة، والمحفوظ، والإعدادات) نهائيًّا، وتبقى كما هي على هذا الجهاز. ثم تخرج من حسابك.', 'احذف');
    if (!ok) return;
    if (!user || !fb) { say('سجّل الدخول أوّلًا.'); return; }
    clearTimeout(upT);
    try {
      await fb.F.deleteDoc(ref());
      await fb.A.signOut(fb.auth); const m = meta(); delete m.uid; m.dirty = false; setMeta(m);
      say('حُذِفت بياناتك من السحابة، وبقيت على هذا الجهاز.');
    } catch (e) { say(navigator.onLine === false ? 'لا اتصال بالإنترنت الآن. حاول حين تتّصل.' : 'تعذّر الحذف، حاول مرّة أخرى.'); }
  }
  /* ---------- المزامنة ---------- */
  const ref = () => fb.F.doc(fb.db, 'users', user.uid, 'apps', 'mushaf-preview');
  function denied(e) { return e && (e.code === 'permission-denied' || /permission/i.test(e.message || '')); }
  function upload() {
    if (!user || !fb) return Promise.resolve();
    const s = snapshot(), cu = Date.now();
    if (s.st.length + s.notes.length + s.del.length > 900000) { status('bad', 'حجم البيانات أكبر من حد المزامنة.'); return Promise.resolve(); }
    status('busy', 'جارٍ الحفظ في حسابك…');
    return fb.F.setDoc(ref(), { v: 1, st: s.st, notes: s.notes, del: s.del, cu, updatedAt: fb.F.serverTimestamp() }).then(() => {
      const m = meta(); m.uid = user.uid; m.sync = cu; if (sig(snapshot()) === sig(s)) m.dirty = false; setMeta(m);
      status('ok', 'محفوظة في حسابك · ' + tm(cu));
      if (meta().dirty) schedule();
    }).catch(e => {
      if (denied(e)) { status('bad', 'المزامنة غير مفعّلة بعد لهذا التطبيق. بياناتك محفوظة على جهازك.'); return; }
      status('bad', navigator.onLine === false ? 'غير متصل. ستُحفظ في حسابك عند عودة الاتصال.' : 'تعذّر الحفظ في حسابك، سنحاول لاحقًا.');
      clearTimeout(upT); upT = setTimeout(upload, 30000);
    });
  }
  function schedule() { clearTimeout(upT); upT = setTimeout(upload, DEB); }
  function flush() { clearTimeout(upT); return user && meta().dirty ? upload() : Promise.resolve(); }
  function pull() {
    if (!user || !fb) return Promise.resolve();
    lastPull = Date.now(); status('busy', 'جارٍ المزامنة…');
    return fb.F.getDoc(ref()).then(snap => {
      const c = snap.exists() ? snap.data() : null, m = meta(), L = snapshot();
      if (!c) return upload();
      const firstHere = m.uid !== user.uid;
      const localNewer = !firstHere && (m.mt || 0) > (+c.cu || 0);
      const dl = mergeDel(J(L.del, {}), J(c.del, {}));
      const out = {
        st: JSON.stringify(mergeState(J(L.st, {}), J(c.st, {}), localNewer)),
        notes: JSON.stringify(mergeNotes(J(L.notes, []), J(c.notes, []), dl)),
        del: JSON.stringify(dl)
      };
      const outS = { st: noSub(out.st), notes: out.notes, del: out.del };   // المقارنة بلا اشتراك الإشعارات
      const changedHere = sig(outS) !== sig(L), changedThere = sig(outS) !== sig({ st: c.st, notes: c.notes, del: c.del });
      if (changedHere) {
        applying = true;
        try { ls('mushaf.preview.notes', out.notes); ls('mushaf.preview.notes.del', out.del); ST.replace(J(out.st, {})); } finally { applying = false; }
        try { window.__app.reloadData(); } catch (e) {}
        if (firstHere) say('دُمِجت بياناتك مع حسابك.');
      }
      const mm = meta(); mm.uid = user.uid; mm.sync = +c.cu || 0; mm.dirty = false; setMeta(mm);
      if (changedThere) return upload();
      status('ok', 'متزامنة مع حسابك · ' + tm(Date.now()));
    }).catch(e => {
      if (denied(e)) status('bad', 'المزامنة غير مفعّلة بعد لهذا التطبيق. بياناتك محفوظة على جهازك.');
      else status('bad', 'تعذّرت المزامنة. بياناتك محفوظة على جهازك.');
    });
  }
  function onUser(u) {
    const prev = user; user = u || null; busyIn = false;
    if (user && (!prev || prev.uid !== user.uid)) pull();
    if (!user) { clearTimeout(upT); status('', ''); }
    render();
  }
  addEventListener('online', () => { if (user) schedule(); });
  document.addEventListener('visibilitychange', () => {
    if (!user) return;
    if (document.hidden) { if (meta().dirty) upload(); }
    else if (Date.now() - lastPull > 60000) pull();
  });

  /* ---------- الواجهة (داخل الإعدادات) ---------- */
  function status(c, t) { st = { c, t }; render(); }
  function html(mock) {   // mock: للاختبار واللقطات فقط (لا دخول حقيقي)
    if (!ON) return '';
    const user = mock || USER();
    if (failed && !user) return `<p class="muted sm cl-st bad">خدمة الدخول غير متاحة الآن. التطبيق يعمل كاملًا بدونها، وبياناتك على جهازك.</p>`;
    const s = st.t ? `<p class="cl-st ${st.c}" role="status">${esc(st.t)}</p>` : '';
    if (!user) return `<button class="cl-g" data-cl-in type="button">${G}<span>الدخول بحساب Google</span></button><p class="muted sm">اختياري: يحفظ ملاحظاتك وخطة الورد والمحفوظ والإعدادات في حسابك لتنتقل معك إلى أي جهاز. التطبيق يعمل كاملًا دون تسجيل دخول.</p>${s}`;
    const av = user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="cl-av">${esc(((user.displayName || user.email || '?').trim()[0]) || '?')}</span>`;
    return `<div class="cl-u">${av}<div><b>${esc(user.displayName || 'حسابي')}</b><small>${esc(user.email || '')}</small></div></div>${s || '<p class="cl-st ok">متصل بحسابك</p>'}<button class="cl-out" data-cl-out type="button">تسجيل الخروج</button><button class="cl-del" data-cl-del type="button">احذف بياناتي من السحابة</button><p class="muted sm">الخروج لا يحذف نسختك في السحابة. الحذف يمسح نسخة هذا التطبيق من حسابك فقط، وتبقى بياناتك على هذا الجهاز.</p>`;
  }
  function render() { const b = document.getElementById('clBox'); if (b) b.innerHTML = html(); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-cl-in]')) { e.preventDefault(); e.stopPropagation(); signIn(); }
    else if (e.target.closest('[data-cl-out]')) { e.preventDefault(); e.stopPropagation(); signOut(); }
    else if (e.target.closest('[data-cl-del]')) { e.preventDefault(); e.stopPropagation(); delCloud(); }
  }, true);
  const prep = () => { if (ON && !fb) load().catch(() => {}); };
  // إن كان هذا الجهاز داخلًا من قبل: نحمّل المكتبة بعد أول رسم لاستعادة الجلسة
  if (ON && meta().uid) { const kick = () => load().catch(() => {}); (window.requestIdleCallback || (f => setTimeout(f, 1500)))(kick, { timeout: 4000 }); }
  return { html, prep, signIn, signOut, pull, flush, _merge: { mergeNotes, mergeState, mergeDel }, state: () => ({ on: ON, loaded: !!fb, failed, user: user && { uid: user.uid, email: user.email }, st, meta: meta() }) };
})();
window.CLOUD = CLOUD;
