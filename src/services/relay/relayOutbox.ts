// Durable send outbox for Relay voice messages (app-dev sweep #1).
//
// The Voxer-trust gap: before this, a recording lived only in React state
// (`pendingRecording`). A refresh, tab close, crash, or navigate-away between
// record-stop and a successful send lost the message outright, and a flaky
// network forced the user to manually re-tap send.
//
// This store persists the recording — audio blob included — to IndexedDB the
// moment the user hits send, so it survives anything short of clearing browser
// data and can be retried by the processor until it lands (or the user gives up
// and deletes it). IndexedDB stores Blobs natively, so no base64 round-trip.
//
// Idiom mirrors services/offlineEmailStorage.ts (singleton class over raw
// IndexedDB, initDB() guard, promise-wrapped transactions). Reads use getAll()
// + in-JS filtering rather than cursors — the outbox is small (a handful of
// in-flight messages), and it keeps the store unit-testable with the repo's
// indexedDBMock (which implements getAll but not openCursor).

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export interface RelayOutboxEntry {
  /** Stable id — reused as the optimistic bubble's temp id so the UI can reconcile. */
  id: string;
  /** auth.uid() of the sender at enqueue time; entries are scoped to this on read. */
  senderId: string;
  recipientId: string;
  /** The audio itself. IndexedDB persists Blobs, so this survives a reload. */
  blob: Blob;
  duration: number;
  transcript?: string;
  /** Passthrough for sendQuickVox (carries reply_to_id when replying). */
  analysis?: any;
  replyToId?: string;
  createdAt: number;
  status: OutboxStatus;
  /** Failed send attempts so far; drives backoff + the auto-retry ceiling. */
  attempts: number;
  lastError?: string;
  /** Epoch ms; the entry is sendable once Date.now() >= this. */
  nextAttemptAt: number;
}

const DB_NAME = 'pulse-relay-outbox';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';

class RelayOutbox {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[relayOutbox] failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          // Out-of-line keys: we pass the id explicitly to put(). Reads are
          // getAll() + in-JS filter (the queue is tiny), so no indexes needed.
          db.createObjectStore(OUTBOX_STORE);
        }
      };
    });

    return this.dbPromise;
  }

  /** Persist a new outbox entry (or overwrite one with the same id). */
  async enqueue(entry: RelayOutboxEntry): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([OUTBOX_STORE], 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
      tx.objectStore(OUTBOX_STORE).put(entry, entry.id);
    });
  }

  async get(id: string): Promise<RelayOutboxEntry | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([OUTBOX_STORE], 'readonly');
      const req = tx.objectStore(OUTBOX_STORE).get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as RelayOutboxEntry) || null);
    });
  }

  /**
   * All entries, newest first. Scoped to `senderId` when provided so one user's
   * queue never surfaces another's on a shared device.
   */
  async getAll(senderId?: string): Promise<RelayOutboxEntry[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([OUTBOX_STORE], 'readonly');
      const req = tx.objectStore(OUTBOX_STORE).getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const all = (req.result as RelayOutboxEntry[]) || [];
        const scoped = senderId ? all.filter((e) => e.senderId === senderId) : all;
        scoped.sort((a, b) => b.createdAt - a.createdAt);
        resolve(scoped);
      };
    });
  }

  /** Read-modify-write a subset of fields on one entry. No-op if it's gone. */
  async update(id: string, patch: Partial<RelayOutboxEntry>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    await this.enqueue({ ...existing, ...patch, id: existing.id });
  }

  /** Drop an entry — call on successful send or a user delete. */
  async remove(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([OUTBOX_STORE], 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
      tx.objectStore(OUTBOX_STORE).delete(id);
    });
  }
}

export const relayOutbox = new RelayOutbox();
export default relayOutbox;
