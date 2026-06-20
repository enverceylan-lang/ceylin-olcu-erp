// ─── Cache Version — bump this string on every deployment to force cache refresh ───
const CACHE_VERSION = 'v2';
const CACHE_NAME = `olcu-erp-shell-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `olcu-erp-static-${CACHE_VERSION}`;
const PAGES_CACHE_NAME = `olcu-erp-pages-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event — pre-cache static shell assets and immediately activate
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Installing version ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      // Use individual adds so one missing asset doesn't abort the whole install
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)));
    })
  );
  // Skip the waiting phase immediately so the new SW takes over without
  // requiring the user to close all tabs. This ensures phones always run
  // the latest code after a deployment.
  self.skipWaiting();
});

// Activate Event — purge all caches from previous versions and claim all clients
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activating version ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete any cache that is not from this version
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== STATIC_CACHE_NAME &&
            cacheName !== PAGES_CACHE_NAME
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming all clients immediately.');
      // Take control of all open pages immediately without waiting for reload
      return self.clients.claim();
    })
  );
});

// Helper to check if a URL should bypass the cache entirely
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

  // Never cache API calls — always fetch live from network
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

  // ── Strategy: Network-First for Next.js static chunks ──
  // Changed from Cache-First to Network-First so updated JS/CSS always loads
  // after a deployment. Falls back to cache only when offline.
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
          // Network failed — fall back to cache for offline support
          return caches.match(request);
        })
    );
    return;
  }

  // ── Strategy: Network-First for HTML pages/documents ──
  // Users always get fresh pages when online; cached fallback when offline.
  if (
    request.mode === 'navigate' ||
    urlObj.pathname === '/' ||
    urlObj.pathname.startsWith('/cariler') ||
    urlObj.pathname.startsWith('/olculer')
  ) {
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
          // Fallback to cache when offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If the specific page is not cached, fall back to root '/'
            return caches.match('/');
          });
        })
    );
    return;
  }

  // ── Default: Network-First falling back to Cache ──
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

// Listen for messages from the client (e.g., manual SKIP_WAITING trigger from update banner)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
