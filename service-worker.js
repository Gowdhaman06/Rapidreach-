/**
 * RapidReach Service Worker
 * Enables offline functionality and caching
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `rapidreach-${CACHE_VERSION}`;

// Assets to cache on install
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/config/firebase-config.js',
    '/js/auth.js',
    '/js/gps-tracker.js',
    '/js/notifications.js',
    '/js/route-protection.js',
    '/pages/login-new.html',
    '/pages/driver-dashboard-new.html',
    '/pages/public-dashboard-new.html',
    '/pages/hospital-dashboard-new.html',
    '/pages/admin-dashboard-new.html',
    '/manifest.json',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js',
    'https://unpkg.com/leaflet/dist/leaflet.css',
    'https://unpkg.com/leaflet/dist/leaflet.js'
];

/**
 * Install Event - Cache assets
 */
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`📦 Caching ${ASSETS_TO_CACHE.length} assets`);
                
                // Cache each asset individually to handle failures gracefully
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`⚠️ Failed to cache: ${url}`, err);
                        });
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker installation failed:', error);
            })
    );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log(`🗑️ Deleting old cache: ${cacheName}`);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('❌ Service Worker activation failed:', error);
            })
    );
});

/**
 * Fetch Event - Serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome extensions
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Serve from cache if available
                if (response) {
                    console.log(`📦 Served from cache: ${event.request.url}`);
                    return response;
                }

                // Fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache if not a successful response
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clone the response to cache it
                        const responseToCache = response.clone();

                        // Cache successful responses
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                                console.log(`💾 Cached: ${event.request.url}`);
                            })
                            .catch((err) => {
                                console.warn(`⚠️ Failed to cache ${event.request.url}:`, err);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.warn(`❌ Fetch failed for ${event.request.url}:`, error);

                        // Serve offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }

                        // Return a basic offline response
                        return new Response(
                            'Offline - content not available',
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: new Headers({
                                    'Content-Type': 'text/plain'
                                })
                            }
                        );
                    });
            })
            .catch((error) => {
                console.error('❌ Cache match failed:', error);
                return new Response('Error loading resource', {
                    status: 500,
                    statusText: 'Internal Server Error'
                });
            })
    );
});

/**
 * Background Sync - Sync GPS data when offline
 */
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync triggered:', event.tag);

    if (event.tag === 'sync-locations') {
        event.waitUntil(
            syncLocationData()
                .then(() => console.log('✅ Location sync completed'))
                .catch((error) => console.error('❌ Location sync failed:', error))
        );
    }
});

/**
 * Push Notification Event
 */
self.addEventListener('push', (event) => {
    console.log('📬 Push notification received:', event);

    let notificationData = {
        title: 'RapidReach',
        body: 'Notification received',
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png'
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                ...data
            };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag || 'rapidreach-notification',
            requireInteraction: notificationData.requireInteraction || false,
            data: notificationData.data || {},
            actions: [
                {
                    action: 'open',
                    title: 'Open'
                },
                {
                    action: 'close',
                    title: 'Close'
                }
            ]
        })
    );
});

/**
 * Notification Click Event
 */
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const notificationData = event.notification.data;
    let targetUrl = '/';

    // Determine target URL based on notification data
    if (notificationData && notificationData.type === 'emergency') {
        targetUrl = '/pages/public-dashboard-new.html';
    } else if (notificationData && notificationData.type === 'incoming-ambulance') {
        targetUrl = '/pages/hospital-dashboard-new.html';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if app is already open
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === targetUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // App not open, open it
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});

/**
 * Message Event - Communication with app
 */
self.addEventListener('message', (event) => {
    console.log('💬 Message received from app:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_LOCATIONS') {
        event.waitUntil(
            cacheLocationData(event.data.locations)
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                })
                .catch((error) => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                })
        );
    }
});

/**
 * Helper: Sync location data when online
 */
async function syncLocationData() {
    // Implement location sync logic here
    // This would sync cached locations to Firebase when online
    return Promise.resolve();
}

/**
 * Helper: Cache location data for offline use
 */
async function cacheLocationData(locations) {
    const cache = await caches.open(`${CACHE_NAME}-locations`);
    const locationString = JSON.stringify(locations);
    const response = new Response(locationString);
    await cache.put('/cached-locations', response);
    return Promise.resolve();
}

/**
 * Periodic Background Sync (optional, needs browser support)
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-emergencies') {
        event.waitUntil(
            syncEmergencies()
                .then(() => console.log('✅ Emergency sync completed'))
                .catch((error) => console.error('❌ Emergency sync failed:', error))
        );
    }
});

/**
 * Helper: Sync emergency data
 */
async function syncEmergencies() {
    // Implement emergency sync logic
    return Promise.resolve();
}

console.log('✅ Service Worker script loaded');
