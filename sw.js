// Rasheed Register — offline service worker
// Strategy: for every GET request, try the network first (so users always get
// the latest version when online); if the network fails (no signal), fall
// back to whatever was cached from a previous successful visit. Every
// successful network response is also saved to the cache, so the app keeps
// working fully offline — including opening it from scratch — from then on.

const CACHE_NAME = 'rasheed-register-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(event.request);
        // Only cache well-formed responses (opaque cross-origin responses
        // are fine too — we just can't inspect their status).
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        // Last resort for a page navigation while offline with nothing
        // cached yet at all: try to serve any cached HTML document we have.
        if (event.request.mode === 'navigate') {
          const keys = await cache.keys();
          const anyHtml = keys.find((k) => k.url.endsWith('.html') || k.url === self.registration.scope);
          if (anyHtml) {
            const fallback = await cache.match(anyHtml);
            if (fallback) return fallback;
          }
        }
        throw err;
      }
    })()
  );
});
