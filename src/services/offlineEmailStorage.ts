// Offline Email Storage - IndexedDB-based local cache for offline access
import { CachedEmail, EmailFolder } from './emailSyncService';

const DB_NAME = 'pulse-email-cache';
const DB_VERSION = 1;
const EMAILS_STORE = 'emails';
const METADATA_STORE = 'metadata';
const PENDING_ACTIONS_STORE = 'pending-actions';

interface PendingAction {
  id: string;
  type: 'markRead' | 'markUnread' | 'star' | 'unstar' | 'archive' | 'trash' | 'delete';
  emailId: string;
  gmailId: string;
  timestamp: number;
}

interface SyncMetadata {
  key: string;
  value: any;
}

class OfflineEmailStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Emails store with indexes
        if (!db.objectStoreNames.contains(EMAILS_STORE)) {
          const emailStore = db.createObjectStore(EMAILS_STORE, { keyPath: 'id' });
          emailStore.createIndex('folder', 'folder', { unique: false });
          emailStore.createIndex('received_at', 'received_at', { unique: false });
          emailStore.createIndex('thread_id', 'thread_id', { unique: false });
          emailStore.createIndex('is_read', 'is_read', { unique: false });
          emailStore.createIndex('is_starred', 'is_starred', { unique: false });
          emailStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // Metadata store for sync state
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        }

        // Pending actions for sync when back online
        if (!db.objectStoreNames.contains(PENDING_ACTIONS_STORE)) {
          const actionsStore = db.createObjectStore(PENDING_ACTIONS_STORE, { keyPath: 'id' });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Store emails in IndexedDB
   */
  async storeEmails(emails: CachedEmail[]): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      for (const email of emails) {
        // Add computed folder field for indexing
        const emailWithFolder = {
          ...email,
          folder: this.computeFolder(email)
        };
        store.put(emailWithFolder);
      }
    });
  }

  /**
   * Get emails from IndexedDB by folder
   */
  async getEmailsByFolder(
    folder: EmailFolder,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CachedEmail[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      const emails: CachedEmail[] = [];
      let count = 0;
      let skipped = 0;

      // Use cursor to iterate through emails
      const request = store.index('received_at').openCursor(null, 'prev');

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor || count >= limit) {
          resolve(emails);
          return;
        }

        const email = cursor.value as CachedEmail & { folder: EmailFolder };

        // Filter by user and folder
        if (email.user_id === userId && this.matchesFolder(email, folder)) {
          if (skipped >= offset) {
            emails.push(email);
            count++;
          } else {
            skipped++;
          }
        }

        cursor.continue();
      };
    });
  }

  /**
   * Get a single email by ID
   */
  async getEmail(emailId: string): Promise<CachedEmail | null> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      const request = store.get(emailId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Update email in IndexedDB
   */
  async updateEmail(emailId: string, updates: Partial<CachedEmail>): Promise<void> {
    const db = await this.initDB();

    return new Promise(async (resolve, reject) => {
      const email = await this.getEmail(emailId);
      if (!email) {
        reject(new Error('Email not found'));
        return;
      }

      const transaction = db.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);

      const updatedEmail = {
        ...email,
        ...updates,
        folder: this.computeFolder({ ...email, ...updates }),
        updated_at: new Date().toISOString()
      };

      const request = store.put(updatedEmail);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Delete email from IndexedDB
   */
  async deleteEmail(emailId: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);
      const request = store.delete(emailId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Search emails in IndexedDB
   */
  async searchEmails(query: string, userId: string, limit: number = 50): Promise<CachedEmail[]> {
    const db = await this.initDB();
    const queryLower = query.toLowerCase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      const emails: CachedEmail[] = [];

      const request = store.openCursor();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor || emails.length >= limit) {
          resolve(emails);
          return;
        }

        const email = cursor.value as CachedEmail;

        // Filter by user and search query
        if (email.user_id === userId) {
          const matchesSubject = email.subject?.toLowerCase().includes(queryLower);
          const matchesBody = email.body_text?.toLowerCase().includes(queryLower);
          const matchesSender = email.from_email?.toLowerCase().includes(queryLower) ||
                               email.from_name?.toLowerCase().includes(queryLower);

          if (matchesSubject || matchesBody || matchesSender) {
            emails.push(email);
          }
        }

        cursor.continue();
      };
    });
  }

  /**
   * Get email count by folder
   */
  async getEmailCount(folder: EmailFolder, userId: string): Promise<number> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      let count = 0;

      const request = store.openCursor();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor) {
          resolve(count);
          return;
        }

        const email = cursor.value as CachedEmail;

        if (email.user_id === userId && this.matchesFolder(email, folder)) {
          count++;
        }

        cursor.continue();
      };
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(folder: EmailFolder, userId: string): Promise<number> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      let count = 0;

      const request = store.openCursor();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor) {
          resolve(count);
          return;
        }

        const email = cursor.value as CachedEmail;

        if (email.user_id === userId && !email.is_read && this.matchesFolder(email, folder)) {
          count++;
        }

        cursor.continue();
      };
    });
  }

  // ========================================
  // PENDING ACTIONS (for offline sync)
  // ========================================

  /**
   * Queue an action to be synced when back online
   */
  async queueAction(action: Omit<PendingAction, 'id' | 'timestamp'>): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);

      const pendingAction: PendingAction = {
        ...action,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      const request = store.add(pendingAction);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<PendingAction[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_ACTIONS_STORE], 'readonly');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Remove a pending action (after successful sync)
   */
  async removePendingAction(actionId: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.delete(actionId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Clear all pending actions
   */
  async clearPendingActions(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ========================================
  // METADATA
  // ========================================

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put({ key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<any> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value);
    });
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = await this.getMetadata('lastSyncTime');
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTime(date: Date): Promise<void> {
    await this.setMetadata('lastSyncTime', date.toISOString());
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * Clear all cached emails for a user
   */
  async clearCache(userId: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readwrite');
      const store = transaction.objectStore(EMAILS_STORE);

      const request = store.openCursor();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor) {
          resolve();
          return;
        }

        const email = cursor.value as CachedEmail;

        if (email.user_id === userId) {
          cursor.delete();
        }

        cursor.continue();
      };
    });
  }

  /**
   * Get total cached email count
   */
  async getTotalCachedCount(userId: string): Promise<number> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([EMAILS_STORE], 'readonly');
      const store = transaction.objectStore(EMAILS_STORE);
      let count = 0;

      const request = store.openCursor();

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (!cursor) {
          resolve(count);
          return;
        }

        const email = cursor.value as CachedEmail;

        if (email.user_id === userId) {
          count++;
        }

        cursor.continue();
      };
    });
  }

  /**
   * Check if we're in offline mode
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Listen for online/offline events
   */
  onConnectivityChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Compute folder from email flags
   */
  private computeFolder(email: Partial<CachedEmail>): EmailFolder {
    if (email.is_trashed) return 'trash';
    if (email.is_draft) return 'drafts';
    if (email.is_sent) return 'sent';
    if (email.is_starred) return 'starred';
    if (email.is_important) return 'important';
    if (email.is_archived) return 'all';
    return 'inbox';
  }

  /**
   * Check if email matches folder
   */
  private matchesFolder(email: CachedEmail, folder: EmailFolder): boolean {
    switch (folder) {
      case 'inbox':
        return !email.is_trashed && !email.is_archived && !email.is_draft && !email.is_sent;
      case 'sent':
        return email.is_sent && !email.is_trashed;
      case 'drafts':
        return email.is_draft && !email.is_trashed;
      case 'starred':
        return email.is_starred && !email.is_trashed;
      case 'important':
        return email.is_important && !email.is_trashed;
      case 'trash':
        return email.is_trashed;
      case 'spam':
        return email.labels?.includes('SPAM') || false;
      case 'snoozed':
        return false; // Handled separately
      case 'all':
        return !email.is_trashed;
      default:
        return true;
    }
  }
}

// Singleton instance
export const offlineEmailStorage = new OfflineEmailStorage();
export default offlineEmailStorage;
