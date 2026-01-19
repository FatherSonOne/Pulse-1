/**
 * Pulse Service Worker
 * Handles offline caching, asset management, and background sync
 */

// Service Worker version
const SW_VERSION = '2.0.0';
const CACHE_PREFIX = 'pulse-cache';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/manifest.json',
];

// API routes to cache
const CACHEABLE_API_ROUTES = [
  '/rest/v1/knowledge_docs',
  '/rest/v1/ai_projects',
  '/rest/v1/ai_sessions',
];

// Cache expiration (24 hours for API, 7 days for assets)
const API_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const STATIC_CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Pulse Service Worker v' + SW_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install error:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Pulse Service Worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith(CACHE_PREFIX) &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH EVENT
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network First with cache fallback
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE, API_CACHE_EXPIRY));
    return;
  }

  // Static assets - Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Navigation requests - Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE, STATIC_CACHE_EXPIRY));
    return;
  }

  // Other requests - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Cache First - Try cache, fallback to network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First - Try network, fallback to cache
 */
async function networkFirstStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-fetched-on', Date.now().toString());

      const response = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      cache.put(request, response);
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Check if cache is expired
      const fetchedOn = cachedResponse.headers.get('sw-fetched-on');
      if (fetchedOn && maxAge) {
        const age = Date.now() - parseInt(fetchedOn, 10);
        if (age > maxAge) {
          console.log('[SW] Cache expired:', request.url);
        }
      }
      return cachedResponse;
    }

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale While Revalidate - Return cache immediately, update in background
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed, return cached or error
      return cachedResponse || new Response('Offline', { status: 503 });
    });

  return cachedResponse || fetchPromise;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if request is an API request
 */
function isApiRequest(url) {
  return CACHEABLE_API_ROUTES.some((route) => url.pathname.includes(route)) ||
    url.hostname.includes('supabase');
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

// ============================================
// BACKGROUND SYNC
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'pulse-sync-queue') {
    event.waitUntil(processSyncQueue());
  }

  if (event.tag === 'pulse-sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

/**
 * Process offline action queue
 */
async function processSyncQueue() {
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_QUEUE',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[SW] Sync queue error:', error);
  }
}

/**
 * Sync documents when back online
 */
async function syncDocuments() {
  try {
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_DOCUMENTS',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error('[SW] Document sync error:', error);
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX))
            .map((name) => caches.delete(name))
        );
      })
    );
  }

  if (event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(urls);
      })
    );
  }

  if (event.data.type === 'PREFETCH_DOCUMENT') {
    const docId = event.data.docId;
    event.waitUntil(prefetchDocument(docId));
  }
});

/**
 * Prefetch a document for offline access
 */
async function prefetchDocument(docId) {
  try {
    const cache = await caches.open(API_CACHE);
    // This would be implemented based on your API structure
    console.log('[SW] Prefetching document:', docId);
  } catch (error) {
    console.error('[SW] Prefetch error:', error);
  }
}

// ============================================
// PERIODIC SYNC (if supported)
// ============================================

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'pulse-periodic-sync') {
    event.waitUntil(performPeriodicSync());
  }
});

async function performPeriodicSync() {
  try {
    // Refresh critical cached data
    const cache = await caches.open(API_CACHE);

    // Clear expired entries
    const requests = await cache.keys();
    const now = Date.now();

    for (const request of requests) {
      const response = await cache.match(request);
      const fetchedOn = response?.headers.get('sw-fetched-on');

      if (fetchedOn && now - parseInt(fetchedOn, 10) > API_CACHE_EXPIRY) {
        await cache.delete(request);
      }
    }

    console.log('[SW] Periodic sync complete');
  } catch (error) {
    console.error('[SW] Periodic sync error:', error);
  }
}

console.log('[SW] Pulse Service Worker loaded v' + SW_VERSION);
