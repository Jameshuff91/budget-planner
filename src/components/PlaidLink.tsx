'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface PlaidLinkProps {
  onSuccess?: () => void;
  buttonText?: string;
  className?: string;
}

export function PlaidLink({ onSuccess, buttonText = 'Connect Bank Account', className }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const createToken = async () => {
      try {
        const response = await apiService.createLinkToken();
        
        if (response.error) {
          toast({
            title: 'Error',
            description: 'Failed to initialize bank connection',
            variant: 'destructive',
          });
          return;
        }

        if (response.data) {
          setLinkToken(response.data.link_token);
        }
      } catch (error) {
        console.error('Error creating link token:', error);
        toast({
          title: 'Error',
          description: 'Failed to initialize bank connection',
          variant: 'destructive',
        });
      }
    };

    if (apiService.isAuthenticated()) {
      createToken();
    }
  }, [toast]);

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      try {
        const response = await apiService.exchangePublicToken(publicToken);
        
        if (response.error) {
          toast({
            title: 'Error',
            description: 'Failed to connect bank account',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Success',
          description: `Connected to ${response.data?.institution_name || 'bank'}`,
        });

        // Sync transactions after successful connection
        await apiService.syncTransactions();
        
        onSuccess?.();
      } catch (error) {
        console.error('Error exchanging public token:', error);
        toast({
          title: 'Error',
          description: 'Failed to connect bank account',
          variant: 'destructive',
        });
      }
    },
    [onSuccess, toast]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err, metadata) => {
      if (err) {
        console.error('Plaid Link error:', err);
      }
    },
  });

  const handleClick = () => {
    if (!apiService.isAuthenticated()) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to connect your bank account',
        variant: 'destructive',
      });
      return;
    }
    open();
  };

  return (
    <Button
      onClick={handleClick}
      disabled={!ready}
      className={className}
    >
      {ready ? buttonText : 'Loading...'}
    </Button>
  );
}