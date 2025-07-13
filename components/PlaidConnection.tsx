'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Building2, Link, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from './ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { createPlaidService } from '@/src/services/plaidService';
import { logger } from '@/src/services/logger';

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
  const { addTransactionsBatch } = useDBContext();
  const { toast } = useToast();

  useEffect(() => {
    // Load linked accounts from localStorage
    const saved = localStorage.getItem('plaid.linkedAccounts');
    if (saved) {
      setLinkedAccounts(JSON.parse(saved));
    }
  }, []);

  const createLinkToken = async () => {
    setIsLoading(true);
    try {
      const plaidService = createPlaidService();
      if (!plaidService) {
        toast({
          title: 'Configuration Error',
          description: 'Plaid is not configured. Please add API credentials.',
          variant: 'destructive',
        });
        return;
      }

      const token = await plaidService.createLinkToken('user-' + Date.now());
      setLinkToken(token);
    } catch (error) {
      logger.error('Failed to create link token:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Plaid. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      const plaidService = createPlaidService();
      if (!plaidService) return;

      // Exchange public token for access token
      const accessToken = await plaidService.exchangePublicToken(publicToken);

      // Get account details
      const accounts = await plaidService.getAccounts(accessToken);

      // Save linked accounts
      const newAccounts: LinkedAccount[] = accounts.map(account => ({
        id: account.accountId,
        institutionName: metadata.institution.name,
        accountName: account.name,
        accountType: account.subtype,
        mask: account.mask,
        accessToken,
        lastSync: new Date().toISOString(),
      }));

      const updatedAccounts = [...linkedAccounts, ...newAccounts];
      setLinkedAccounts(updatedAccounts);
      localStorage.setItem('plaid.linkedAccounts', JSON.stringify(updatedAccounts));

      toast({
        title: 'Account Connected',
        description: `Successfully connected ${metadata.institution.name}`,
      });

      // Sync initial transactions
      await syncTransactions(accessToken);
    } catch (error) {
      logger.error('Failed to process Plaid connection:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to save account connection.',
        variant: 'destructive',
      });
    }
  }, [linkedAccounts]);

  const config = {
    token: linkToken,
    onSuccess,
    onExit: (err: any) => {
      if (err) {
        logger.error('Plaid Link error:', err);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const syncTransactions = async (accessToken: string) => {
    setIsSyncing(accessToken);
    try {
      const plaidService = createPlaidService();
      if (!plaidService) return;

      // Get transactions for the last 90 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const plaidTransactions = await plaidService.getTransactions(
        accessToken,
        startDate,
        endDate
      );

      // Convert and add transactions
      const transactions = plaidTransactions.map(tx => 
        plaidService.convertToTransaction(tx)
      );

      if (transactions.length > 0) {
        await addTransactionsBatch(transactions);
        
        // Update last sync time
        const updated = linkedAccounts.map(acc => 
          acc.accessToken === accessToken 
            ? { ...acc, lastSync: new Date().toISOString() }
            : acc
        );
        setLinkedAccounts(updated);
        localStorage.setItem('plaid.linkedAccounts', JSON.stringify(updated));

        toast({
          title: 'Sync Complete',
          description: `Imported ${transactions.length} transactions`,
        });
      } else {
        toast({
          title: 'No New Transactions',
          description: 'No new transactions found in the selected period.',
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
  };

  const removeAccount = async (account: LinkedAccount) => {
    if (!confirm(`Remove ${account.institutionName} (${account.mask})?`)) {
      return;
    }

    try {
      const plaidService = createPlaidService();
      if (plaidService) {
        await plaidService.removeItem(account.accessToken);
      }

      const updated = linkedAccounts.filter(acc => acc.id !== account.id);
      setLinkedAccounts(updated);
      localStorage.setItem('plaid.linkedAccounts', JSON.stringify(updated));

      toast({
        title: 'Account Removed',
        description: `${account.institutionName} has been disconnected`,
      });
    } catch (error) {
      logger.error('Failed to remove account:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove account connection',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Bank Connections
        </CardTitle>
        <CardDescription>
          Connect your bank accounts to automatically import transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!process.env.NEXT_PUBLIC_PLAID_CLIENT_ID && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Plaid integration requires API credentials. Add NEXT_PUBLIC_PLAID_CLIENT_ID 
              and PLAID_SECRET to your environment variables.
            </AlertDescription>
          </Alert>
        )}

        {linkedAccounts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Connected Accounts</h4>
            {linkedAccounts.map(account => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{account.institutionName}</p>
                  <p className="text-sm text-muted-foreground">
                    {account.accountName} (...{account.mask})
                  </p>
                  {account.lastSync && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {new Date(account.lastSync).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncTransactions(account.accessToken)}
                    disabled={isSyncing === account.accessToken}
                  >
                    {isSyncing === account.accessToken ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeAccount(account)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={() => (linkToken ? open() : createLinkToken())}
            disabled={!ready || isLoading}
            className="w-full"
          >
            <Link className="h-4 w-4 mr-2" />
            {isLoading ? 'Connecting...' : 'Connect Bank Account'}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">How it works:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
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