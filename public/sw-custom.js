// Enhanced Service Worker for Budget Planner
// Provides offline-first functionality, background sync, and smart caching

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `budget-planner-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `budget-planner-dynamic-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// Define what to cache
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico',
  '/pdf.worker.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API routes with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Handle navigation requests with network-first, fallback to offline page
  if (request.mode === 'navigate') {
    event.respondWith(navigateStrategy(request));
    return;
  }

  // Default: try network first, then cache
  event.respondWith(networkFirstStrategy(request));
});

// Background sync for offline transactions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'offline-transactions') {
    event.waitUntil(syncOfflineTransactions());
  }
  
  if (event.tag === 'offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'QUEUE_TRANSACTION':
      queueOfflineTransaction(payload);
      break;
    case 'CHECK_CONNECTIVITY':
      checkConnectivity().then((isOnline) => {
        event.ports[0].postMessage({ type: 'CONNECTIVITY_STATUS', isOnline });
      });
      break;
    case 'FORCE_SYNC':
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        self.registration.sync.register('offline-transactions');
      }
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Caching strategies
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Cache hit:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Offline', offline: true }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function navigateStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, serving offline page');
    const cache = await caches.open(STATIC_CACHE);
    return cache.match(OFFLINE_PAGE) || cache.match('/');
  }
}

// Utility functions
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname.startsWith('/_next/static/') ||
         pathname.startsWith('/static/');
}

// Offline transaction management
async function queueOfflineTransaction(transaction) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    
    await store.add({
      ...transaction,
      timestamp: Date.now(),
      synced: false
    });
    
    console.log('[SW] Transaction queued for offline sync');
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      syncOfflineTransactions();
    }
  } catch (error) {
    console.error('[SW] Failed to queue transaction:', error);
  }
}

async function syncOfflineTransactions() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    const index = store.index('synced');
    
    const unsyncedTransactions = await index.getAll(false);
    
    for (const transaction of unsyncedTransactions) {
      try {
        // Send transaction to main thread for processing
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_TRANSACTION',
            transaction
          });
        });
        
        // Mark as synced
        transaction.synced = true;
        await store.put(transaction);
        
        console.log('[SW] Transaction synced:', transaction.id);
      } catch (error) {
        console.error('[SW] Failed to sync transaction:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

async function syncOfflineData() {
  try {
    // Notify main thread to sync all pending data
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ALL_DATA'
      });
    });
  } catch (error) {
    console.error('[SW] Data sync failed:', error);
  }
}

async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('budget-planner-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

async function checkConnectivity() {
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Global error handler
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service worker loaded successfully');