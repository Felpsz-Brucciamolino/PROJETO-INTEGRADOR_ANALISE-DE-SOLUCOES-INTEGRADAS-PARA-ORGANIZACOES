const CACHE_NAME = 'gerobras-cache-v1';
const urlsToCache = [
  './',
  './paginas/login.html',
  './paginas/dashboard.html',
  './paginas/obra.html',
  './paginas/tarefas.html',
  './paginas/relatorios.html',
  './paginas/perfil.html',
  './css/style.css',
  './css/dashboard.css',
  './css/login.css',
  './css/tarefas.css',
  './css/relatorios.css',
  './css/perfil.css',
  './js/api.js',
  './js/dashboard.js',
  './js/tarefas.js',
  './js/relatorios.js',
  './js/perfil.js',
  './assets/icon-192x192.png',
  './assets/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.warn('Cache addAll aviso:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes(':5030')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
  );
});
