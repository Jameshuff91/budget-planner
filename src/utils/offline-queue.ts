/**
 * Offline Queue Utility
 * Manages queuing of operations when offline and syncing when back online
 */

import { logger } from '../services/logger';
import { Transaction, Category, Asset, Liability } from '../types';

import { generateUUID } from './helpers';

export interface QueuedOperation {
  id: string;
  type:
    | 'ADD_TRANSACTION'
    | 'UPDATE_TRANSACTION'
    | 'DELETE_TRANSACTION'
    | 'ADD_CATEGORY'
    | 'ADD_ASSET'
    | 'ADD_LIABILITY'
    | 'UPDATE_ASSET'
    | 'UPDATE_LIABILITY'
    | 'DELETE_ASSET'
    | 'DELETE_LIABILITY';
  payload: any;
  timestamp: number;
  retryCount: number;
  synced: boolean;
}

export interface OfflineQueueStatus {
  isOnline: boolean;
  pendingOperations: number;
  lastSyncTimestamp: number | null;
  syncInProgress: boolean;
}

class OfflineQueue {
  private db: IDBDatabase | null = null;
  private dbName = 'budget-planner-offline-queue';
  private dbVersion = 1;
  private storeName = 'operations';
  private maxRetries = 3;
  private syncCallbacks: Set<(operation: QueuedOperation) => Promise<void>> = new Set();
  private statusCallbacks: Set<(status: OfflineQueueStatus) => void> = new Set();
  private currentStatus: OfflineQueueStatus = {
    isOnline: navigator.onLine,
    pendingOperations: 0,
    lastSyncTimestamp: null,
    syncInProgress: false,
  };

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.init();
      this.setupNetworkListeners();
      this.setupServiceWorkerCommunication();
    }
  }

  private async init(): Promise<void> {
    try {
      this.db = await this.openDB();
      await this.updateStatus();
      logger.info('Offline queue initialized');
    } catch (error) {
      logger.error('Failed to initialize offline queue:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('type', 'type');
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('synced', 'synced');
        }
      };
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.currentStatus.isOnline = true;
      this.notifyStatusChange();
      this.processPendingOperations();
    });

    window.addEventListener('offline', () => {
      this.currentStatus.isOnline = false;
      this.notifyStatusChange();
    });
  }

  private setupServiceWorkerCommunication(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, transaction } = event.data;

        if (type === 'SYNC_TRANSACTION') {
          this.handleServiceWorkerSync(transaction);
        }
      });
    }
  }

  private async handleServiceWorkerSync(transaction: any): Promise<void> {
    // Handle transaction sync from service worker
    try {
      await this.markOperationSynced(transaction.id);
      logger.info('Operation synced from service worker:', transaction.id);
    } catch (error) {
      logger.error('Failed to handle service worker sync:', error);
    }
  }

  // Public methods for queuing operations
  async queueAddTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
    const operationId = generateUUID();
    const operation: QueuedOperation = {
      id: operationId,
      type: 'ADD_TRANSACTION',
      payload: transaction,
      timestamp: Date.now(),
      retryCount: 0,
      synced: false,
    };

    await this.addOperation(operation);

    // If online, try to sync immediately
    if (this.currentStatus.isOnline) {
      this.processPendingOperations();
    } else {
      // Queue in service worker for background sync
      this.notifyServiceWorker('QUEUE_TRANSACTION', operation);
    }

    return operationId;
  }

  async queueUpdateTransaction(transaction: Transaction): Promise<string> {
    const operationId = generateUUID();
    const operation: QueuedOperation = {
      id: operationId,
      type: 'UPDATE_TRANSACTION',
      payload: transaction,
      timestamp: Date.now(),
      retryCount: 0,
      synced: false,
    };

    await this.addOperation(operation);

    if (this.currentStatus.isOnline) {
      this.processPendingOperations();
    }

    return operationId;
  }

  async queueDeleteTransaction(transactionId: string): Promise<string> {
    const operationId = generateUUID();
    const operation: QueuedOperation = {
      id: operationId,
      type: 'DELETE_TRANSACTION',
      payload: { id: transactionId },
      timestamp: Date.now(),
      retryCount: 0,
      synced: false,
    };

    await this.addOperation(operation);

    if (this.currentStatus.isOnline) {
      this.processPendingOperations();
    }

    return operationId;
  }

  async queueAddAsset(asset: Omit<Asset, 'id'>): Promise<string> {
    const operationId = generateUUID();
    const operation: QueuedOperation = {
      id: operationId,
      type: 'ADD_ASSET',
      payload: asset,
      timestamp: Date.now(),
      retryCount: 0,
      synced: false,
    };

    await this.addOperation(operation);

    if (this.currentStatus.isOnline) {
      this.processPendingOperations();
    }

    return operationId;
  }

  async queueAddLiability(liability: Omit<Liability, 'id'>): Promise<string> {
    const operationId = generateUUID();
    const operation: QueuedOperation = {
      id: operationId,
      type: 'ADD_LIABILITY',
      payload: liability,
      timestamp: Date.now(),
      retryCount: 0,
      synced: false,
    };

    await this.addOperation(operation);

    if (this.currentStatus.isOnline) {
      this.processPendingOperations();
    }

    return operationId;
  }

  // Database operations
  private async addOperation(operation: QueuedOperation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    await new Promise<void>((resolve, reject) => {
      const request = store.add(operation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await this.updateStatus();
  }

  private async markOperationSynced(operationId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const operation = await new Promise<QueuedOperation>((resolve, reject) => {
      const request = store.get(operationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (operation) {
      operation.synced = true;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    await this.updateStatus();
  }

  private async getPendingOperations(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise<QueuedOperation[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Filter for unsynced operations after getting all
        const pendingOps = request.result.filter((op) => !op.synced);
        resolve(pendingOps);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Sync operations
  async processPendingOperations(): Promise<void> {
    if (this.currentStatus.syncInProgress || !this.currentStatus.isOnline) {
      return;
    }

    this.currentStatus.syncInProgress = true;
    this.notifyStatusChange();

    try {
      const pendingOps = await this.getPendingOperations();

      for (const operation of pendingOps) {
        try {
          await this.syncOperation(operation);
          await this.markOperationSynced(operation.id);
          logger.info(`Operation synced: ${operation.type} ${operation.id}`);
        } catch (error) {
          logger.error('Failed to sync operation:', error);

          // Increment retry count
          operation.retryCount++;
          if (operation.retryCount >= this.maxRetries) {
            logger.error('Max retries reached for operation:', operation.id);
            // Could mark as failed or remove from queue
          }
        }
      }

      this.currentStatus.lastSyncTimestamp = Date.now();
    } catch (error) {
      logger.error('Failed to process pending operations:', error);
    } finally {
      this.currentStatus.syncInProgress = false;
      await this.updateStatus();
      this.notifyStatusChange();
    }
  }

  private async syncOperation(operation: QueuedOperation): Promise<void> {
    for (const callback of this.syncCallbacks) {
      await callback(operation);
    }
  }

  // Status management
  private async updateStatus(): Promise<void> {
    const pendingOps = await this.getPendingOperations();
    this.currentStatus.pendingOperations = pendingOps.length;
  }

  private notifyStatusChange(): void {
    for (const callback of this.statusCallbacks) {
      callback(this.currentStatus);
    }
  }

  // Service Worker communication
  private notifyServiceWorker(type: string, payload: any): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, payload });
    }
  }

  // Public API for components
  onSync(callback: (operation: QueuedOperation) => Promise<void>): () => void {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }

  onStatusChange(callback: (status: OfflineQueueStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    // Immediately call with current status
    callback(this.currentStatus);
    return () => this.statusCallbacks.delete(callback);
  }

  getStatus(): OfflineQueueStatus {
    return { ...this.currentStatus };
  }

  async forceSync(): Promise<void> {
    if ('serviceWorker' in navigator) {
      this.notifyServiceWorker('FORCE_SYNC', {});
    }
    await this.processPendingOperations();
  }

  async clearSyncedOperations(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Check if the 'synced' index exists before using it
      if (!store.indexNames.contains('synced')) {
        logger.warn('Synced index not found, skipping clearSyncedOperations');
        return;
      }

      const index = store.index('synced');

      return new Promise<void>((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(true)); // true = synced operations

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error('Error in clearSyncedOperations:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
export default offlineQueue;
