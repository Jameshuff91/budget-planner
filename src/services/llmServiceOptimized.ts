import { logger } from './logger';
import { getPerformanceMonitor } from '@utils/performance';

export interface TransactionForCategorization {
  description: string;
  amount: number;
  date: string;
  existingCategory?: string;
}

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning?: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CATEGORIES = {
  income: ['Salary', 'Investment Income', 'Refunds', 'Other Income'],
  expense: [
    'Rent',
    'Groceries',
    'Utilities',
    'Transportation',
    'Entertainment',
    'Healthcare',
    'Shopping',
    'Education',
    'Personal Care',
    'Insurance',
    'Credit Card Payment',
    'Other Expenses',
  ],
};

// Cached LLM service instance
let llmServiceInstance: LLMService | null = null;
let apiKeyCache: string | null = null;

export class LLMService {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-3.5-turbo';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 150;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async categorizeTransaction(
    transaction: TransactionForCategorization,
    customCategories?: string[],
  ): Promise<CategorySuggestion> {
    const monitor = getPerformanceMonitor();

    return monitor.measureAsync('llm_categorize_single', async () => {
      try {
        const categories = customCategories || [
          ...DEFAULT_CATEGORIES.income,
          ...DEFAULT_CATEGORIES.expense,
        ];

        const prompt = this.buildCategorizationPrompt(transaction, categories);
        const response = await this.makeAPIRequest({
          messages: [
            {
              role: 'system',
              content:
                'You are a financial transaction categorization assistant. Categorize transactions accurately based on their description and amount.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const result = this.parseCategorizationResponse(response);

        logger.info('Transaction categorized:', {
          description: transaction.description,
          suggestedCategory: result.category,
          confidence: result.confidence,
        });

        return result;
      } catch (error) {
        logger.error('Error categorizing transaction:', error);
        throw error;
      }
    });
  }

  async categorizeTransactionsBatch(
    transactions: TransactionForCategorization[],
    customCategories?: string[],
  ): Promise<CategorySuggestion[]> {
    const monitor = getPerformanceMonitor();

    return monitor.measureAsync('llm_categorize_batch', async () => {
      try {
        const categories = customCategories || [
          ...DEFAULT_CATEGORIES.income,
          ...DEFAULT_CATEGORIES.expense,
        ];

        const prompt = this.buildBatchCategorizationPrompt(transactions, categories);
        const response = await this.makeAPIRequest({
          messages: [
            {
              role: 'system',
              content:
                'You are a financial transaction categorization assistant. Categorize multiple transactions accurately and efficiently.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.maxTokens * transactions.length,
        });

        return this.parseBatchCategorizationResponse(response);
      } catch (error) {
        logger.error('Error categorizing transactions batch:', error);
        throw error;
      }
    });
  }

  async suggestCustomCategories(transactions: TransactionForCategorization[]): Promise<string[]> {
    const monitor = getPerformanceMonitor();

    return monitor.measureAsync('llm_suggest_categories', async () => {
      try {
        const prompt = `
Based on these transactions, suggest additional categories that would be useful:

${transactions.map((t) => `- ${t.description} ($${Math.abs(t.amount)})`).join('\n')}

Current categories: ${[...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.expense].join(', ')}

Suggest up to 5 new categories that would better organize these transactions. Return only the category names, one per line.
`;

        const response = await this.makeAPIRequest({
          messages: [
            {
              role: 'system',
              content: 'You are a financial advisor helping to organize transaction categories.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 100,
        });

        return response
          .split('\n')
          .filter((line: string) => line.trim())
          .map((line: string) => line.trim());
      } catch (error) {
        logger.error('Error suggesting custom categories:', error);
        return [];
      }
    });
  }

  /**
   * Make API request with proper error handling and caching
   */
  private async makeAPIRequest(requestBody: any): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        ...requestBody,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private buildCategorizationPrompt(
    transaction: TransactionForCategorization,
    categories: string[],
  ): string {
    return `
Categorize this financial transaction:

Description: ${transaction.description}
Amount: $${Math.abs(transaction.amount)} (${transaction.amount >= 0 ? 'income' : 'expense'})
Date: ${transaction.date}

Available categories:
${categories.join(', ')}

Respond in JSON format:
{
  "category": "selected category",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
  }

  private buildBatchCategorizationPrompt(
    transactions: TransactionForCategorization[],
    categories: string[],
  ): string {
    return `
Categorize these financial transactions:

${transactions
  .map(
    (t, i) => `
${i + 1}. Description: ${t.description}
   Amount: $${Math.abs(t.amount)} (${t.amount >= 0 ? 'income' : 'expense'})
   Date: ${t.date}
`,
  )
  .join('\n')}

Available categories:
${categories.join(', ')}

Respond with a JSON array where each object has:
{
  "index": transaction number,
  "category": "selected category",
  "confidence": 0.0-1.0
}`;
  }

  private parseCategorizationResponse(response: string): CategorySuggestion {
    try {
      const parsed = JSON.parse(response);
      return {
        category: parsed.category || 'Other Expenses',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning,
      };
    } catch {
      logger.warn('Failed to parse JSON response, using fallback parsing');
      return {
        category: 'Other Expenses',
        confidence: 0.3,
      };
    }
  }

  private parseBatchCategorizationResponse(response: string): CategorySuggestion[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.map((item: any) => ({
        category: item.category || 'Other Expenses',
        confidence: item.confidence || 0.5,
      }));
    } catch {
      logger.warn('Failed to parse batch JSON response');
      return [];
    }
  }
}

/**
 * Factory function to create LLM service instance with caching and lazy loading
 */
export async function createLLMService(apiKey?: string): Promise<LLMService | null> {
  const monitor = getPerformanceMonitor();

  return monitor.measureAsync('llm_service_init', async () => {
    const key = apiKey || getAPIKeyFromStorage();

    if (!key) {
      logger.warn('OpenAI API key not configured');
      return null;
    }

    // Return cached instance if API key hasn't changed
    if (llmServiceInstance && apiKeyCache === key) {
      return llmServiceInstance;
    }

    // Create new instance
    llmServiceInstance = new LLMService({ apiKey: key });
    apiKeyCache = key;

    return llmServiceInstance;
  });
}

/**
 * Get API key from localStorage or environment
 */
function getAPIKeyFromStorage(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('openai_api_key') || process.env.NEXT_PUBLIC_OPENAI_API_KEY || null;
  }
  return process.env.NEXT_PUBLIC_OPENAI_API_KEY || null;
}

/**
 * Update API key in localStorage and invalidate cache
 */
export function updateAPIKey(apiKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('openai_api_key', apiKey);
    // Invalidate cache
    llmServiceInstance = null;
    apiKeyCache = null;
  }
}

/**
 * Clear API key and invalidate cache
 */
export function clearAPIKey() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('openai_api_key');
    llmServiceInstance = null;
    apiKeyCache = null;
  }
}

/**
 * Check if LLM service is available
 */
export function isLLMServiceAvailable(): boolean {
  return !!getAPIKeyFromStorage();
}

/**
 * Preload LLM service for better performance
 */
export async function preloadLLMService() {
  const monitor = getPerformanceMonitor();

  await monitor.measureAsync('llm_service_preload', async () => {
    if (isLLMServiceAvailable()) {
      await createLLMService();
    }
  });
}
