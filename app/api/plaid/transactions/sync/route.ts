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
    const { access_token, cursor } = await request.json();

    if (!access_token) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    logger.info('Syncing transactions with cursor:', { cursor });

    const response = await plaidClient.transactionsSync({
      access_token,
      cursor: cursor || undefined,
      count: 500, // Maximum number of transactions to return
    });

    const { added, modified, removed, next_cursor, has_more, accounts } = response.data;

    logger.info('Transaction sync completed:', {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
      has_more,
    });

    return NextResponse.json({
      added,
      modified,
      removed,
      next_cursor,
      has_more,
      accounts,
    });
  } catch (error: unknown) {
    logger.error('Error syncing transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync transactions';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
