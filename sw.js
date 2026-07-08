const CACHE_VERSION = 'v1.0.4';
const CACHE_NAME = 'adpel-pwa-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './harpa.html',
  './style.css',
  './manifest.json'
];

// Install & Activate Immediately
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;

  // Nunca interceptar Supabase ou outros cross-origin
  if (!url.startsWith(self.location.origin)) {
    return;
  }

  // Nunca cachear JS dinâmico durante desenvolvimento
  if (
    url.endsWith('/admin.js') ||
    url.endsWith('/script.js') ||
    url.endsWith('/data-layer.js') ||
    url.endsWith('/supabase.js')
  ) {
    e.respondWith(fetch(request));
    return;
  }

  // HTML -> network first
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // CSS / manifest / imagens locais -> cache first
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// ==========================
// PUSH NOTIFICATIONS
// ==========================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  try {
    const title = data.title || 'ADPEL Digital';
    const targetUrl = new URL(data.url || '/', self.location.origin).href;
    const options = {
      body: data.body || 'Você recebeu uma nova mensagem.',
      icon: data.icon || './images/adpel.logo.png',
      badge: data.badge || './images/adpel.logo.png',
      vibrate: [100, 50, 100],
      requireInteraction: true,
      data: { url: targetUrl }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[SW] Erro no push:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).href === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
