const CACHE_NAME = 'camchat-v1.0.0';
const urlsToCache = [
    '/cameri.github.io/',
    '/cameri.github.io/index.html',
    '/cameri.github.io/manifest.json',
    'https://cdn.jsdelivr.net/npm/hls.js@latest',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js'
];

self.addEventListener('install', event => {
    console.log('[SW] Установка');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Кэширование ресурсов');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('[SW] Ошибка кэширования:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[SW] Активация');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.pathname.includes('.m3u8') ||
        url.pathname.includes('.ts')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) return cachedResponse;
                        if (event.request.mode === 'navigate') {
                            return caches.match('/cameri.github.io/index.html');
                        }
                        return new Response('Офлайн режим', { status: 503 });
                    });
            })
    );
});
