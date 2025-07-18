import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyCategoryRules, loadCategoryRules } from '@utils/categoryRules';
import {
  categorizeTransactionWithAI,
  categorizeTransactionsBatchWithAI,
  getSmartCategorizationSettings,
} from '@utils/smartCategorization';
import { createLLMService, TransactionForCategorization } from '@services/llmService';
import { CategoryRule } from '@components/CategoryRules';

// Mock dependencies
vi.mock('@services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock environment variables
const originalEnv = process.env;

// Mock fetch for OpenAI API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to mock OpenAI responses
const mockOpenAIResponse = (category: string, confidence: number) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            category,
            confidence,
            reasoning: 'Based on transaction description',
          }),
        },
      },
    ],
  }),
});

describe('Categorization Pipeline Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rule Priority System', () => {
    test('should apply rules in priority order (highest first)', () => {
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'coffee',
          category: 'Dining Out',
          matchType: 'contains',
          priority: 1,
          enabled: true,
        },
        {
          id: '2',
          pattern: 'starbucks coffee',
          category: 'Coffee Shops',
          matchType: 'contains',
          priority: 5,
          enabled: true,
        },
        {
          id: '3',
          pattern: 'starbucks',
          category: 'Entertainment',
          matchType: 'contains',
          priority: 3,
          enabled: true,
        },
      ];

      const result = applyCategoryRules('Purchase at Starbucks Coffee Shop', rules);
      expect(result).toBe('Coffee Shops'); // Highest priority (5) should win
    });

    test('should skip disabled rules', () => {
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'walmart',
          category: 'Groceries',
          matchType: 'contains',
          priority: 10,
          enabled: false, // Disabled
        },
        {
          id: '2',
          pattern: 'walmart',
          category: 'Shopping',
          matchType: 'contains',
          priority: 5,
          enabled: true,
        },
      ];

      const result = applyCategoryRules('Walmart Purchase', rules);
      expect(result).toBe('Shopping'); // Should use enabled rule
    });

    test('should handle all match types correctly', () => {
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'uber',
          category: 'Transportation',
          matchType: 'startsWith',
          priority: 1,
          enabled: true,
        },
        {
          id: '2',
          pattern: '.com',
          category: 'Online Shopping',
          matchType: 'endsWith',
          priority: 1,
          enabled: true,
        },
        {
          id: '3',
          pattern: '^\\d{4}-\\d{4}$',
          category: 'Phone Bill',
          matchType: 'regex',
          priority: 1,
          enabled: true,
        },
      ];

      expect(applyCategoryRules('Uber ride to airport', rules)).toBe('Transportation');
      expect(applyCategoryRules('Purchase from amazon.com', rules)).toBe('Online Shopping');
      expect(applyCategoryRules('1234-5678', rules)).toBe('Phone Bill');
      expect(applyCategoryRules('Random transaction', rules)).toBeNull();
    });

    test('should handle invalid regex gracefully', () => {
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: '[invalid regex',
          category: 'Test',
          matchType: 'regex',
          priority: 1,
          enabled: true,
        },
      ];

      const result = applyCategoryRules('Test transaction', rules);
      expect(result).toBeNull(); // Should fail gracefully
    });
  });

  describe('AI Categorization', () => {
    beforeEach(() => {
      // Clear environment variable so localStorage takes precedence
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should categorize with AI when enabled and confidence is high', async () => {
      // Setup AI categorization settings
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');
      localStorageMock.setItem('smartCategorization.model', 'gpt-3.5-turbo');

      mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Groceries', 0.85));

      const transaction: TransactionForCategorization = {
        description: 'Whole Foods Market',
        amount: -125.5,
        date: '2024-01-15',
        existingCategory: 'Uncategorized',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Groceries');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    test('should use fallback when AI confidence is too low', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Groceries', 0.45)); // Low confidence

      const transaction: TransactionForCategorization = {
        description: 'Ambiguous Store',
        amount: -50.0,
        date: '2024-01-15',
        existingCategory: 'Shopping',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Shopping'); // Should use existing category
    });

    test('should handle API errors gracefully', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25.0,
        date: '2024-01-15',
        existingCategory: 'Other Expenses',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Other Expenses'); // Should use fallback
    });

    test('should skip AI when disabled', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'false');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25.0,
        date: '2024-01-15',
        existingCategory: 'Manual Category',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Manual Category');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should skip AI when API key is missing', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      // No API key set

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25.0,
        date: '2024-01-15',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Uncategorized');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Batch Categorization', () => {
    const mockBatchOpenAIResponse = (results: Array<{ category: string; confidence: number }>) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(
                results.map((r, i) => ({
                  index: i + 1,
                  category: r.category,
                  confidence: r.confidence,
                })),
              ),
            },
          },
        ],
      }),
    });

    test('should categorize multiple transactions in batches', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const transactions: TransactionForCategorization[] = Array.from({ length: 25 }, (_, i) => ({
        description: `Transaction ${i + 1}`,
        amount: -(i + 1) * 10,
        date: '2024-01-15',
        existingCategory: 'Uncategorized',
      }));

      // Mock responses for 3 batches (10, 10, 5 transactions)
      mockFetch
        .mockResolvedValueOnce(
          mockBatchOpenAIResponse(
            Array.from({ length: 10 }, () => ({ category: 'Shopping', confidence: 0.8 })),
          ),
        )
        .mockResolvedValueOnce(
          mockBatchOpenAIResponse(
            Array.from({ length: 10 }, () => ({ category: 'Entertainment', confidence: 0.75 })),
          ),
        )
        .mockResolvedValueOnce(
          mockBatchOpenAIResponse(
            Array.from({ length: 5 }, () => ({ category: 'Dining Out', confidence: 0.9 })),
          ),
        );

      const results = await categorizeTransactionsBatchWithAI(transactions);

      expect(results).toHaveLength(25);
      expect(results.slice(0, 10).every((r) => r === 'Shopping')).toBe(true);
      expect(results.slice(10, 20).every((r) => r === 'Entertainment')).toBe(true);
      expect(results.slice(20, 25).every((r) => r === 'Dining Out')).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 3 batches
    });

    test('should handle batch API errors gracefully', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const transactions: TransactionForCategorization[] = [
        {
          description: 'Transaction 1',
          amount: -50,
          date: '2024-01-15',
          existingCategory: 'Fallback 1',
        },
        {
          description: 'Transaction 2',
          amount: -75,
          date: '2024-01-15',
          existingCategory: 'Fallback 2',
        },
      ];

      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const results = await categorizeTransactionsBatchWithAI(transactions);

      expect(results).toEqual(['Fallback 1', 'Fallback 2']);
    });

    test('should filter results by confidence threshold', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const transactions: TransactionForCategorization[] = [
        {
          description: 'High confidence transaction',
          amount: -100,
          date: '2024-01-15',
          existingCategory: 'Original 1',
        },
        {
          description: 'Low confidence transaction',
          amount: -50,
          date: '2024-01-15',
          existingCategory: 'Original 2',
        },
      ];

      mockFetch.mockResolvedValueOnce(
        mockBatchOpenAIResponse([
          { category: 'Groceries', confidence: 0.9 }, // High confidence
          { category: 'Unknown', confidence: 0.3 }, // Low confidence
        ]),
      );

      const results = await categorizeTransactionsBatchWithAI(transactions);

      expect(results).toEqual(['Groceries', 'Original 2']); // Low confidence uses original
    });
  });

  describe('Complete Pipeline Integration', () => {
    test('should follow correct categorization priority: custom rules → AI → built-in', async () => {
      // Setup custom rules
      const customRules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'AMZN',
          category: 'Amazon Shopping',
          matchType: 'contains',
          priority: 10,
          enabled: true,
        },
      ];

      localStorageMock.setItem('budget.categoryRules', JSON.stringify(customRules));
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      // Test 1: Custom rule should take precedence
      const amazonTransaction = 'AMZN Purchase Electronics';
      const customResult = applyCategoryRules(amazonTransaction, customRules);
      expect(customResult).toBe('Amazon Shopping');

      // Test 2: AI categorization when no custom rule matches
      mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Electronics', 0.85));

      const electronicsTransaction: TransactionForCategorization = {
        description: 'Best Buy Electronics Store',
        amount: -299.99,
        date: '2024-01-15',
      };

      const aiResult = await categorizeTransactionWithAI(electronicsTransaction);
      expect(aiResult).toBe('Electronics');

      // Test 3: Fallback to built-in when AI confidence is low
      mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Unclear', 0.4));

      const unclearTransaction: TransactionForCategorization = {
        description: 'Random Store 12345',
        amount: -50,
        date: '2024-01-15',
        existingCategory: 'Other Expenses',
      };

      const fallbackResult = await categorizeTransactionWithAI(unclearTransaction);
      expect(fallbackResult).toBe('Other Expenses');
    });

    test('should handle the complete categorization flow with custom categories', async () => {
      const customCategories = ['Subscriptions', 'Pet Supplies', 'Home Improvement'];

      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Subscriptions', 0.95));

      const transaction: TransactionForCategorization = {
        description: 'Netflix Monthly Subscription',
        amount: -15.99,
        date: '2024-01-15',
      };

      const result = await categorizeTransactionWithAI(transaction, customCategories);
      expect(result).toBe('Subscriptions');

      // Verify the API was called with custom categories
      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);
      expect(requestBody.messages[1].content).toContain('Subscriptions');
      expect(requestBody.messages[1].content).toContain('Pet Supplies');
      expect(requestBody.messages[1].content).toContain('Home Improvement');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle very large transaction descriptions', () => {
      const longDescription = 'A'.repeat(1000) + ' coffee shop ' + 'B'.repeat(1000);
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'coffee shop',
          category: 'Dining Out',
          matchType: 'contains',
          priority: 1,
          enabled: true,
        },
      ];

      const result = applyCategoryRules(longDescription, rules);
      expect(result).toBe('Dining Out');
    });

    test('should handle special characters in patterns', () => {
      const rules: CategoryRule[] = [
        {
          id: '1',
          pattern: 'AT&T',
          category: 'Phone Bill',
          matchType: 'contains',
          priority: 1,
          enabled: true,
        },
        {
          id: '2',
          pattern: '$PAYMENT$',
          category: 'Payment',
          matchType: 'contains',
          priority: 1,
          enabled: true,
        },
      ];

      expect(applyCategoryRules('AT&T Wireless Bill', rules)).toBe('Phone Bill');
      expect(applyCategoryRules('$PAYMENT$ Received', rules)).toBe('Payment');
    });

    test('should handle empty or null values gracefully', async () => {
      const rules: CategoryRule[] = [];

      // Empty description
      expect(applyCategoryRules('', rules)).toBeNull();

      // Empty rules
      expect(applyCategoryRules('Test transaction', [])).toBeNull();

      // AI categorization with missing description
      const transaction: TransactionForCategorization = {
        description: '',
        amount: -50,
        date: '2024-01-15',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Uncategorized');
    });

    test('should handle malformed AI responses', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      // Mock malformed response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'This is not valid JSON',
              },
            },
          ],
        }),
      });

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25,
        date: '2024-01-15',
        existingCategory: 'Fallback Category',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Fallback Category'); // Should handle gracefully
    });

    test('should measure categorization performance for large batches', async () => {
      const largeRuleSet: CategoryRule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        pattern: `pattern${i}`,
        category: `Category${i}`,
        matchType: 'contains' as const,
        priority: i,
        enabled: true,
      }));

      const startTime = performance.now();

      // Test 1000 transactions
      for (let i = 0; i < 1000; i++) {
        applyCategoryRules(`Transaction with pattern50 in it`, largeRuleSet);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 1000 categorizations in under 100ms
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle API rate limiting', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Too Many Requests',
        status: 429,
      });

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -50,
        date: '2024-01-15',
        existingCategory: 'Manual Category',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Manual Category'); // Should fallback gracefully
    });

    test('should handle network timeouts', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      // Mock a timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100)),
      );

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -50,
        date: '2024-01-15',
        existingCategory: 'Timeout Fallback',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Timeout Fallback');
    });

    test('should handle invalid API keys', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'invalid-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        status: 401,
      });

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -50,
        date: '2024-01-15',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe('Uncategorized');
    });
  });

  describe('Confidence Thresholds', () => {
    test('should respect confidence threshold of 0.6', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const testCases = [
        { confidence: 0.9, shouldUseAI: true },
        { confidence: 0.7, shouldUseAI: true },
        { confidence: 0.6, shouldUseAI: true },
        { confidence: 0.59, shouldUseAI: false },
        { confidence: 0.3, shouldUseAI: false },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce(mockOpenAIResponse('AI Category', testCase.confidence));

        const transaction: TransactionForCategorization = {
          description: `Test with confidence ${testCase.confidence}`,
          amount: -50,
          date: '2024-01-15',
          existingCategory: 'Original Category',
        };

        const result = await categorizeTransactionWithAI(transaction);

        if (testCase.shouldUseAI) {
          expect(result).toBe('AI Category');
        } else {
          expect(result).toBe('Original Category');
        }
      }
    });
  });

  describe('Transaction Format Variations', () => {
    test('should handle various transaction description formats', async () => {
      const formatTests = [
        {
          description: 'POS DEBIT WALMART SUPERCENTER #1234',
          expectedPattern: 'walmart',
          expectedCategory: 'Groceries',
        },
        {
          description: 'ONLINE TRANSFER TO SAVINGS ACCOUNT',
          expectedPattern: 'transfer.*savings',
          expectedCategory: 'Transfers',
        },
        {
          description: 'CHECK #1234',
          expectedPattern: '^CHECK #\\d+',
          expectedCategory: 'Checks',
        },
        {
          description: 'ATM WITHDRAWAL - CHASE BANK',
          expectedPattern: 'ATM WITHDRAWAL',
          expectedCategory: 'Cash & ATM',
        },
      ];

      const rules: CategoryRule[] = formatTests.map((test, i) => ({
        id: `${i}`,
        pattern: test.expectedPattern,
        category: test.expectedCategory,
        matchType:
          test.expectedPattern.includes('.*') || test.expectedPattern.startsWith('^')
            ? 'regex'
            : 'contains',
        priority: 1,
        enabled: true,
      }));

      for (const test of formatTests) {
        const result = applyCategoryRules(test.description, rules);
        expect(result).toBe(test.expectedCategory);
      }
    });

    test('should handle transactions with special amounts', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');

      const specialAmounts = [
        { amount: 0, description: 'Zero amount transaction' },
        { amount: 0.01, description: 'Penny transaction' },
        { amount: -0.01, description: 'Negative penny' },
        { amount: 999999.99, description: 'Large transaction' },
        { amount: -999999.99, description: 'Large negative transaction' },
      ];

      for (const trans of specialAmounts) {
        mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Special Transaction', 0.8));

        const transaction: TransactionForCategorization = {
          description: trans.description,
          amount: trans.amount,
          date: '2024-01-15',
        };

        const result = await categorizeTransactionWithAI(transaction);
        expect(result).toBe('Special Transaction');
      }
    });
  });
});
