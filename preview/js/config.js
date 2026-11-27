/* إعدادات التسليم — مكان واحد لكل ما يتغير بين نسخة المعاينة ونسخة الجمعية.
   NAME:      اسم التطبيق كما يظهر في الواجهة وصفحتي الخصوصية والشروط. (اسم الشاشة الرئيسية في manifest.json
              وعناوين index.html الثابتة تُحدَّث منه بالأداة tools/apply_app_config.py.)
   BUILD:     'preview' (معاينة) | 'beta' (نسخة تجريبية) | 'handover' (نسخة الجمعية: بلا وسم معاينة/تجريبية وبلا أيقونات التواصل).
   FIREBASE:  إعداد مشروع Firebase للدخول والمزامنة. null = وضع محلي كامل: لا تُحمَّل مكتبة Firebase، ولا دخول ولا مزامنة،
              وكل البيانات على الجهاز فقط. لا يُنشأ أي مشروع من هنا. */
window.APP = (() => {
  const NAME = 'المصحف الذكي';
  let BUILD = 'beta';
  if (BUILD !== 'handover') { try { if (/\/preview\//.test(location.pathname)) BUILD = 'preview'; } catch (e) {} }   // رابط المعاينة يُعلَّم «معاينة» تلقائيًا
  const FIREBASE = {
    apiKey: 'AIzaSyC1LssgYacAtme47-uC0LApEwNeNpD8zYs',
    authDomain: 'english-hub-1d37b.firebaseapp.com',
    projectId: 'english-hub-1d37b',
    storageBucket: 'english-hub-1d37b.firebasestorage.app',
    messagingSenderId: '302403733223',
    appId: '1:302403733223:web:967f34fbaf964196eb0442'
  };
  // للمعاينة والاختبار فقط: ?build=handover أو ?local=1 يجرّبان نسخة الجمعية والوضع المحلي دون تغيير الملف.
  let q = ''; try { q = location.search || ''; } catch (e) {}
  const m = /[?&]build=(preview|beta|handover)\b/.exec(q); if (m) BUILD = m[1];
  const local = /[?&](local|nocloud)\b/.test(q);
  return {
    NAME, BUILD,
    FIREBASE: local ? null : FIREBASE,
    get LOCAL_ONLY() { return !this.FIREBASE; },
    get TAG() { return BUILD === 'preview' ? 'معاينة' : BUILD === 'beta' ? 'نسخة تجريبية' : ''; },
    get SOCIAL() { return BUILD !== 'handover'; }
  };
})();
