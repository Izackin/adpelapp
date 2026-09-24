const CACHE_PREFIX = 'adpel-pwa-';
const PRECACHE_NAME = CACHE_PREFIX + 'precache';
const RUNTIME_NAME = CACHE_PREFIX + 'runtime';
const OFFLINE_URL = './offline.html';
const MAX_RUNTIME_ENTRIES = 80;

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  './manifest.json',
  './images/favicon-32.png',
  './images/apple-touch-icon.png',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const retainedCaches = new Set([PRECACHE_NAME, RUNTIME_NAME]);
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && !retainedCaches.has(name))
        .map((name) => caches.delete(name))
    );

    const precache = await caches.open(PRECACHE_NAME);
    const expectedUrls = new Set(
      PRECACHE_ASSETS.map((asset) => new URL(asset, self.location.href).href)
    );
    const precachedRequests = await precache.keys();
    await Promise.all(
      precachedRequests
        .filter((request) => !expectedUrls.has(request.url))
        .map((request) => precache.delete(request))
    );

    await self.clients.claim();
  })());
});

function isSensitiveOrDynamicRequest(url) {
  if (url.origin !== self.location.origin) return true;

  return [
    '/auth/v1/',
    '/rest/v1/',
    '/storage/v1/',
    '/functions/v1/',
    '/realtime/v1/',
    '/api/'
  ].some((segment) => url.pathname.includes(segment));
}

async function putInRuntimeCache(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;

  const cache = await caches.open(RUNTIME_NAME);
  await cache.put(request, response.clone());

  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_ENTRIES) {
    await cache.delete(keys[0]);
  }
}

async function networkFirst(request, options = {}) {
  try {
    const response = await fetch(request, { cache: options.cacheMode || 'no-cache' });
    await putInRuntimeCache(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName: RUNTIME_NAME });
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkResponse = fetch(request, { cache: 'no-cache' })
    .then(async (response) => {
      await putInRuntimeCache(request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkResponse.catch(() => null);
    return cached;
  }

  const response = await networkResponse;
  if (response) return response;
  throw new Error('Recurso indisponível offline.');
}

async function handleNavigation(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch (error) {
    const fallback = await caches.match(OFFLINE_URL, { cacheName: PRECACHE_NAME });
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isSensitiveOrDynamicRequest(url)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// ==========================
// PUSH NOTIFICATIONS
// ==========================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }

  try {
    const title = data.title || 'ADPEL';
    const requestedUrl = new URL(data.url || '/', self.location.origin);
    const targetUrl = requestedUrl.origin === self.location.origin
      ? requestedUrl.href
      : self.location.origin + '/';
    const options = {
      body: data.body || 'Você recebeu uma nova mensagem.',
      icon: data.icon || './images/icon-192.png',
      badge: data.badge || './images/icon-192.png',
      vibrate: [100, 50, 100],
      requireInteraction: true,
      data: { url: targetUrl }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('[SW] Erro no push:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || '/', self.location.origin);
  const urlToOpen = requestedUrl.origin === self.location.origin
    ? requestedUrl.href
    : self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).href === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
