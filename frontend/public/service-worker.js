const CACHE_NAME = 'legasona-cache-v3';
const STATIC_ASSETS = ['/manifest.json', '/favicon.ico'];

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  // Network-first for HTML and JS — always try fresh, fall back to cache
  if (request.mode === 'navigate' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }
  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then(res => res || fetch(request))
  );
});
