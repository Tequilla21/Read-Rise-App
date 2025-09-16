// public/sw.js
const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const APP_SHELL = [
  '/',              // SPA entry
  '/index.html',
  '/manifest.json',
  // Icons (add any others you created)
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== RUNTIME_CACHE ? caches.delete(k) : undefined)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin GETs, with SPA fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests
  const isGET = request.method === 'GET';
  const sameOrigin = new URL(request.url).origin === self.location.origin;

  // For navigation requests, try network then fallback to cache -> index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put('/', fresh.clone()); // keep latest shell
          return fresh;
        } catch {
          // offline fallback
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        }
      })()
    );
    return;
  }

  if (isGET && sameOrigin) {
    // cache-first for static assets
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          // Cache hashed Vite assets & static files
          const url = new URL(request.url);
          if (/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|json)$/.test(url.pathname)) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          // Offline and not in cache
          return caches.match('/index.html');
        }
      })()
    );
  }
});
