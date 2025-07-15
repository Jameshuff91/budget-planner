/**
 * useOfflineStatus Hook
 * Provides real-time network status and offline queue information
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueue, OfflineQueueStatus } from '../utils/offline-queue';
import { logger } from '../services/logger';

export interface OfflineStatusHook {
  isOnline: boolean;
  isOffline: boolean;
  pendingOperations: number;
  lastSyncTimestamp: number | null;
  syncInProgress: boolean;
  forceSync: () => Promise<void>;
  clearSyncedOperations: () => Promise<void>;
  retryCount: number;
}

export function useOfflineStatus(): OfflineStatusHook {
  const [status, setStatus] = useState<OfflineQueueStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingOperations: 0,
    lastSyncTimestamp: null,
    syncInProgress: false,
  });
  const [retryCount, setRetryCount] = useState(0);

  // Force sync function
  const forceSync = useCallback(async () => {
    try {
      setRetryCount((prev) => prev + 1);
      await offlineQueue.forceSync();
      logger.info('Manual sync completed');
    } catch (error) {
      logger.error('Manual sync failed:', error);
      throw error;
    }
  }, []);

  // Clear synced operations
  const clearSyncedOperations = useCallback(async () => {
    try {
      await offlineQueue.clearSyncedOperations();
      logger.info('Synced operations cleared');
    } catch (error) {
      logger.error('Failed to clear synced operations:', error);
      throw error;
    }
  }, []);

  // Enhanced network status detection
  const checkNetworkStatus = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Try to fetch a lightweight resource to confirm connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Setup effect
  useEffect(() => {
    let mounted = true;

    // Listen to offline queue status changes
    const unsubscribeStatus = offlineQueue.onStatusChange((newStatus) => {
      if (mounted) {
        setStatus(newStatus);
      }
    });

    // Enhanced network event listeners
    const handleOnline = async () => {
      const isActuallyOnline = await checkNetworkStatus();
      if (mounted) {
        setStatus((prev) => ({ ...prev, isOnline: isActuallyOnline }));
        if (isActuallyOnline) {
          logger.info('Network connection restored');
          // Trigger sync when coming back online
          offlineQueue.processPendingOperations();
        }
      }
    };

    const handleOffline = () => {
      if (mounted) {
        setStatus((prev) => ({ ...prev, isOnline: false }));
        logger.info('Network connection lost');
      }
    };

    // Periodic connectivity check when online
    const connectivityInterval = setInterval(async () => {
      if (navigator.onLine && mounted) {
        const isActuallyOnline = await checkNetworkStatus();
        setStatus((prev) => {
          if (prev.isOnline !== isActuallyOnline) {
            logger.info(`Network status changed: ${isActuallyOnline ? 'online' : 'offline'}`);
            if (isActuallyOnline) {
              // Trigger sync when connectivity is restored
              offlineQueue.processPendingOperations();
            }
          }
          return { ...prev, isOnline: isActuallyOnline };
        });
      }
    }, 30000); // Check every 30 seconds

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle visibility change (when user switches tabs)
    const handleVisibilityChange = async () => {
      if (!document.hidden && navigator.onLine && mounted) {
        const isActuallyOnline = await checkNetworkStatus();
        if (isActuallyOnline) {
          offlineQueue.processPendingOperations();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial status check
    checkNetworkStatus().then((isOnline) => {
      if (mounted) {
        setStatus((prev) => ({ ...prev, isOnline }));
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      unsubscribeStatus();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(connectivityInterval);
    };
  }, [checkNetworkStatus]);

  return {
    isOnline: status.isOnline,
    isOffline: !status.isOnline,
    pendingOperations: status.pendingOperations,
    lastSyncTimestamp: status.lastSyncTimestamp,
    syncInProgress: status.syncInProgress,
    forceSync,
    clearSyncedOperations,
    retryCount,
  };
}

// Additional hook for components that need to know when to show offline UI
export function useOfflineDetection() {
  const { isOffline, pendingOperations } = useOfflineStatus();

  return {
    showOfflineIndicator: isOffline || pendingOperations > 0,
    isOffline,
    hasPendingOperations: pendingOperations > 0,
  };
}

// Hook for components that need to react to connectivity changes
export function useConnectivityActions() {
  const { isOnline, pendingOperations, forceSync } = useOfflineStatus();

  const [lastSyncAttempt, setLastSyncAttempt] = useState<number | null>(null);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations > 0) {
      const now = Date.now();
      // Prevent too frequent sync attempts (minimum 5 seconds between attempts)
      if (!lastSyncAttempt || now - lastSyncAttempt > 5000) {
        setLastSyncAttempt(now);
        forceSync().catch((error) => {
          logger.error('Auto-sync failed:', error);
        });
      }
    }
  }, [isOnline, pendingOperations, forceSync, lastSyncAttempt]);

  return {
    isOnline,
    pendingOperations,
    forceSync: useCallback(async () => {
      setLastSyncAttempt(Date.now());
      return forceSync();
    }, [forceSync]),
  };
}

export default useOfflineStatus;
