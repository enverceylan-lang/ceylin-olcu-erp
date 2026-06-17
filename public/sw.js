const CACHE_NAME = 'olcu-erp-shell-v1';
const STATIC_CACHE_NAME = 'olcu-erp-static-v1';
const PAGES_CACHE_NAME = 'olcu-erp-pages-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force the waiting service worker to become the active service worker
  // but we only want to skip waiting if the user explicitly triggers it via postMessage.
  // So we do not call self.skipWaiting() here directly.
});

// Activate Event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (
            cache !== CACHE_NAME &&
            cache !== STATIC_CACHE_NAME &&
            cache !== PAGES_CACHE_NAME
          ) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper to check if a URL should not be cached
function shouldBypassCache(url, method) {
  if (method !== 'GET') return true;
  
  const urlObj = new URL(url);
  
  // Do not cache blob URLs
  if (urlObj.protocol === 'blob:') return true;
  
  // Do not cache WhatsApp URLs
  if (urlObj.hostname.includes('whatsapp.com') || urlObj.hostname.includes('wa.me')) {
    return true;
  }
  
  // Do not cache Google Maps URLs or API
  if (
    urlObj.hostname.includes('google.com') || 
    urlObj.hostname.includes('googleapis.com') || 
    urlObj.pathname.includes('/maps')
  ) {
    return true;
  }
  
  // Do not cache Next.js dev HMR / hot-reload socket and JSON updates
  if (
    urlObj.pathname.includes('/_next/webpack-hmr') ||
    urlObj.pathname.includes('webpack') ||
    urlObj.pathname.endsWith('.hot-update.json') ||
    urlObj.pathname.endsWith('.hot-update.js')
  ) {
    return true;
  }

  // Do not cache Prisma api mutations or user session api endpoints
  if (urlObj.pathname.startsWith('/api/')) {
    return true;
  }

  return false;
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (shouldBypassCache(url, request.method)) {
    return; // Let browser fetch naturally from network
  }

  const urlObj = new URL(url);

  // Strategy for Static Assets (CSS, JS, Fonts, Images)
  if (
    urlObj.pathname.startsWith('/_next/static/') ||
    urlObj.pathname.startsWith('/icons/') ||
    urlObj.pathname.includes('apple-touch-icon') ||
    urlObj.pathname.endsWith('.svg') ||
    urlObj.pathname.endsWith('.png') ||
    urlObj.pathname.endsWith('.jpg') ||
    urlObj.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // If both fail, return nothing or a placeholder
        });
      })
    );
    return;
  }

  // Strategy for HTML pages/documents
  // Use Network-First strategy so users get updated pages when online,
  // but fallback to cache when offline.
  if (request.mode === 'navigate' || urlObj.pathname === '/' || urlObj.pathname.startsWith('/cariler') || urlObj.pathname.startsWith('/olculer')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(PAGES_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If the specific page is not in cache, fallback to the root '/'
            return caches.match('/');
          });
        })
    );
    return;
  }

  // Default caching strategy: Network-First falling back to Cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Listen for messages from client (e.g. SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
