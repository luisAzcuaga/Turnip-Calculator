// Minimal service worker — required for the PWA install prompt.
// Caches the core assets so the app also works offline.
const CACHE = 'nabos-v1';
// Only list files guaranteed to exist — addAll() fails atomically on any 404.
// Everything else (icons, sub-modules, chart.js) is cached at runtime on first load.
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './favicon.ico',
  './lib/turnip-pattern-predictor.js',
  './lib/ui/controller.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first, falling back to the network (and updating the cache).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
