// Pip's Orchard — service worker
// Caches the core site files so the app opens and works offline
// after the first visit (weather/geolocation still need internet).

const CACHE_NAME = 'pips-orchard-v1';
const CORE_FILES = [
  './',
  './index.html',
  './letters.html',
  './tracker.html',
  './clock.html',
  './emotions.html',
  './colors.html',
  './animals.html',
  './days.html',
  './parents.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  // Network-first for external calls (e.g. weather API, Google Fonts) —
  // just let the browser handle those normally, don't intercept.
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if(response && response.status === 200){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
