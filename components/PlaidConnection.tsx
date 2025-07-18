'use client';

import { Building2, Link, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

import { useAuth } from '@context/AuthContext';
import { apiService } from '@services/api';
import { logger } from '@services/logger';
import { showUserError } from '@utils/userErrors';

import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useToast } from './ui/use-toast';

interface LinkedAccount {
  id: string;
  institutionName: string;
  accountName: string;
  accountType: string;
  mask: string;
  accessToken: string;
  lastSync?: string;
}

export default function PlaidConnection() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Function declarations need to be before useEffect
  const loadAccounts = useCallback(async () => {
    try {
      const response = await apiService.getAccounts();
      if (response.data) {
        setLinkedAccounts(
          response.data.accounts.map(
            (item: {
              item_id: string;
              institution_name: string;
              accounts: Array<{ name?: string; subtype?: string; mask?: string }>;
            }) => ({
              id: item.item_id,
              institutionName: item.institution_name,
              accountName: item.accounts[0]?.name || 'Account',
              accountType: item.accounts[0]?.subtype || 'bank',
              mask: item.accounts[0]?.mask || '****',
              accessToken: item.item_id, // Using item_id as identifier
              lastSync: new Date().toISOString(),
            }),
          ),
        );
      }
    } catch (error) {
      logger.error('Failed to load accounts:', error);
    }
  }, []);

  const createLinkToken = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.createLinkToken();

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        setLinkToken(response.data.link_token);
      }
    } catch (error) {
      logger.error('Failed to create link token:', error);
      toast({
        title: 'Connection Error',
        description: 'Unable to initialize bank connection. Please check your configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initialize link token and load accounts if authenticated
    if (isAuthenticated) {
      createLinkToken();
      loadAccounts();
    }
  }, [isAuthenticated, createLinkToken, loadAccounts]);

  const syncTransactions = useCallback(async () => {
    setIsSyncing('syncing');
    try {
      // Get transactions for the last 90 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await apiService.syncTransactions(startDate, endDate);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        const totalTransactions = response.data.synced.reduce(
          (sum: number, item: { transaction_count: number }) => sum + item.transaction_count,
          0,
        );

        toast({
          title: 'Sync Complete',
          description: `Imported ${totalTransactions} transactions from ${response.data.synced.length} accounts`,
        });
      }
    } catch (error) {
      logger.error('Failed to sync transactions:', error);
      toast({
        title: 'Sync Error',
        description: 'Failed to sync transactions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(null);
    }
  }, [toast]);

  const onSuccess = useCallback(
    async (publicToken: string, _metadata: unknown) => {
      try {
        // Exchange public token using backend API
        const exchangeResponse = await apiService.exchangePublicToken(publicToken);
        if (exchangeResponse.error) {
          throw new Error(exchangeResponse.error);
        }

        // Get accounts from backend
        const accountsResponse = await apiService.getAccounts();

        if (accountsResponse.error) {
          throw new Error(accountsResponse.error);
        }

        toast({
          title: 'Account Connected',
          description: `Successfully connected ${exchangeResponse.data?.institution_name || 'bank'}`,
        });

        // Sync initial transactions
        await syncTransactions();

        // Reload accounts to show the new connection
        await loadAccounts();
      } catch (error) {
        logger.error('Failed to process Plaid connection:', error);
        showUserError(error, toast, 'plaid');
      }
    },
    [loadAccounts, syncTransactions, toast],
  );

  const config = {
    token: linkToken,
    onSuccess,
    onExit: (err: unknown) => {
      if (err) {
        logger.error('Plaid Link error:', err);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const removeAccount = useCallback(
    async (itemId: string, institutionName: string) => {
      if (!confirm(`Remove ${institutionName}?`)) {
        return;
      }

      try {
        const response = await apiService.removeBank(itemId);

        if (response.error) {
          throw new Error(response.error);
        }

        toast({
          title: 'Account Removed',
          description: `${institutionName} has been disconnected`,
        });

        // Refresh accounts list
        await loadAccounts();
      } catch (error) {
        logger.error('Failed to remove account:', error);
        toast({
          title: 'Error',
          description: 'Failed to remove account connection',
          variant: 'destructive',
        });
      }
    },
    [loadAccounts, toast],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Building2 className='h-5 w-5' />
          Bank Connections
        </CardTitle>
        <CardDescription>
          Connect your bank accounts to automatically import transactions
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!isAuthenticated && (
          <Alert>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>Please sign in to connect your bank accounts.</AlertDescription>
          </Alert>
        )}

        {linkedAccounts.length > 0 && (
          <div className='space-y-3'>
            <h4 className='text-sm font-medium'>Connected Accounts</h4>
            {linkedAccounts.map((account) => (
              <div
                key={account.id}
                className='flex items-center justify-between p-3 border rounded-lg'
              >
                <div>
                  <p className='font-medium'>{account.institutionName}</p>
                  <p className='text-sm text-muted-foreground'>
                    {account.accountName} (...{account.mask})
                  </p>
                  {account.lastSync && (
                    <p className='text-xs text-muted-foreground'>
                      Last synced: {new Date(account.lastSync).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => syncTransactions()}
                    disabled={isSyncing === 'syncing'}
                  >
                    {isSyncing === 'syncing' ? (
                      <RefreshCw className='h-4 w-4 animate-spin' />
                    ) : (
                      <RefreshCw className='h-4 w-4' />
                    )}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => removeAccount(account.id, account.institutionName)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className='pt-4'>
          <Button
            onClick={() => (linkToken ? open() : createLinkToken())}
            disabled={!ready || isLoading}
            className='w-full'
          >
            <Link className='h-4 w-4 mr-2' />
            {isLoading ? 'Connecting...' : 'Connect Bank Account'}
          </Button>
        </div>

        <div className='pt-4 border-t'>
          <h4 className='text-sm font-medium mb-2'>How it works:</h4>
          <ul className='text-sm text-muted-foreground space-y-1'>
            <li>• Securely connect your bank using Plaid</li>
            <li>• Automatically import transactions daily</li>
            <li>• Categorize transactions with AI</li>
            <li>• No manual CSV/PDF uploads needed</li>
            <li>• Bank-level encryption and security</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
