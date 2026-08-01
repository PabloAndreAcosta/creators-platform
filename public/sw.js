const CACHE_NAME = 'usha-v6';

const STATIC_ASSETS = [
  '/',
  '/app',
  '/offline',
];

// Install: cache static assets (best-effort, don't block on failures)
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.log('[SW] Cache skip:', url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Skip all Next.js internal requests — dev chunks lack content hashes,
  // so cache-first causes stale JS to be served after code changes → hydration errors
  if (url.pathname.startsWith('/_next/')) return;

  // Only cache complete, successful responses (skip 206, opaque, errors)
  function safeCachePut(cache, req, response) {
    if (response.status === 200 && response.type !== 'opaque') {
      cache.put(req, response);
    }
  }

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (images, fonts): cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, clone));
            return response;
          })
      )
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, clone));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline'))
      )
  );
});

// Web Push: show a notification when the server pushes an update (new ticket
// sale, cancellation, sold out, waitlist join, message, etc.).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Usha Platform', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Usha Platform';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/app/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a push opens (or focuses) the linked page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        // Focus an existing tab and navigate it to the target.
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
