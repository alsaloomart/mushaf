/* Service worker — المصحف الذكي
 * - واجهة التطبيق وبيانات مواضع الآيات: تُخزن للعمل بدون إنترنت.
 * - صور صفحات المصحف (ملفات المجمع الرسمية، مسموح استخدامها في البرامج والمواقع): تُخزن دائمًا بعد أول فتح.
 * - خرائط التلاوات من Quran Foundation: 7 أيام كحد أقصى (التزامًا بشروطهم).
 * - ملفات التلاوة: بث مباشر، إلا السور التي يحمّلها المستخدم بطلبه للاستماع بدون إنترنت
 *   (كاش mushaf-preview-audio-<القارئ>، لا يُحذف عند تحديث الإصدار، ويُحذف متى حذفها المستخدم).
 */
const SHELL = 'mushaf-preview-shell-v26z14';
const V = '26z14';   // يطابق ?v= في index.html
const TAFSIR = 'mushaf-preview-tafsir-v1';
const PAGES = 'mushaf-preview-pages-v2';
const DATA = 'mushaf-preview-data-v3';
const MAX_AGE = 7 * 24 * 3600 * 1000;
const ASSETS = ['./', 'index.html', 'privacy.html', 'terms.html', ...['css/app.css', 'js/config.js', 'js/esc.js', 'js/quran-data.js', 'js/audio.js', 'js/store.js', 'js/tmatch.js', 'js/app.js', 'js/cloud.js', 'css/adhkar.css', 'js/adhkar.js'].map(f => f + '?v=' + V), 'manifest.json',
  'data/ayah-map.json', 'data/meta.json', 'data/crop.json', 'data/lines.json', 'data/tmk.json', 'data/wl.json', 'data/timings/1102.json', 'data/timings/1254.json', 'data/timings/1133w.json', 'data/quran-simple-clean.txt', 'data/adhkar.json', 'js/adhan.js', 'fonts/UthmanicHafs_V22.ttf',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/thmanyah-sans-Regular.woff2', 'fonts/thmanyah-sans-Bold.woff2', 'fonts/thmanyah-sans-Light.woff2', 'fonts/thmanyah-sans-Medium.woff2', 'fonts/thmanyah-serif-display-Bold.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* نمس فقط كاشات المعاينة — لا نحذف كاش النسخة الحيّة أبدًا */
    const keep = [SHELL, PAGES, DATA, TAFSIR];
    for (const k of await caches.keys()) {
      if (!k.startsWith('mushaf-preview-') || k.startsWith(AUDIO)) continue;   // التحميلات تبقى
      if (!keep.includes(k)) await caches.delete(k);
    }
    await purge();
    await self.clients.claim();
  })());
});
async function purge() {
  const c = await caches.open(DATA);
  for (const req of await c.keys()) {
    const r = await c.match(req);
    if (Date.now() - (+(r && r.headers.get('x-sw-time')) || 0) > MAX_AGE) await c.delete(req);
  }
}
async function stamp(res) {
  const h = new Headers(res.headers); h.set('x-sw-time', String(Date.now()));
  return new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers: h });
}
/* السور المحمّلة: تُقدَّم من التخزين أولًا، مع دعم طلبات المقاطع (Range) التي يحتاجها مشغّل Safari */
const AUDIO = 'mushaf-preview-audio-';
let DLSET = new Set();
async function loadSet() {
  const s = new Set();
  for (const k of await caches.keys()) {
    if (!k.startsWith(AUDIO)) continue;
    for (const r of await (await caches.open(k)).keys()) if (/\.mp3(\?|$)/.test(r.url)) s.add(r.url);
  }
  DLSET = s;
}
const setReady = loadSet().catch(() => {});
self.addEventListener('message', e => { if (e.data && e.data.type === 'dl-changed') e.waitUntil(loadSet().catch(() => {})); });
async function audioHit(req) {
  let r = null;
  for (const k of await caches.keys()) { if (!k.startsWith(AUDIO)) continue; r = await (await caches.open(k)).match(req.url); if (r) break; }
  if (!r) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return r;
  const b = await r.blob(), n = b.size, m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let a = m[1] ? +m[1] : 0, z = m[2] ? +m[2] : n - 1;
  if (!m[1] && m[2]) { a = Math.max(0, n - +m[2]); z = n - 1; }
  z = Math.min(z, n - 1);
  if (a > z) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${n}` } });
  return new Response(b.slice(a, z + 1), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': `bytes ${a}-${z}/${n}`, 'Content-Length': String(z - a + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (DLSET.has(req.url)) { e.respondWith(audioHit(req)); return; }
  if (u.origin === location.origin && u.pathname.includes('/tafsir/')) {
    // التفسير: يُحمَّل لكل سورة عند أول فتح ثم يبقى بدون إنترنت
    e.respondWith((async () => {
      const c = await caches.open(TAFSIR);
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req.url, r.clone());
      return r;
    })());
    return;
  }
  if (u.origin === location.origin && (u.pathname.includes('/pages/') || u.pathname.includes('/lines/') || u.pathname.includes('/phdr/') || u.pathname.includes('/pnum/'))) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req.url, r.clone());
      return r;
    })());
    return;
  }
  if (u.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      // الشبكة أولًا (التحديثات تظهر مباشرة)، والنسخة المخزنة بدون إنترنت
      // مع مهلة: إن كانت الشبكة ضعيفة جدًا تُعرض النسخة المخزنة بعد 4 ثوانٍ بدل الانتظار الطويل
      // no-cache: يتحقق من الخادم دائمًا (لا يأخذ نسخة قديمة من كاش المتصفح)
      const netP = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      // الملفات تحمل رقم الإصدار (?v=): لا نعرض ملفًا من إصدار آخر بسبب المهلة، فلا تختلط ملفات قديمة بجديدة
      const nav = req.mode === 'navigate';
      const cached = await c.match(req, { ignoreSearch: nav });
      if (!cached) return (await netP) || (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')) || Response.error();
      return (await Promise.race([netP, new Promise(r => setTimeout(() => r(null), 4000))])) || cached;
    })());
    return;
  }
  if (u.hostname === 'api.quran.com') {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      const hit = await c.match(req);
      if (hit) {
        if (Date.now() - (+hit.headers.get('x-sw-time') || 0) <= MAX_AGE) return hit;
        await c.delete(req);
      }
      const r = await fetch(req);
      if (r.ok) c.put(req, await stamp(r));
      return r;
    })());
  }
});

/* تذكير الورد: يصل عبر Web Push من خادم الإرسال؛ الضغط يفتح ورد اليوم */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ورد اليوم', {
    body: d.body || 'حان وقت وردك. اضغط لفتح ورد اليوم.', tag: 'wird', renotify: true,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './?wird=1' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find(w => new URL(w.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    if (c) { await c.focus(); c.postMessage({ type: 'wird' }); return; }
    await self.clients.openWindow(new URL('./?wird=1', self.registration.scope).href);
  })());
});
