import { apiService } from './api';
import { logger } from './logger';

export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  redirectUri?: string;
}

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
}

export interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  category: string[];
  pending: boolean;
  paymentChannel: string;
}

export interface PlaidInstitution {
  institutionId: string;
  name: string;
  logo?: string;
  primaryColor?: string;
}

export class PlaidService {
  private config: PlaidConfig;
  private baseUrl: string;

  constructor(config: PlaidConfig) {
    this.config = config;
    this.baseUrl = this.getBaseUrl(config.environment);
  }

  private getBaseUrl(environment: string): string {
    switch (environment) {
      case 'sandbox':
        return 'https://sandbox.plaid.com';
      case 'development':
        return 'https://development.plaid.com';
      case 'production':
        return 'https://production.plaid.com';
      default:
        return 'https://sandbox.plaid.com';
    }
  }

  /**
   * Create a link token for Plaid Link initialization
   */
  async createLinkToken(userId: string, _products: string[] = ['transactions']): Promise<string> {
    try {
      const response = await apiService.createLinkToken();

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!.link_token;
    } catch (error) {
      logger.error('Error creating Plaid link token:', error);
      throw error;
    }
  }

  /**
   * Exchange public token for access token
   */
  async exchangePublicToken(publicToken: string): Promise<string> {
    try {
      const response = await apiService.exchangePublicToken(publicToken);

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!.item_id;
    } catch (error) {
      logger.error('Error exchanging public token:', error);
      throw error;
    }
  }

  /**
   * Get accounts associated with an access token
   */
  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    try {
      const response = await fetch('/api/plaid/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get accounts');
      }

      const data = await response.json();
      return data.accounts;
    } catch (error) {
      logger.error('Error getting Plaid accounts:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a date range
   */
  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
    accountIds?: string[],
  ): Promise<PlaidTransaction[]> {
    try {
      const response = await fetch('/api/plaid/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          account_ids: accountIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get transactions');
      }

      const data = await response.json();
      return data.transactions;
    } catch (error) {
      logger.error('Error getting Plaid transactions:', error);
      throw error;
    }
  }

  /**
   * Sync transactions using the newer transactions/sync endpoint
   */
  async syncTransactions(
    accessToken: string,
    cursor?: string,
  ): Promise<{
    added: PlaidTransaction[];
    modified: PlaidTransaction[];
    removed: string[];
    nextCursor: string;
    hasMore: boolean;
  }> {
    try {
      const response = await fetch('/api/plaid/transactions/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          cursor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync transactions');
      }

      const data = await response.json();
      return {
        added: data.added,
        modified: data.modified,
        removed: data.removed,
        nextCursor: data.next_cursor,
        hasMore: data.has_more,
      };
    } catch (error) {
      logger.error('Error syncing Plaid transactions:', error);
      throw error;
    }
  }

  /**
   * Get institution information
   */
  async getInstitution(institutionId: string): Promise<PlaidInstitution> {
    try {
      const response = await fetch('/api/plaid/institutions/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          institution_id: institutionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get institution');
      }

      const data = await response.json();
      return data.institution;
    } catch (error) {
      logger.error('Error getting institution:', error);
      throw error;
    }
  }

  /**
   * Convert Plaid transaction to our transaction format
   */
  convertToTransaction(plaidTx: PlaidTransaction): {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    merchantName?: string;
    pending: boolean;
  } {
    // Plaid amounts are positive for debits (expenses) and negative for credits (income)
    const amount = Math.abs(plaidTx.amount);
    const type = plaidTx.amount > 0 ? 'expense' : 'income';

    // Use Plaid's category hierarchy
    const category =
      plaidTx.category && plaidTx.category.length > 0
        ? plaidTx.category[plaidTx.category.length - 1] // Use most specific category
        : 'Uncategorized';

    return {
      date: plaidTx.date,
      description: plaidTx.merchantName || plaidTx.name,
      amount,
      type,
      category,
      merchantName: plaidTx.merchantName,
      pending: plaidTx.pending,
    };
  }

  /**
   * Remove an item (unlink bank account)
   */
  async removeItem(accessToken: string): Promise<void> {
    try {
      const response = await fetch('/api/plaid/item/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }
    } catch (error) {
      logger.error('Error removing Plaid item:', error);
      throw error;
    }
  }
}

// Factory function to create Plaid service instance
export function createPlaidService(): PlaidService | null {
  const clientId = process.env.NEXT_PUBLIC_PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const environment = (process.env.NEXT_PUBLIC_PLAID_ENV || 'sandbox') as
    | 'sandbox'
    | 'development'
    | 'production';

  if (!clientId || !secret) {
    logger.warn('Plaid credentials not configured');
    return null;
  }

  return new PlaidService({
    clientId,
    secret,
    environment,
  });
}
