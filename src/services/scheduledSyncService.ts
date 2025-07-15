import { logger } from './logger';
import { syncService } from './syncService';

export class ScheduledSyncService {
  private static instance: ScheduledSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs: number;

  private constructor() {
    // Default to 1 hour (3600000 ms)
    this.intervalMs = parseInt(process.env.SYNC_SCHEDULE_INTERVAL || '3600000', 10);
  }

  static getInstance(): ScheduledSyncService {
    if (!ScheduledSyncService.instance) {
      ScheduledSyncService.instance = new ScheduledSyncService();
    }
    return ScheduledSyncService.instance;
  }

  // Start the scheduled sync
  start(): void {
    if (this.isRunning) {
      logger.info('Scheduled sync is already running');
      return;
    }

    logger.info(`Starting scheduled sync with interval: ${this.intervalMs}ms`);

    this.syncInterval = setInterval(async () => {
      try {
        logger.info('Running scheduled sync...');
        await syncService.syncAllAccounts();
        logger.info('Scheduled sync completed');
      } catch (error) {
        logger.error('Scheduled sync failed:', error);
      }
    }, this.intervalMs);

    this.isRunning = true;
    logger.info('Scheduled sync started');
  }

  // Stop the scheduled sync
  stop(): void {
    if (!this.isRunning) {
      logger.info('Scheduled sync is not running');
      return;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
    logger.info('Scheduled sync stopped');
  }

  // Update the sync interval
  updateInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
    logger.info(`Updated sync interval to: ${intervalMs}ms`);

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  // Get current status
  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    nextSyncIn?: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      // Note: We can't accurately calculate nextSyncIn with setInterval
      // In a production system, you'd want to use a proper job scheduler
    };
  }

  // Run sync immediately (manual trigger)
  async runSyncNow(): Promise<void> {
    try {
      logger.info('Running manual sync...');
      await syncService.syncAllAccounts();
      logger.info('Manual sync completed');
    } catch (error) {
      logger.error('Manual sync failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const scheduledSyncService = ScheduledSyncService.getInstance();

// Auto-start in browser environment
if (typeof window !== 'undefined') {
  // Start scheduled sync when the service is loaded
  scheduledSyncService.start();

  // Stop scheduled sync when the page is unloaded
  window.addEventListener('beforeunload', () => {
    scheduledSyncService.stop();
  });
}
