import { logger } from './logger';

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

export class LLMService {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-mini';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 150;
    
    logger.info('LLM Service initialized', { 
      model: this.model,
      hasApiKey: !!this.apiKey,
      temperature: this.temperature 
    });
  }

  async categorizeTransaction(
    transaction: TransactionForCategorization,
    customCategories?: string[],
  ): Promise<CategorySuggestion> {
    try {
      const categories = customCategories || [
        ...DEFAULT_CATEGORIES.income,
        ...DEFAULT_CATEGORIES.expense,
      ];

      const prompt = this.buildCategorizationPrompt(transaction, categories);

      logger.info('Sending categorization request to OpenAI', {
        model: this.model,
        transactionDescription: transaction.description.substring(0, 50) + '...'
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          if (typeof response.text === 'function') {
            errorBody = await response.text();
          }
        } catch (e) {
          // Ignore text parsing errors
        }
        
        logger.error('OpenAI API error', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody ? errorBody.substring(0, 200) : 'No error body available'
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const result = this.parseCategorizationResponse(data.choices[0].message.content);

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
  }

  async categorizeTransactionsBatch(
    transactions: TransactionForCategorization[],
    customCategories?: string[],
  ): Promise<CategorySuggestion[]> {
    try {
      const categories = customCategories || [
        ...DEFAULT_CATEGORIES.income,
        ...DEFAULT_CATEGORIES.expense,
      ];

      const prompt = this.buildBatchCategorizationPrompt(transactions, categories);

      logger.info('Sending batch categorization request to OpenAI', {
        model: this.model,
        transactionCount: transactions.length,
        batchSize: transactions.length
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
          temperature: this.temperature,
          max_tokens: this.maxTokens * transactions.length,
        }),
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          if (typeof response.text === 'function') {
            errorBody = await response.text();
          }
        } catch (e) {
          // Ignore text parsing errors
        }
        
        logger.error('OpenAI API error', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody ? errorBody.substring(0, 200) : 'No error body available'
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results = this.parseBatchCategorizationResponse(data.choices[0].message.content);

      return results;
    } catch (error) {
      logger.error('Error categorizing transactions batch:', error);
      throw error;
    }
  }

  async suggestCustomCategories(transactions: TransactionForCategorization[]): Promise<string[]> {
    try {
      const prompt = `
Based on these transactions, suggest additional categories that would be useful:

${transactions.map((t) => `- ${t.description} ($${Math.abs(t.amount)})`).join('\n')}

Current categories: ${[...DEFAULT_CATEGORIES.income, ...DEFAULT_CATEGORIES.expense].join(', ')}

Suggest up to 5 new categories that would better organize these transactions. Return only the category names, one per line.
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
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
        }),
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          if (typeof response.text === 'function') {
            errorBody = await response.text();
          }
        } catch (e) {
          // Ignore text parsing errors
        }
        
        logger.error('OpenAI API error', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorBody ? errorBody.substring(0, 200) : 'No error body available'
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const suggestions = data.choices[0].message.content
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.trim());

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting custom categories:', error);
      return [];
    }
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
      // Fallback parsing if JSON fails
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

// Factory function to create LLM service instance
export function createLLMService(apiKey?: string, model?: string): LLMService | null {
  // Priority: provided apiKey > environment variable > localStorage
  const key = apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
    (typeof window !== 'undefined' ? localStorage.getItem('smartCategorization.apiKey') : null) || '';

  if (!key) {
    logger.warn('OpenAI API key not configured');
    return null;
  }

  // Get model from parameter, environment, or localStorage
  const selectedModel = model || 
    (typeof window !== 'undefined' ? localStorage.getItem('smartCategorization.model') : null) ||
    'gpt-4o-mini';

  return new LLMService({ 
    apiKey: key,
    model: selectedModel 
  });
}
