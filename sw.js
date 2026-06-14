const CACHE_NAME = 'camchat-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/hls.js@latest',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js'
];

// Установка и кэширование
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

// Активация и очистка старого кэша
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

// Стратегия: сначала сеть, при ошибке - кэш
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Firebase и HLS не кэшируем (всегда из сети)
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.pathname.includes('.m3u8') ||
        url.pathname.includes('.ts')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Для статики: сначала сеть, при ошибке - кэш
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Кэшируем успешные ответы
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Если сеть недоступна, пробуем кэш
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Для навигации возвращаем index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Офлайн режим', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Push уведомления (опционально)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'CamChat';
    const options = {
        body: data.body || 'Новое сообщение в чате',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%234c6ef5"/%3E%3Ccircle cx="50" cy="40" r="18" fill="white"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%234c6ef5"/%3E%3C/svg%3E',
        vibrate: [200, 100, 200],
        tag: 'camchat-notification',
        renotify: true
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].focus();
                } else {
                    clients.openWindow('/');
                }
            })
    );
});
