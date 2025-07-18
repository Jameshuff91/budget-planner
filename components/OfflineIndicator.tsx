/**
 * OfflineIndicator Component
 * Displays network status and offline operations to users
 */

'use client';

import { WifiOff, Wifi, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '../lib/utils';
import { useOfflineStatus, useOfflineDetection } from '../src/hooks/useOfflineStatus';

import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export function OfflineIndicator({
  className,
  showDetails = false,
  compact = false,
}: OfflineIndicatorProps) {
  const { isOnline, isOffline, pendingOperations, lastSyncTimestamp, syncInProgress, forceSync } =
    useOfflineStatus();

  const [isRetrying, setIsRetrying] = useState(false);

  const handleForceSync = async () => {
    setIsRetrying(true);
    try {
      await forceSync();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Compact version for toolbar/header
  if (compact) {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        {isOffline && (
          <Badge variant='destructive' className='flex items-center space-x-1'>
            <WifiOff className='w-3 h-3' />
            <span>Offline</span>
          </Badge>
        )}

        {pendingOperations > 0 && (
          <Badge variant='secondary' className='flex items-center space-x-1'>
            <Clock className='w-3 h-3' />
            <span>{pendingOperations}</span>
          </Badge>
        )}

        {syncInProgress && <RefreshCw className='w-4 h-4 animate-spin text-blue-500' />}
      </div>
    );
  }

  // Don't show if online and no pending operations
  if (isOnline && pendingOperations === 0 && !showDetails) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      <div className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <div className='flex items-center space-x-2'>
              {isOnline ? (
                <Wifi className='w-5 h-5 text-green-500' />
              ) : (
                <WifiOff className='w-5 h-5 text-red-500' />
              )}
              <span className='font-medium'>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {syncInProgress && (
              <div className='flex items-center space-x-2 text-blue-600'>
                <RefreshCw className='w-4 h-4 animate-spin' />
                <span className='text-sm'>Syncing...</span>
              </div>
            )}
          </div>

          {pendingOperations > 0 && !syncInProgress && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleForceSync}
              disabled={isRetrying}
              className='flex items-center space-x-2'
            >
              {isRetrying ? (
                <RefreshCw className='w-4 h-4 animate-spin' />
              ) : (
                <RefreshCw className='w-4 h-4' />
              )}
              <span>Sync Now</span>
            </Button>
          )}
        </div>

        {/* Pending operations info */}
        {pendingOperations > 0 && (
          <div className='mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md'>
            <div className='flex items-center space-x-2'>
              <Clock className='w-4 h-4 text-yellow-600' />
              <span className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>
                {pendingOperations} operation{pendingOperations > 1 ? 's' : ''} pending sync
              </span>
            </div>
            <p className='text-xs text-yellow-700 dark:text-yellow-300 mt-1'>
              {isOffline
                ? 'These will sync automatically when you&apos;re back online.'
                : 'These will sync shortly. You can force sync now if needed.'}
            </p>
          </div>
        )}

        {/* Offline message */}
        {isOffline && (
          <div className='mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md'>
            <div className='flex items-center space-x-2'>
              <AlertCircle className='w-4 h-4 text-red-600' />
              <span className='text-sm font-medium text-red-800 dark:text-red-200'>
                You&apos;re currently offline
              </span>
            </div>
            <p className='text-xs text-red-700 dark:text-red-300 mt-1'>
              You can continue working. All changes will be saved locally and synced when
              you&apos;re back online.
            </p>
          </div>
        )}

        {/* Success message */}
        {isOnline && pendingOperations === 0 && lastSyncTimestamp && showDetails && (
          <div className='mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-md'>
            <div className='flex items-center space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-600' />
              <span className='text-sm font-medium text-green-800 dark:text-green-200'>
                All data synced
              </span>
            </div>
            <p className='text-xs text-green-700 dark:text-green-300 mt-1'>
              Last sync: {formatLastSync(lastSyncTimestamp)}
            </p>
          </div>
        )}

        {/* Show details section */}
        {showDetails && (
          <div className='mt-4 pt-3 border-t border-gray-200 dark:border-gray-700'>
            <div className='grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400'>
              <div>
                <span className='font-medium'>Status:</span>
                <span className={cn('ml-1', isOnline ? 'text-green-600' : 'text-red-600')}>
                  {isOnline ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div>
                <span className='font-medium'>Pending:</span>
                <span className='ml-1'>{pendingOperations} operations</span>
              </div>
              <div className='col-span-2'>
                <span className='font-medium'>Last sync:</span>
                <span className='ml-1'>{formatLastSync(lastSyncTimestamp)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Floating indicator for persistent status display
export function FloatingOfflineIndicator() {
  const { showOfflineIndicator } = useOfflineDetection();

  if (!showOfflineIndicator) {
    return null;
  }

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <OfflineIndicator compact className='bg-white dark:bg-gray-800 shadow-lg' />
    </div>
  );
}

// Header indicator for navigation bars
export function HeaderOfflineIndicator() {
  return <OfflineIndicator compact className='ml-auto' />;
}

export default OfflineIndicator;
