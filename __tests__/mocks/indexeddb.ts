import { vi } from 'vitest';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

/**
 * IndexedDB mock implementation using fake-indexeddb
 * Provides a complete implementation that works with the idb library
 */

// Store original values
let originalIndexedDB: any;
let originalIDBKeyRange: any;

// Helper functions for tests
export function clearAllDatabases(): void {
  // fake-indexeddb doesn't provide a direct way to clear all databases
  // Just create a new factory instance to reset everything
  if (global.indexedDB) {
    try {
      // Most implementations don't have this method, so just ignore errors
      if (typeof global.indexedDB.databases === 'function') {
        global.indexedDB.databases().then((databases: any[]) => {
          databases.forEach(db => {
            if (db.name && global.indexedDB && global.indexedDB.deleteDatabase) {
              global.indexedDB.deleteDatabase(db.name);
            }
          });
        }).catch(() => {
          // Ignore errors - not all implementations support this
        });
      }
    } catch (error) {
      // Ignore errors - not all implementations support this
    }
  }
}

export function getDatabaseNames(): string[] {
  // This is not directly supported by fake-indexeddb
  // Return empty array for compatibility
  return [];
}

export function getDatabaseData(name: string): any {
  // This is a simplified implementation for testing
  // fake-indexeddb doesn't expose internal database structure
  return { name, version: 1, objectStoreNames: [], stores: new Map() };
}

export function setupIndexedDBMocks(): void {
  // Store original values
  originalIndexedDB = global.indexedDB;
  originalIDBKeyRange = global.IDBKeyRange;

  // Create new instances for isolation
  const fdbFactory = new FDBFactory();
  
  // Mock global IndexedDB with fake-indexeddb
  global.indexedDB = fdbFactory;
  global.IDBKeyRange = FDBKeyRange;
  
  // Also set on globalThis for broader compatibility
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).indexedDB = fdbFactory;
    (globalThis as any).IDBKeyRange = FDBKeyRange;
  }

  // Mock additional IDB interfaces that might be needed
  global.IDBRequest = class MockIDBRequest extends EventTarget {
    result: any = null;
    error: any = null;
    source: any = null;
    transaction: any = null;
    readyState: string = 'pending';
    
    constructor() {
      super();
    }
  } as any;

  global.IDBOpenDBRequest = class MockIDBOpenDBRequest extends global.IDBRequest {
    constructor() {
      super();
    }
  } as any;

  global.IDBTransaction = class MockIDBTransaction extends EventTarget {
    db: any = null;
    error: any = null;
    mode: string = 'readonly';
    objectStoreNames: string[] = [];

    constructor() {
      super();
    }

    abort() {}
    objectStore(name: string) {
      return null;
    }
  } as any;

  global.IDBDatabase = class MockIDBDatabase extends EventTarget {
    name: string = '';
    version: number = 1;
    objectStoreNames: string[] = [];

    constructor() {
      super();
    }

    close() {}
    createObjectStore(name: string, options?: any) {
      return null;
    }
    deleteObjectStore(name: string) {}
    transaction(storeNames: string | string[], mode?: string) {
      return new global.IDBTransaction();
    }
  } as any;

  global.IDBObjectStore = class MockIDBObjectStore {
    indexNames: string[] = [];
    keyPath: any = null;
    name: string = '';
    transaction: any = null;
    autoIncrement: boolean = false;

    add(value: any, key?: any) {
      return new global.IDBRequest();
    }
    clear() {
      return new global.IDBRequest();
    }
    count(query?: any) {
      return new global.IDBRequest();
    }
    createIndex(name: string, keyPath: string | string[], options?: any) {
      return null;
    }
    delete(query: any) {
      return new global.IDBRequest();
    }
    deleteIndex(name: string) {}
    get(query: any) {
      return new global.IDBRequest();
    }
    getAll(query?: any, count?: number) {
      return new global.IDBRequest();
    }
    getAllKeys(query?: any, count?: number) {
      return new global.IDBRequest();
    }
    index(name: string) {
      return null;
    }
    put(value: any, key?: any) {
      return new global.IDBRequest();
    }
  } as any;

  global.IDBIndex = class MockIDBIndex {
    keyPath: any = null;
    multiEntry: boolean = false;
    name: string = '';
    objectStore: any = null;
    unique: boolean = false;

    count(query?: any) {
      return new global.IDBRequest();
    }
    get(query: any) {
      return new global.IDBRequest();
    }
    getAll(query?: any, count?: number) {
      return new global.IDBRequest();
    }
    getAllKeys(query?: any, count?: number) {
      return new global.IDBRequest();
    }
  } as any;

  global.IDBCursor = class MockIDBCursor {
    direction: string = 'next';
    key: any = null;
    primaryKey: any = null;
    source: any = null;

    advance(count: number) {}
    continue(key?: any) {}
    delete() {
      return new global.IDBRequest();
    }
    update(value: any) {
      return new global.IDBRequest();
    }
  } as any;

  global.IDBCursorWithValue = class MockIDBCursorWithValue extends global.IDBCursor {
    value: any = null;
  } as any;
}

export function teardownIndexedDBMocks(): void {
  // Clear all databases
  clearAllDatabases();
  
  // Restore original values
  if (originalIndexedDB !== undefined) {
    global.indexedDB = originalIndexedDB;
  } else {
    delete (global as any).indexedDB;
  }
  
  if (originalIDBKeyRange !== undefined) {
    global.IDBKeyRange = originalIDBKeyRange;
  } else {
    delete (global as any).IDBKeyRange;
  }
  
  // Clean up globalThis
  if (typeof globalThis !== 'undefined') {
    if (originalIndexedDB !== undefined) {
      (globalThis as any).indexedDB = originalIndexedDB;
    } else {
      delete (globalThis as any).indexedDB;
    }
    
    if (originalIDBKeyRange !== undefined) {
      (globalThis as any).IDBKeyRange = originalIDBKeyRange;
    } else {
      delete (globalThis as any).IDBKeyRange;
    }
  }

  // Clean up other IDB interfaces
  delete (global as any).IDBRequest;
  delete (global as any).IDBOpenDBRequest;
  delete (global as any).IDBTransaction;
  delete (global as any).IDBDatabase;
  delete (global as any).IDBObjectStore;
  delete (global as any).IDBIndex;
  delete (global as any).IDBCursor;
  delete (global as any).IDBCursorWithValue;
}

// Vitest setup/teardown helpers
export function beforeEachSetup(): void {
  setupIndexedDBMocks();
}

export function afterEachTeardown(): void {
  clearAllDatabases();
}

export function afterAllTeardown(): void {
  teardownIndexedDBMocks();
}

// Export fake-indexeddb for direct access if needed
export { FDBFactory, FDBKeyRange };

// Legacy exports for compatibility
export const mockIndexedDB = {
  open: (name: string, version?: number) => global.indexedDB.open(name, version),
  deleteDatabase: (name: string) => global.indexedDB.deleteDatabase(name),
  cmp: (a: any, b: any) => global.indexedDB.cmp(a, b),
};

export const mockIDBKeyRange = FDBKeyRange;