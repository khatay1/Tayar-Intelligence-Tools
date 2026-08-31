// Service Worker for Tayar Intelligence Tools PWA
const CACHE_NAME = 'tayar-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/offline.html'];
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept the Vite development server. A previously registered
  // production worker can otherwise break HMR/module requests on localhost.
  if (LOCAL_DEV_HOSTS.has(url.hostname)) return;

  // Skip non-GET and cross-origin requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Published customer sites and previews must always reflect the real network
  // state. Caching them here can resurrect an unpublished or stale website.
  if (
    url.pathname.startsWith('/site/') ||
    url.pathname.startsWith('/preview/') ||
    url.pathname.startsWith('/api/published-site')
  ) return;

  // Network-first for HTML, cache-first for static assets.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
        }
        return response;
      } catch {
        // Avoid uncaught fetch promise errors for transient/blocked static requests.
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })
  );
});
