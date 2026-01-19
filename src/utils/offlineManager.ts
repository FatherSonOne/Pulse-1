/**
 * Offline Manager
 * Handle offline support, caching, and sync for PWA
 */

// ============================================
// OFFLINE STATUS
// ============================================

type OfflineStatusCallback = (isOnline: boolean) => void;
const statusCallbacks: Set<OfflineStatusCallback> = new Set();

/**
 * Get current online status
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Subscribe to online/offline status changes
 */
export function onOnlineStatusChange(callback: OfflineStatusCallback): () => void {
  statusCallbacks.add(callback);

  const handleOnline = () => {
    statusCallbacks.forEach(cb => cb(true));
  };

  const handleOffline = () => {
    statusCallbacks.forEach(cb => cb(false));
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    statusCallbacks.delete(callback);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================
// OFFLINE QUEUE
// ============================================

interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = 'pulse_offline_queue';
const MAX_RETRIES = 3;

/**
 * Get queued actions from localStorage
 */
function getQueue(): QueuedAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineManager] Failed to save queue:', e);
  }
}

/**
 * Add action to offline queue
 */
export function queueOfflineAction(type: string, payload: any): string {
  const queue = getQueue();
  const action: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  queue.push(action);
  saveQueue(queue);

  console.log('[OfflineManager] Action queued:', type);
  return action.id;
}

/**
 * Remove action from queue
 */
export function removeFromQueue(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter(a => a.id !== id);
  saveQueue(filtered);
}

/**
 * Get pending actions count
 */
export function getPendingActionsCount(): number {
  return getQueue().length;
}

/**
 * Process offline queue when back online
 */
export async function processOfflineQueue(
  handlers: Record<string, (payload: any) => Promise<void>>
): Promise<{ success: number; failed: number }> {
  const queue = getQueue();
  let success = 0;
  let failed = 0;

  for (const action of queue) {
    const handler = handlers[action.type];

    if (!handler) {
      console.warn(`[OfflineManager] No handler for action type: ${action.type}`);
      removeFromQueue(action.id);
      failed++;
      continue;
    }

    try {
      await handler(action.payload);
      removeFromQueue(action.id);
      success++;
      console.log(`[OfflineManager] Action processed: ${action.type}`);
    } catch (e) {
      console.error(`[OfflineManager] Action failed: ${action.type}`, e);

      // Update retry count
      const currentQueue = getQueue();
      const actionIndex = currentQueue.findIndex(a => a.id === action.id);

      if (actionIndex !== -1) {
        currentQueue[actionIndex].retries++;

        if (currentQueue[actionIndex].retries >= MAX_RETRIES) {
          currentQueue.splice(actionIndex, 1);
          failed++;
        }

        saveQueue(currentQueue);
      }
    }
  }

  return { success, failed };
}

// ============================================
// OFFLINE CACHE
// ============================================

const CACHE_PREFIX = 'pulse_offline_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache data for offline use
 */
export function cacheData<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
  } catch (e) {
    console.warn('[OfflineManager] Failed to cache data:', e);
  }
}

/**
 * Get cached data
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!stored) return null;

    const cached: CachedData<T> = JSON.parse(stored);
    const isExpired = Date.now() - cached.timestamp > cached.ttl;

    if (isExpired) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Clear cached data
 */
export function clearCachedData(key: string): void {
  localStorage.removeItem(`${CACHE_PREFIX}${key}`);
}

/**
 * Clear all offline cache
 */
export function clearAllCache(): void {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

// ============================================
// INDEXEDDB STORAGE (for larger data)
// ============================================

const DB_NAME = 'pulse_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_data';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Store large data in IndexedDB
 */
export async function storeInDB<T>(key: string, data: T): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, data, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to store data'));
  });
}

/**
 * Retrieve large data from IndexedDB
 */
export async function getFromDB<T>(key: string): Promise<T | null> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.data ?? null);
    };

    request.onerror = () => reject(new Error('Failed to retrieve data'));
  });
}

/**
 * Delete data from IndexedDB
 */
export async function deleteFromDB(key: string): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete data'));
  });
}

// ============================================
// SERVICE WORKER UTILITIES
// ============================================

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.length > 0;
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.update();
  }
}

/**
 * Clear service worker caches
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// ============================================
// BACKGROUND SYNC
// ============================================

/**
 * Register for background sync
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;

  if ('sync' in registration) {
    await (registration as any).sync.register(tag);
    console.log('[OfflineManager] Background sync registered:', tag);
  }
}

// ============================================
// OFFLINE INDICATOR COMPONENT HELPER
// ============================================

/**
 * Create offline status hook for React
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline());

  if (typeof window !== 'undefined') {
    // Using a function to avoid useEffect in this util file
    // This should be used in a React component
    const effect = () => {
      const handleOnline = () => setOnline(true);
      const handleOffline = () => setOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    };

    // Note: This is a simplified version - in actual use,
    // wrap in useEffect in the component
    effect();
  }

  return online;
}

// ============================================
// SYNC STATUS
// ============================================

export interface SyncStatus {
  lastSyncAt: Date | null;
  pendingActions: number;
  isSyncing: boolean;
}

let syncStatus: SyncStatus = {
  lastSyncAt: null,
  pendingActions: 0,
  isSyncing: false,
};

const syncStatusCallbacks: Set<(status: SyncStatus) => void> = new Set();

/**
 * Get sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus, pendingActions: getPendingActionsCount() };
}

/**
 * Update sync status
 */
export function updateSyncStatus(update: Partial<SyncStatus>): void {
  syncStatus = { ...syncStatus, ...update };
  syncStatusCallbacks.forEach(cb => cb(getSyncStatus()));
}

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
  syncStatusCallbacks.add(callback);
  return () => syncStatusCallbacks.delete(callback);
}
