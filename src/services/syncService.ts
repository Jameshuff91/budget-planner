import { logger } from './logger';
import { createPlaidService } from './plaidServiceOptimized';

export interface SyncCursor {
  itemId: string;
  accessToken: string;
  cursor: string;
  lastSync: string;
  accountIds: string[];
}

export interface SyncStatus {
  itemId: string;
  status: 'syncing' | 'idle' | 'error';
  lastSync: string;
  error?: string;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
}

export class SyncService {
  private static instance: SyncService;
  private syncCursors: Map<string, SyncCursor> = new Map();
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private activeSyncs: Set<string> = new Set();

  private constructor() {
    // Only load sync data in browser environment
    if (typeof window !== 'undefined') {
      this.loadSyncData();
    }
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // Load sync data from localStorage
  private loadSyncData(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const cursorsData = localStorage.getItem('sync.cursors');
      if (cursorsData) {
        const cursors = JSON.parse(cursorsData);
        this.syncCursors = new Map(Object.entries(cursors));
      }

      const statusData = localStorage.getItem('sync.statuses');
      if (statusData) {
        const statuses = JSON.parse(statusData);
        this.syncStatuses = new Map(Object.entries(statuses));
      }
    } catch (error) {
      logger.error('Error loading sync data:', error);
    }
  }

  // Save sync data to localStorage
  private saveSyncData(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const cursorsObj = Object.fromEntries(this.syncCursors);
      localStorage.setItem('sync.cursors', JSON.stringify(cursorsObj));

      const statusObj = Object.fromEntries(this.syncStatuses);
      localStorage.setItem('sync.statuses', JSON.stringify(statusObj));
    } catch (error) {
      logger.error('Error saving sync data:', error);
    }
  }

  // Register a new account for syncing
  registerAccount(itemId: string, accessToken: string, accountIds: string[]): void {
    const syncCursor: SyncCursor = {
      itemId,
      accessToken,
      cursor: '', // Start with empty cursor for full sync
      lastSync: new Date().toISOString(),
      accountIds,
    };

    this.syncCursors.set(itemId, syncCursor);

    const syncStatus: SyncStatus = {
      itemId,
      status: 'idle',
      lastSync: new Date().toISOString(),
      transactionsAdded: 0,
      transactionsModified: 0,
      transactionsRemoved: 0,
    };

    this.syncStatuses.set(itemId, syncStatus);
    this.saveSyncData();

    logger.info(`Registered account for syncing: ${itemId}`);
  }

  // Get sync cursor for an item
  getSyncCursor(itemId: string): SyncCursor | undefined {
    return this.syncCursors.get(itemId);
  }

  // Update sync cursor after successful sync
  updateSyncCursor(itemId: string, cursor: string): void {
    const syncCursor = this.syncCursors.get(itemId);
    if (syncCursor) {
      syncCursor.cursor = cursor;
      syncCursor.lastSync = new Date().toISOString();
      this.syncCursors.set(itemId, syncCursor);
      this.saveSyncData();
    }
  }

  // Get sync status for an item
  getSyncStatus(itemId: string): SyncStatus | undefined {
    return this.syncStatuses.get(itemId);
  }

  // Get all sync statuses
  getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  // Update sync status
  updateSyncStatus(itemId: string, updates: Partial<SyncStatus>): void {
    const status = this.syncStatuses.get(itemId);
    if (status) {
      Object.assign(status, updates);
      this.syncStatuses.set(itemId, status);
      this.saveSyncData();
    }
  }

  // Sync transactions for a specific item
  async syncTransactions(itemId: string): Promise<void> {
    if (this.activeSyncs.has(itemId)) {
      logger.info(`Sync already in progress for item: ${itemId}`);
      return;
    }

    const syncCursor = this.getSyncCursor(itemId);
    if (!syncCursor) {
      logger.error(`No sync cursor found for item: ${itemId}`);
      return;
    }

    this.activeSyncs.add(itemId);
    this.updateSyncStatus(itemId, {
      status: 'syncing',
      error: undefined,
    });

    try {
      let hasMore = true;
      let currentCursor = syncCursor.cursor;
      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;

      while (hasMore) {
        const response = await fetch('/api/plaid/transactions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: syncCursor.accessToken,
            cursor: currentCursor || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }

        const data = await response.json();
        const { added, modified, removed, next_cursor, has_more } = data;

        // Process transactions
        await this.processTransactionUpdates(added, modified, removed);

        totalAdded += added.length;
        totalModified += modified.length;
        totalRemoved += removed.length;

        currentCursor = next_cursor;
        hasMore = has_more;

        logger.info(`Sync batch completed for ${itemId}:`, {
          added: added.length,
          modified: modified.length,
          removed: removed.length,
          hasMore,
        });
      }

      // Update cursor and status
      this.updateSyncCursor(itemId, currentCursor);
      this.updateSyncStatus(itemId, {
        status: 'idle',
        lastSync: new Date().toISOString(),
        transactionsAdded: totalAdded,
        transactionsModified: totalModified,
        transactionsRemoved: totalRemoved,
      });

      logger.info(`Sync completed for ${itemId}:`, {
        totalAdded,
        totalModified,
        totalRemoved,
      });
    } catch (error) {
      logger.error(`Sync failed for ${itemId}:`, error);
      this.updateSyncStatus(itemId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.activeSyncs.delete(itemId);
    }
  }

  // Process transaction updates
  private async processTransactionUpdates(
    added: Record<string, unknown>[],
    modified: Record<string, unknown>[],
    removed: Record<string, unknown>[],
  ): Promise<void> {
    try {
      const plaidService = await createPlaidService();
      if (!plaidService) {
        throw new Error('Plaid service not available');
      }

      // Process added transactions
      if (added.length > 0) {
        const transactions = added.map((tx) => plaidService.convertToTransaction(tx));
        await this.addTransactionsBatch(transactions);
      }

      // Process modified transactions
      if (modified.length > 0) {
        const transactions = modified.map((tx) => plaidService.convertToTransaction(tx));
        await this.updateTransactionsBatch(transactions);
      }

      // Process removed transactions
      if (removed.length > 0) {
        await this.removeTransactionsBatch(removed);
      }
    } catch (error) {
      logger.error('Error processing transaction updates:', error);
      throw error;
    }
  }

  // Add transactions in batch
  private async addTransactionsBatch(transactions: Record<string, unknown>[]): Promise<void> {
    // TODO: Integrate with existing database context
    // For now, we'll use the existing addTransactionsBatch method
    logger.info(`Adding ${transactions.length} transactions`);

    // This should integrate with the DatabaseContext's addTransactionsBatch method
    // We'll need to emit an event or call the context method directly
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('plaid-transactions-added', {
          detail: { transactions },
        }),
      );
    }
  }

  // Update transactions in batch
  private async updateTransactionsBatch(transactions: Record<string, unknown>[]): Promise<void> {
    logger.info(`Updating ${transactions.length} transactions`);

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('plaid-transactions-modified', {
          detail: { transactions },
        }),
      );
    }
  }

  // Remove transactions in batch
  private async removeTransactionsBatch(transactionIds: string[]): Promise<void> {
    logger.info(`Removing ${transactionIds.length} transactions`);

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('plaid-transactions-removed', {
          detail: { transactionIds },
        }),
      );
    }
  }

  // Sync all registered accounts
  async syncAllAccounts(): Promise<void> {
    const itemIds = Array.from(this.syncCursors.keys());
    logger.info(`Starting sync for ${itemIds.length} accounts`);

    const syncPromises = itemIds.map((itemId) => this.syncTransactions(itemId));
    await Promise.allSettled(syncPromises);

    logger.info('Completed sync for all accounts');
  }

  // Remove account from sync
  removeAccount(itemId: string): void {
    this.syncCursors.delete(itemId);
    this.syncStatuses.delete(itemId);
    this.activeSyncs.delete(itemId);
    this.saveSyncData();

    logger.info(`Removed account from sync: ${itemId}`);
  }

  // Check if sync is in progress
  isSyncing(itemId: string): boolean {
    return this.activeSyncs.has(itemId);
  }

  // Get sync statistics
  getSyncStats(): {
    totalAccounts: number;
    activeSyncs: number;
    lastSyncTimes: { [itemId: string]: string };
    errorCount: number;
  } {
    const errorCount = Array.from(this.syncStatuses.values()).filter(
      (status) => status.status === 'error',
    ).length;

    const lastSyncTimes: { [itemId: string]: string } = {};
    this.syncStatuses.forEach((status, itemId) => {
      lastSyncTimes[itemId] = status.lastSync;
    });

    return {
      totalAccounts: this.syncCursors.size,
      activeSyncs: this.activeSyncs.size,
      lastSyncTimes,
      errorCount,
    };
  }
}

// Export function to get singleton instance (lazy initialization)
export const getSyncService = () => {
  if (typeof window === 'undefined') {
    // Return a dummy object for SSR
    return null;
  }
  return SyncService.getInstance();
};

// For backward compatibility, export a getter that returns the service
export const syncService = typeof window !== 'undefined' ? SyncService.getInstance() : null;
