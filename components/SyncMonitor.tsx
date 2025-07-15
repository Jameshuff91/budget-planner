'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

import { syncService, SyncStatus } from '@/src/services/syncService';
import { scheduledSyncService } from '@/src/services/scheduledSyncService';
import { logger } from '@/src/services/logger';

export default function SyncMonitor() {
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [scheduledSyncStatus, setScheduledSyncStatus] = useState({
    isRunning: false,
    intervalMs: 3600000,
  });
  const { toast } = useToast();

  // Load sync statuses
  const loadSyncStatuses = () => {
    const statuses = syncService.getAllSyncStatuses();
    setSyncStatuses(statuses);

    const scheduledStatus = scheduledSyncService.getStatus();
    setScheduledSyncStatus(scheduledStatus);
  };

  // Manual sync trigger
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await scheduledSyncService.runSyncNow();
      toast({
        title: 'Sync Completed',
        description: 'All accounts have been synchronized successfully.',
      });
      loadSyncStatuses();
    } catch (error) {
      logger.error('Manual sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync accounts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Format last sync time
  const formatLastSync = (lastSync: string) => {
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: SyncStatus['status']) => {
    switch (status) {
      case 'syncing':
        return 'default';
      case 'idle':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Get status icon
  const getStatusIcon = (status: SyncStatus['status']) => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className='h-4 w-4 animate-spin' />;
      case 'idle':
        return <CheckCircle className='h-4 w-4' />;
      case 'error':
        return <AlertCircle className='h-4 w-4' />;
      default:
        return <Clock className='h-4 w-4' />;
    }
  };

  // Calculate sync progress (mock implementation)
  const getSyncProgress = (status: SyncStatus) => {
    if (status.status === 'syncing') {
      // In a real implementation, you'd track actual progress
      return 65; // Mock progress
    }
    return status.status === 'idle' ? 100 : 0;
  };

  // Load data on mount and set up refresh interval
  useEffect(() => {
    loadSyncStatuses();
    const interval = setInterval(loadSyncStatuses, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const stats = syncService.getSyncStats();
  const hasErrors = syncStatuses.some((status) => status.status === 'error');
  const activeSyncs = syncStatuses.filter((status) => status.status === 'syncing').length;

  return (
    <div className='space-y-6'>
      {/* Sync Overview */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Activity className='h-5 w-5' />
            Sync Status
          </CardTitle>
          <CardDescription>Monitor automatic transaction synchronization</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Overall Status */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='text-center'>
              <div className='text-2xl font-bold'>{stats.totalAccounts}</div>
              <div className='text-sm text-muted-foreground'>Connected Accounts</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold'>{activeSyncs}</div>
              <div className='text-sm text-muted-foreground'>Active Syncs</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold'>{stats.errorCount}</div>
              <div className='text-sm text-muted-foreground'>Errors</div>
            </div>
          </div>

          {/* Error Alert */}
          {hasErrors && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                Some accounts have sync errors. Check individual account status below.
              </AlertDescription>
            </Alert>
          )}

          {/* Manual Sync Button */}
          <div className='flex justify-between items-center'>
            <div className='text-sm text-muted-foreground'>
              Scheduled sync: {scheduledSyncStatus.isRunning ? 'Running' : 'Stopped'} (
              {Math.round(scheduledSyncStatus.intervalMs / 60000)} min interval)
            </div>
            <Button
              onClick={handleManualSync}
              disabled={isManualSyncing}
              variant='outline'
              size='sm'
            >
              {isManualSyncing ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className='h-4 w-4 mr-2' />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Account Status */}
      {syncStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Account Sync Details</CardTitle>
            <CardDescription>Individual account synchronization status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {syncStatuses.map((status) => (
                <div key={status.itemId} className='border rounded-lg p-4'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      {getStatusIcon(status.status)}
                      <span className='font-medium'>Account {status.itemId}</span>
                      <Badge variant={getStatusBadgeVariant(status.status)}>
                        {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                      </Badge>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Last sync: {formatLastSync(status.lastSync)}
                    </div>
                  </div>

                  {/* Progress Bar for Active Syncs */}
                  {status.status === 'syncing' && (
                    <div className='mb-2'>
                      <Progress value={getSyncProgress(status)} className='h-2' />
                    </div>
                  )}

                  {/* Error Message */}
                  {status.error && (
                    <Alert variant='destructive' className='mb-2'>
                      <AlertCircle className='h-4 w-4' />
                      <AlertDescription>{status.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Transaction Counts */}
                  <div className='grid grid-cols-3 gap-4 text-sm'>
                    <div>
                      <div className='font-medium text-green-600'>{status.transactionsAdded}</div>
                      <div className='text-muted-foreground'>Added</div>
                    </div>
                    <div>
                      <div className='font-medium text-blue-600'>{status.transactionsModified}</div>
                      <div className='text-muted-foreground'>Modified</div>
                    </div>
                    <div>
                      <div className='font-medium text-red-600'>{status.transactionsRemoved}</div>
                      <div className='text-muted-foreground'>Removed</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Accounts Message */}
      {syncStatuses.length === 0 && (
        <Card>
          <CardContent className='text-center py-8'>
            <Activity className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
            <h3 className='text-lg font-medium mb-2'>No Connected Accounts</h3>
            <p className='text-muted-foreground mb-4'>
              Connect your bank accounts to enable automatic transaction synchronization.
            </p>
            <Button variant='outline'>Connect Bank Account</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
