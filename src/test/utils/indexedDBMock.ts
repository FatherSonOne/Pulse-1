/**
 * IndexedDB Mock Utility
 *
 * Complete mock implementation of IndexedDB API for testing.
 * Simulates async behavior using queueMicrotask and provides
 * proper event handling for success/error callbacks.
 */

// ==================== MockIDBRequest ====================

export class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: 'pending' | 'done' = 'pending';

  constructor(value: any, isError = false, skipAutoComplete = false) {
    if (skipAutoComplete) {
      // For subclasses that need manual control - just set initial values
      // Property defaults are already set (result=null, error=null, etc.)
      // Just override result with the passed value
      this.result = value;
      // Don't queue any microtasks - subclass will handle timing
      return;
    }

    // Simulate async completion with microtask
    queueMicrotask(() => {
      this.readyState = 'done';

      if (isError) {
        this.error = value;
        if (this.onerror) {
          this.onerror({ target: this });
        }
      } else {
        this.result = value;
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
      }
    });
  }
}

// ==================== MockIDBTransaction ====================

export class MockIDBTransaction {
  objectStoreNames: string[];
  mode: 'readonly' | 'readwrite';
  oncomplete: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;

  private stores: Map<string, MockIDBObjectStore>;

  constructor(storeNames: string[], mode: 'readonly' | 'readwrite', stores: Map<string, Map<string, any>>) {
    this.objectStoreNames = storeNames;
    this.mode = mode;
    this.stores = new Map();

    // CRITICAL: Share the same data Map reference across transactions
    storeNames.forEach(name => {
      const storeData = stores.get(name);
      if (!storeData) {
        throw new Error(`Object store '${name}' not found in database`);
      }
      this.stores.set(name, new MockIDBObjectStore(name, storeData));
    });

    // Auto-complete transaction after all operations
    queueMicrotask(() => {
      if (this.oncomplete) {
        this.oncomplete({ target: this });
      }
    });
  }

  objectStore(name: string): MockIDBObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Object store '${name}' not found`);
    }
    return store;
  }

  abort() {
    if (this.onabort) {
      this.onabort({ target: this });
    }
  }
}

// ==================== MockIDBObjectStore ====================

export class MockIDBObjectStore {
  name: string;
  private data: Map<string, any>;
  private indexes: Map<string, any> = new Map();

  constructor(name: string, data: Map<string, any>) {
    this.name = name;
    this.data = data;
  }

  get(key: string): MockIDBRequest {
    const value = this.data.get(key);
    return new MockIDBRequest(value);
  }

  put(value: any, key?: string): MockIDBRequest {
    const recordKey = key || value.key;
    this.data.set(recordKey, value);
    return new MockIDBRequest(recordKey);
  }

  add(value: any, key?: string): MockIDBRequest {
    const recordKey = key || value.key;
    if (this.data.has(recordKey)) {
      return new MockIDBRequest(new Error('Key already exists'), true);
    }
    this.data.set(recordKey, value);
    return new MockIDBRequest(recordKey);
  }

  delete(key: string): MockIDBRequest {
    this.data.delete(key);
    return new MockIDBRequest(undefined);
  }

  clear(): MockIDBRequest {
    this.data.clear();
    return new MockIDBRequest(undefined);
  }

  getAll(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.data.values()));
  }

  getAllKeys(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.data.keys()));
  }

  count(): MockIDBRequest {
    return new MockIDBRequest(this.data.size);
  }

  createIndex(name: string, keyPath: string | string[], options?: any): any {
    // Simple mock - just store the index definition
    this.indexes.set(name, { name, keyPath, options });
    return { name, keyPath };
  }

  index(name: string): any {
    return this.indexes.get(name);
  }
}

// ==================== MockIDBDatabase ====================

export class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: any; // DOMStringList-like
  private stores: Map<string, Map<string, any>>;
  private storeNamesList: string[];

  constructor(name: string, version: number, storeNames: string[] = []) {
    this.name = name;
    this.version = version;
    this.storeNamesList = storeNames;

    // Create DOMStringList-like object with contains() method
    this.objectStoreNames = Object.assign([...storeNames], {
      contains: (name: string) => this.storeNamesList.includes(name),
      item: (index: number) => this.storeNamesList[index] || null,
    });

    this.stores = new Map();

    storeNames.forEach(storeName => {
      this.stores.set(storeName, new Map());
    });
  }

  transaction(storeNames: string | string[], mode: 'readonly' | 'readwrite' = 'readonly'): MockIDBTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MockIDBTransaction(names, mode, this.stores);
  }

  createObjectStore(name: string, options?: any): MockIDBObjectStore {
    if (this.stores.has(name)) {
      throw new Error(`Object store '${name}' already exists`);
    }
    const data = new Map();
    this.stores.set(name, data);
    this.storeNamesList.push(name);

    // Update objectStoreNames with new list
    this.objectStoreNames = Object.assign([...this.storeNamesList], {
      contains: (name: string) => this.storeNamesList.includes(name),
      item: (index: number) => this.storeNamesList[index] || null,
    });

    return new MockIDBObjectStore(name, data);
  }

  deleteObjectStore(name: string) {
    this.stores.delete(name);
    this.storeNamesList = this.storeNamesList.filter(n => n !== name);

    // Update objectStoreNames with new list
    this.objectStoreNames = Object.assign([...this.storeNamesList], {
      contains: (name: string) => this.storeNamesList.includes(name),
      item: (index: number) => this.storeNamesList[index] || null,
    });
  }

  close() {
    // No-op for mock
  }
}

// ==================== MockIDBOpenDBRequest ====================

export class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: any) => void) | null = null;

  constructor(db: MockIDBDatabase, needsUpgrade: boolean = false) {
    // Pass skipAutoComplete=true to prevent parent's automatic callback firing
    super(db, false, true);

    // Result is already set by parent, but ensure state is correct
    this.readyState = 'pending';
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;

    if (needsUpgrade) {
      // Trigger upgrade BEFORE success
      queueMicrotask(() => {
        if (this.onupgradeneeded) {
          this.onupgradeneeded({ target: this });
        }
        // Then trigger success after upgrade completes
        queueMicrotask(() => {
          this.readyState = 'done';
          if (this.onsuccess) {
            this.onsuccess({ target: this });
          }
        });
      });
    } else {
      // No upgrade needed, just trigger success with correct timing
      queueMicrotask(() => {
        this.readyState = 'done';
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
      });
    }
  }
}

// ==================== MockIDBFactory ====================

export class MockIDBFactory {
  private databases: Map<string, MockIDBDatabase> = new Map();

  open(name: string, version: number = 1): MockIDBOpenDBRequest {
    let db = this.databases.get(name);
    let needsUpgrade = false;

    if (!db) {
      // New database - needs upgrade
      db = new MockIDBDatabase(name, version, []);
      this.databases.set(name, db);
      needsUpgrade = true;
    } else if (db.version < version) {
      // Existing database with version upgrade
      db.version = version;
      needsUpgrade = true;
    }

    return new MockIDBOpenDBRequest(db, needsUpgrade);
  }

  deleteDatabase(name: string): MockIDBRequest {
    this.databases.delete(name);
    return new MockIDBRequest(undefined);
  }
}

// ==================== Setup Function ====================

/**
 * Sets up IndexedDB mock in global scope
 * Call this in beforeAll() or at the top of your test file
 */
export function setupIndexedDBMock() {
  const mockFactory = new MockIDBFactory();

  (global as any).indexedDB = mockFactory;
  (global as any).IDBRequest = MockIDBRequest;
  (global as any).IDBTransaction = MockIDBTransaction;
  (global as any).IDBObjectStore = MockIDBObjectStore;
  (global as any).IDBDatabase = MockIDBDatabase;
}
