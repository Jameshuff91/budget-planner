import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { Configuration, PlaidEnvironments } from 'plaid';

import { logger } from '@services/logger';
import { getSyncService } from '@services/syncService';

// Initialize Plaid client configuration (available for future use)
const _configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

// Keep configuration reference to avoid unused variable warning
void _configuration;

// PlaidApi configuration available for future use
// const plaidClient = new PlaidApi(configuration);

// Webhook signature verification
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Event processing queue (in-memory for now, could be Redis/database later)
const eventQueue: Array<{
  id: string;
  event: Record<string, unknown>;
  timestamp: number;
  processed: boolean;
  retryCount: number;
}> = [];

// Process webhook events
async function processWebhookEvent(event: Record<string, unknown>) {
  const { webhook_type, webhook_code, item_id } = event;

  logger.info(`Processing webhook event: ${webhook_type} - ${webhook_code}`, {
    item_id,
    webhook_type,
    webhook_code,
  });

  try {
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionEvent(event);
        break;
      case 'ITEM':
        await handleItemEvent(event);
        break;
      case 'ERROR':
        await handleErrorEvent(event);
        break;
      default:
        logger.warn(`Unhandled webhook type: ${webhook_type}`);
    }
  } catch (error) {
    logger.error('Error processing webhook event:', error);
    throw error;
  }
}

// Handle transaction-related events
async function handleTransactionEvent(event: Record<string, unknown>) {
  const { webhook_code, item_id, new_transactions, removed_transactions } = event;

  switch (webhook_code) {
    case 'TRANSACTIONS_ADDED':
      logger.info(`${new_transactions} new transactions added for item ${String(item_id)}`);
      await syncTransactionsForItem(String(item_id));
      break;

    case 'TRANSACTIONS_MODIFIED':
      logger.info(`Transactions modified for item ${String(item_id)}`);
      await syncTransactionsForItem(String(item_id));
      break;

    case 'TRANSACTIONS_REMOVED':
      logger.info(`${removed_transactions} transactions removed for item ${String(item_id)}`);
      await handleRemovedTransactions(String(item_id), removed_transactions as unknown[]);
      break;

    case 'TRANSACTIONS_REFRESHED':
      logger.info(`Transactions refreshed for item ${String(item_id)}`);
      await syncTransactionsForItem(String(item_id));
      break;

    default:
      logger.warn(`Unhandled transaction webhook code: ${webhook_code}`);
  }
}

// Handle item-related events
async function handleItemEvent(event: Record<string, unknown>) {
  const { webhook_code, item_id, error } = event;

  switch (webhook_code) {
    case 'ITEM_LOGIN_REQUIRED':
      logger.warn(`Item ${String(item_id)} requires re-authentication`);
      // TODO: Notify user to re-authenticate
      break;

    case 'ITEM_ERROR':
      logger.error(`Item error for ${String(item_id)}:`, error);
      // TODO: Handle item errors
      break;

    default:
      logger.warn(`Unhandled item webhook code: ${webhook_code}`);
  }
}

// Handle error events
async function handleErrorEvent(event: Record<string, unknown>) {
  const { error_type, error_code, error_message, item_id } = event;

  logger.error(`Webhook error for item ${String(item_id)}:`, {
    error_type,
    error_code,
    error_message,
  });

  // TODO: Implement error handling based on error type
}

// Sync transactions for a specific item using the sync endpoint
async function syncTransactionsForItem(itemId: string) {
  try {
    logger.info(`Starting sync for item ${itemId}`);
    const syncService = getSyncService();
    if (!syncService) {
      logger.error('Sync service not available in server environment');
      throw new Error('Sync service not available');
    }
    await syncService.syncTransactions(itemId);
    logger.info(`Completed sync for item ${itemId}`);
  } catch (error) {
    logger.error(`Error syncing transactions for item ${itemId}:`, error);
    throw error;
  }
}

// Handle removed transactions
async function handleRemovedTransactions(itemId: string, removedTransactions: unknown[]) {
  try {
    logger.info(
      `Handling ${removedTransactions?.length || 0} removed transactions for item ${itemId}`,
    );

    // TODO: Remove transactions from local storage
    // This would typically:
    // 1. Get transaction IDs from the webhook
    // 2. Remove from IndexedDB
    // 3. Update UI if needed

    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    logger.error(`Error handling removed transactions for item ${itemId}:`, error);
    throw error;
  }
}

// Add event to processing queue
function queueEvent(event: Record<string, unknown>) {
  const queueItem = {
    id: crypto.randomUUID(),
    event,
    timestamp: Date.now(),
    processed: false,
    retryCount: 0,
  };

  eventQueue.push(queueItem);

  // Process immediately (in production, this might be handled by a background worker)
  processQueuedEvent(queueItem.id);
}

// Process queued event with retry logic
async function processQueuedEvent(eventId: string) {
  const queueItem = eventQueue.find((item) => item.id === eventId);
  if (!queueItem || queueItem.processed) {
    return;
  }

  try {
    await processWebhookEvent(queueItem.event);
    queueItem.processed = true;
    logger.info(`Successfully processed webhook event ${eventId}`);
  } catch (error) {
    queueItem.retryCount++;
    logger.error(
      `Failed to process webhook event ${eventId} (attempt ${queueItem.retryCount}):`,
      error,
    );

    // Retry logic with exponential backoff
    if (queueItem.retryCount < 3) {
      const delay = Math.pow(2, queueItem.retryCount) * 1000; // 2s, 4s, 8s
      setTimeout(() => processQueuedEvent(eventId), delay);
    } else {
      logger.error(`Max retries exceeded for webhook event ${eventId}`);
      // TODO: Move to dead letter queue
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('plaid-verification') || '';

    // Verify webhook signature
    const webhookSecret = process.env.PLAID_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('PLAID_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      logger.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Log the received event
    logger.info('Received Plaid webhook:', {
      webhook_type: event.webhook_type,
      webhook_code: event.webhook_code,
      item_id: event.item_id,
    });

    // Queue the event for processing
    queueEvent(event);

    // Return success immediately (async processing)
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logger.error('Error processing Plaid webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process webhook';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    queueSize: eventQueue.length,
    pendingEvents: eventQueue.filter((item) => !item.processed).length,
  });
}
