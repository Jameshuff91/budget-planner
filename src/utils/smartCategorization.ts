import { createLLMService, TransactionForCategorization } from '@services/llmService';
import { logger } from '@services/logger';

export interface SmartCategorizationSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
}

export function getSmartCategorizationSettings(): SmartCategorizationSettings {
  return {
    enabled: localStorage.getItem('smartCategorization.enabled') === 'true',
    apiKey: localStorage.getItem('smartCategorization.apiKey') || '',
    model: localStorage.getItem('smartCategorization.model') || 'gpt-3.5-turbo',
  };
}

export async function categorizeTransactionWithAI(
  transaction: TransactionForCategorization,
  customCategories?: string[],
): Promise<string> {
  try {
    const settings = getSmartCategorizationSettings();

    if (!settings.enabled || !settings.apiKey) {
      return transaction.existingCategory || 'Uncategorized';
    }

    const llmService = createLLMService(settings.apiKey);
    if (!llmService) {
      return transaction.existingCategory || 'Uncategorized';
    }

    const result = await llmService.categorizeTransaction(transaction, customCategories);

    // Only use AI suggestion if confidence is high enough
    if (result.confidence >= 0.6) {
      logger.info(
        `AI categorized "${transaction.description}" as "${result.category}" with ${(result.confidence * 100).toFixed(0)}% confidence`,
      );
      return result.category;
    } else {
      logger.info(
        `AI categorization confidence too low for "${transaction.description}" (${(result.confidence * 100).toFixed(0)}%), using default`,
      );
      return transaction.existingCategory || 'Uncategorized';
    }
  } catch (error) {
    logger.error('Error during AI categorization:', error);
    return transaction.existingCategory || 'Uncategorized';
  }
}

export async function categorizeTransactionsBatchWithAI(
  transactions: TransactionForCategorization[],
  customCategories?: string[],
): Promise<string[]> {
  try {
    const settings = getSmartCategorizationSettings();

    if (!settings.enabled || !settings.apiKey) {
      return transactions.map((t) => t.existingCategory || 'Uncategorized');
    }

    const llmService = createLLMService(settings.apiKey);
    if (!llmService) {
      return transactions.map((t) => t.existingCategory || 'Uncategorized');
    }

    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    const results: string[] = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      try {
        const batchResults = await llmService.categorizeTransactionsBatch(batch, customCategories);

        // Map results back to transactions
        for (let j = 0; j < batch.length; j++) {
          const result = batchResults[j];
          if (result && result.confidence >= 0.6) {
            results.push(result.category);
          } else {
            results.push(batch[j].existingCategory || 'Uncategorized');
          }
        }
      } catch (error) {
        logger.error(`Error categorizing batch ${i / batchSize + 1}:`, error);
        // Fall back to default categories for this batch
        for (const transaction of batch) {
          results.push(transaction.existingCategory || 'Uncategorized');
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('Error during batch AI categorization:', error);
    return transactions.map((t) => t.existingCategory || 'Uncategorized');
  }
}
