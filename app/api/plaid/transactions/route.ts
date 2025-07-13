import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

import { logger } from '@services/logger';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(request: NextRequest) {
  try {
    const { access_token, start_date, end_date, account_ids } = await request.json();

    if (!access_token || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Access token, start date, and end date are required' },
        { status: 400 },
      );
    }

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date,
      end_date,
      options: {
        account_ids: account_ids,
        count: 500,
        offset: 0,
      },
    });

    return NextResponse.json({
      accounts: response.data.accounts,
      transactions: response.data.transactions,
      total_transactions: response.data.total_transactions,
    });
  } catch (error: unknown) {
    logger.error('Error getting transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get transactions';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
