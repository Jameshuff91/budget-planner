import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

import { logger } from '@/src/services/logger';

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
    const { public_token } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'Public token is required' }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    // In a real app, you would save the access_token securely associated with the user
    // For now, we'll return it to be stored in localStorage (not recommended for production)
    return NextResponse.json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (error: any) {
    logger.error('Error exchanging public token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to exchange public token' },
      { status: 500 }
    );
  }
}
