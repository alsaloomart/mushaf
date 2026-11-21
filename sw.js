/* Service worker — مصحف الحفظ
 * - واجهة التطبيق وبيانات مواضع الآيات: تُخزن للعمل بدون إنترنت.
 * - صور صفحات المصحف (ملفات المجمع الرسمية، مسموح استخدامها في البرامج والمواقع): تُخزن دائمًا بعد أول فتح.
 * - خرائط التلاوات من Quran Foundation: 7 أيام كحد أقصى (التزامًا بشروطهم).
 * - ملفات التلاوة نفسها: بث مباشر فقط، لا تُخزن.
 */
const SHELL = 'mushaf-shell-v11';
const PAGES = 'mushaf-pages-v2';
const DATA = 'mushaf-data-v1';
const MAX_AGE = 7 * 24 * 3600 * 1000;
const ASSETS = ['./', 'index.html', 'privacy.html', 'terms.html', 'css/app.css', 'js/quran-data.js', 'js/audio.js', 'js/store.js', 'js/app.js', 'manifest.json',
  'data/ayah-map.json', 'data/meta.json', 'data/crop.json', 'data/lines.json', 'data/quran-simple-clean.txt',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/thmanyah-sans-Regular.woff2', 'fonts/thmanyah-sans-Bold.woff2', 'fonts/thmanyah-serif-display-Bold.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![SHELL, PAGES, DATA].includes(k)) await caches.delete(k);
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
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin && (u.pathname.includes('/pages/') || u.pathname.includes('/lines/'))) {
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
      const net = await fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      return net || (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html'));
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
