// Rasheed register - offline service worker.
// Works together with the page: after ONE visit with internet, the app, its libraries
// (html2canvas, jsPDF, Firebase) and fonts are stored on the phone, so opening the app,
// saving receipts and printing all work with no internet.
const CACHE = 'rasheed-register-v1';
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

function withTimeout(promise, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) The app page itself: try the network briefly (so updates arrive), else use the saved copy.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await withTimeout(fetch(req), 3000);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) ||
               (await cache.match(self.registration.scope, { ignoreSearch: true })) ||
               (await cache.match(self.registration.scope + 'index.html', { ignoreSearch: true })) ||
               Response.error();
      }
    })());
    return;
  }

  // 2) Libraries and fonts: saved copy first (fast + offline), refresh quietly in background.
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { event.waitUntil(refresh); return hit; }
      return (await refresh) || Response.error();
    })());
    return;
  }

  // 3) Other files from this same site (icons etc.): same idea.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { event.waitUntil(refresh); return hit; }
      return (await refresh) || Response.error();
    })());
  }
});
