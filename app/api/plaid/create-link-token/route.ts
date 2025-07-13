import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

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
    const { user_id, products = ['transactions'] } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const productList = products.map((p: string) => p as Products);

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user_id,
      },
      client_name: 'Budget Planner',
      products: productList,
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL,
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    logger.error('Error creating Plaid link token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create link token';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
