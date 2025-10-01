import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  categorizeTransactionWithAI,
  categorizeTransactionsBatchWithAI,
  getSmartCategorizationSettings,
  SmartCategorizationSettings,
} from '@utils/smartCategorization';
import type { TransactionForCategorization } from '@services/llmService';
import { createLLMService } from '@services/llmService';
import { logger } from '@services/logger';

// Mock dependencies
vi.mock('@services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@services/llmService', () => ({
  createLLMService: vi.fn(),
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

describe('Smart Categorization - getSmartCategorizationSettings', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset environment variable for each test
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return default settings when localStorage is empty', () => {
    const settings = getSmartCategorizationSettings();

    expect(settings).toEqual({
      enabled: false,
      apiKey: '',
      model: 'gpt-4o-mini',
    });
  });

  test('should load settings from localStorage', () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');
    localStorageMock.setItem('smartCategorization.model', 'gpt-4');

    const settings = getSmartCategorizationSettings();

    expect(settings).toEqual({
      enabled: true,
      apiKey: 'test-api-key',
      model: 'gpt-4',
    });
  });

  test('should handle partial settings in localStorage', () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'partial-key');
    // Missing model setting

    const settings = getSmartCategorizationSettings();

    expect(settings).toEqual({
      enabled: true,
      apiKey: 'partial-key',
      model: 'gpt-4o-mini', // Should use default
    });
  });

  test('should handle invalid boolean values gracefully', () => {
    localStorageMock.setItem('smartCategorization.enabled', 'invalid');

    const settings = getSmartCategorizationSettings();
    expect(settings.enabled).toBe(false); // Should default to false
  });

  test('should handle empty strings in localStorage', () => {
    localStorageMock.setItem('smartCategorization.enabled', '');
    localStorageMock.setItem('smartCategorization.apiKey', '');
    localStorageMock.setItem('smartCategorization.model', '');

    const settings = getSmartCategorizationSettings();

    expect(settings).toEqual({
      enabled: false, // Empty string is falsy
      apiKey: '',
      model: 'gpt-4o-mini', // Should use default for empty model
    });
  });
});

describe('Smart Categorization - categorizeTransactionWithAI', () => {
  const mockTransaction: TransactionForCategorization = {
    description: 'Whole Foods Market',
    amount: -125.5,
    date: '2024-01-15',
    existingCategory: 'Uncategorized',
  };

  let mockLLMService: {
    categorizeTransaction: Mock;
    categorizeTransactionsBatch: Mock;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Mock LLM service
    mockLLMService = {
      categorizeTransaction: vi.fn(),
      categorizeTransactionsBatch: vi.fn(),
    } as any;

    vi.mocked(createLLMService).mockReturnValue(mockLLMService as any);
  });

  describe('Settings Validation', () => {
    test('should return existing category when AI is disabled', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'false');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
      expect(mockLLMService.categorizeTransaction).not.toHaveBeenCalled();
    });

    test('should return existing category when API key is missing', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      // No API key set

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
      expect(mockLLMService.categorizeTransaction).not.toHaveBeenCalled();
    });

    test('should return existing category when API key is empty', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', '');

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
      expect(mockLLMService.categorizeTransaction).not.toHaveBeenCalled();
    });

    test('should return existing category when LLM service creation fails', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

      vi.mocked(createLLMService).mockReturnValue(null); // Service creation failed

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });
  });

  describe('Confidence Threshold Handling', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should use AI category when confidence is above threshold (≥0.6)', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.85,
        reasoning: 'Whole Foods is a grocery store',
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Groceries');
      expect(mockLLMService.categorizeTransaction).toHaveBeenCalledWith(
        mockTransaction,
        undefined, // No custom categories
      );
    });

    test('should use AI category when confidence is exactly at threshold (0.6)', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.6,
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Groceries');
    });

    test('should use existing category when confidence is below threshold (<0.6)', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.59,
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized'); // Uses existing category
    });

    test('should handle very low confidence scores', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Unknown',
        confidence: 0.1,
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });

    test('should handle very high confidence scores', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.99,
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Groceries');
    });

    test('should handle confidence score edge cases', async () => {
      const testCases = [
        { confidence: 0.5999, expectedResult: 'Uncategorized' },
        { confidence: 0.6001, expectedResult: 'Groceries' },
        { confidence: 1.0, expectedResult: 'Groceries' },
        { confidence: 0.0, expectedResult: 'Uncategorized' },
      ];

      for (const testCase of testCases) {
        mockLLMService.categorizeTransaction.mockResolvedValue({
          category: 'Groceries',
          confidence: testCase.confidence,
        });

        const result = await categorizeTransactionWithAI(mockTransaction);
        expect(result).toBe(testCase.expectedResult);
      }
    });
  });

  describe('Custom Categories Support', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should pass custom categories to LLM service', async () => {
      const customCategories = ['Custom Groceries', 'Custom Transportation'];

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Custom Groceries',
        confidence: 0.8,
      });

      const result = await categorizeTransactionWithAI(mockTransaction, customCategories);

      expect(result).toBe('Custom Groceries');
      expect(mockLLMService.categorizeTransaction).toHaveBeenCalledWith(
        mockTransaction,
        customCategories,
      );
    });

    test('should handle empty custom categories array', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.8,
      });

      const result = await categorizeTransactionWithAI(mockTransaction, []);

      expect(result).toBe('Groceries');
      expect(mockLLMService.categorizeTransaction).toHaveBeenCalledWith(mockTransaction, []);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should handle LLM service errors gracefully', async () => {
      mockLLMService.categorizeTransaction.mockRejectedValue(new Error('API Error'));

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized'); // Fallback to existing category
    });

    test('should handle network errors', async () => {
      mockLLMService.categorizeTransaction.mockRejectedValue(new Error('Network error'));

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });

    test('should handle rate limiting errors', async () => {
      mockLLMService.categorizeTransaction.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });

    test('should handle timeout errors', async () => {
      mockLLMService.categorizeTransaction.mockRejectedValue(new Error('Request timeout'));

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });

    test('should handle malformed API responses', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue(null);

      const result = await categorizeTransactionWithAI(mockTransaction);

      expect(result).toBe('Uncategorized');
    });

    test('should handle missing confidence in response', async () => {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        // Missing confidence
      });

      const result = await categorizeTransactionWithAI(mockTransaction);

      // Should treat missing confidence as below threshold
      expect(result).toBe('Uncategorized');
    });
  });

  describe('Logging Behavior', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should log successful high-confidence categorization', async () => {
      // logger already imported at top

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.85,
      });

      await categorizeTransactionWithAI(mockTransaction);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'AI categorized "Whole Foods Market" as "Groceries" with 85% confidence',
        ),
      );
    });

    test('should log low-confidence fallback', async () => {
      // logger already imported at top

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Uncertain',
        confidence: 0.4,
      });

      await categorizeTransactionWithAI(mockTransaction);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'AI categorization confidence too low for "Whole Foods Market" (40%), using default',
        ),
      );
    });

    test('should log errors during categorization', async () => {
      // logger already imported at top

      mockLLMService.categorizeTransaction.mockRejectedValue(new Error('Test error'));

      await categorizeTransactionWithAI(mockTransaction);

      expect(logger.error).toHaveBeenCalledWith(
        'Error during AI categorization:',
        expect.any(Error),
      );
    });
  });

  describe('Transaction Edge Cases', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should handle transaction without existing category', async () => {
      const transactionNoCategory: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -50,
        date: '2024-01-15',
        // No existingCategory
      };

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Shopping',
        confidence: 0.8,
      });

      const result = await categorizeTransactionWithAI(transactionNoCategory);
      expect(result).toBe('Shopping');
    });

    test('should fallback to "Uncategorized" when no existing category and low confidence', async () => {
      const transactionNoCategory: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -50,
        date: '2024-01-15',
      };

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Uncertain',
        confidence: 0.4,
      });

      const result = await categorizeTransactionWithAI(transactionNoCategory);
      expect(result).toBe('Uncategorized');
    });

    test('should handle empty description', async () => {
      const emptyTransaction: TransactionForCategorization = {
        description: '',
        amount: -25,
        date: '2024-01-15',
        existingCategory: 'Original',
      };

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Unknown',
        confidence: 0.8,
      });

      const result = await categorizeTransactionWithAI(emptyTransaction);
      expect(result).toBe('Unknown');
    });

    test('should handle very long descriptions', async () => {
      const longTransaction: TransactionForCategorization = {
        description: 'A'.repeat(1000) + ' grocery store ' + 'B'.repeat(1000),
        amount: -100,
        date: '2024-01-15',
        existingCategory: 'Original',
      };

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Groceries',
        confidence: 0.9,
      });

      const result = await categorizeTransactionWithAI(longTransaction);
      expect(result).toBe('Groceries');
    });

    test('should handle special characters in description', async () => {
      const specialTransaction: TransactionForCategorization = {
        description: 'AT&T Payment - $100.50 "AutoPay"',
        amount: -100.5,
        date: '2024-01-15',
        existingCategory: 'Bills',
      };

      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'Utilities',
        confidence: 0.95,
      });

      const result = await categorizeTransactionWithAI(specialTransaction);
      expect(result).toBe('Utilities');
    });
  });
});

describe('Smart Categorization - categorizeTransactionsBatchWithAI', () => {
  const mockTransactions: TransactionForCategorization[] = [
    {
      description: 'Starbucks Coffee',
      amount: -4.5,
      date: '2024-01-15',
      existingCategory: 'Dining',
    },
    {
      description: 'Gas Station',
      amount: -35.0,
      date: '2024-01-16',
      existingCategory: 'Transport',
    },
    {
      description: 'Grocery Store',
      amount: -85.75,
      date: '2024-01-17',
      existingCategory: 'Food',
    },
  ];

  let mockLLMService: {
    categorizeTransaction: Mock;
    categorizeTransactionsBatch: Mock;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    mockLLMService = {
      categorizeTransaction: vi.fn(),
      categorizeTransactionsBatch: vi.fn(),
    } as any;

    vi.mocked(createLLMService).mockReturnValue(mockLLMService as any);
  });

  describe('Settings Validation', () => {
    test('should return existing categories when AI is disabled', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'false');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Dining', 'Transport', 'Food']);
      expect(mockLLMService.categorizeTransactionsBatch).not.toHaveBeenCalled();
    });

    test('should return existing categories when API key is missing', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Dining', 'Transport', 'Food']);
    });

    test('should handle transactions without existing categories', async () => {
      localStorageMock.setItem('smartCategorization.enabled', 'false');

      const transactionsNoCategories = mockTransactions.map((t) => ({
        ...t,
        existingCategory: undefined,
      }));

      const results = await categorizeTransactionsBatchWithAI(transactionsNoCategories);

      expect(results).toEqual(['Uncategorized', 'Uncategorized', 'Uncategorized']);
    });
  });

  describe('Batch Processing', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should process small batches in single API call', async () => {
      const mockResults = [
        { category: 'Coffee Shops', confidence: 0.9 },
        { category: 'Transportation', confidence: 0.85 },
        { category: 'Groceries', confidence: 0.95 },
      ];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Coffee Shops', 'Transportation', 'Groceries']);
      expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledTimes(1);
      expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledWith(
        mockTransactions,
        undefined,
      );
    });

    test('should split large batches into chunks of 10', async () => {
      const largeTransactionSet = Array.from({ length: 25 }, (_, i) => ({
        description: `Transaction ${i + 1}`,
        amount: -(i + 1) * 10,
        date: '2024-01-15',
        existingCategory: 'Original',
      }));

      // Mock responses for 3 batches (10, 10, 5)
      const batch1Results = Array.from({ length: 10 }, () => ({
        category: 'Batch1',
        confidence: 0.8,
      }));
      const batch2Results = Array.from({ length: 10 }, () => ({
        category: 'Batch2',
        confidence: 0.8,
      }));
      const batch3Results = Array.from({ length: 5 }, () => ({
        category: 'Batch3',
        confidence: 0.8,
      }));

      mockLLMService.categorizeTransactionsBatch
        .mockResolvedValueOnce(batch1Results)
        .mockResolvedValueOnce(batch2Results)
        .mockResolvedValueOnce(batch3Results);

      const results = await categorizeTransactionsBatchWithAI(largeTransactionSet);

      expect(results).toHaveLength(25);
      expect(results.slice(0, 10)).toEqual(Array(10).fill('Batch1'));
      expect(results.slice(10, 20)).toEqual(Array(10).fill('Batch2'));
      expect(results.slice(20, 25)).toEqual(Array(5).fill('Batch3'));
      expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledTimes(3);
    });

    test('should handle confidence thresholds in batch processing', async () => {
      const mockResults = [
        { category: 'Coffee Shops', confidence: 0.9 }, // Above threshold
        { category: 'Transportation', confidence: 0.4 }, // Below threshold
        { category: 'Groceries', confidence: 0.6 }, // At threshold
      ];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual([
        'Coffee Shops', // High confidence
        'Transport', // Low confidence, use existing
        'Groceries', // At threshold, use AI
      ]);
    });

    test('should handle missing results in batch response', async () => {
      const mockResults = [
        { category: 'Coffee Shops', confidence: 0.9 },
        // Only 2 results for 3 transactions
        { category: 'Groceries', confidence: 0.8 },
      ];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual([
        'Coffee Shops',
        'Groceries',
        'Food', // Third transaction falls back to existing because array is too short
      ]);
    });
  });

  describe('Error Handling in Batch Processing', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should handle batch API errors gracefully', async () => {
      mockLLMService.categorizeTransactionsBatch.mockRejectedValue(new Error('API Error'));

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Dining', 'Transport', 'Food']); // Fallback to existing
    });

    test('should handle partial batch failures', async () => {
      const largeTransactionSet = Array.from({ length: 15 }, (_, i) => ({
        description: `Transaction ${i + 1}`,
        amount: -(i + 1) * 10,
        date: '2024-01-15',
        existingCategory: `Original${i + 1}`,
      }));

      // First batch succeeds, second batch fails
      const batch1Results = Array.from({ length: 10 }, () => ({
        category: 'Success',
        confidence: 0.8,
      }));

      mockLLMService.categorizeTransactionsBatch
        .mockResolvedValueOnce(batch1Results)
        .mockRejectedValueOnce(new Error('Second batch failed'));

      const results = await categorizeTransactionsBatchWithAI(largeTransactionSet);

      expect(results).toHaveLength(15);
      expect(results.slice(0, 10)).toEqual(Array(10).fill('Success'));
      expect(results.slice(10, 15)).toEqual([
        'Original11',
        'Original12',
        'Original13',
        'Original14',
        'Original15',
      ]);
    });

    test('should handle timeout in batch processing', async () => {
      mockLLMService.categorizeTransactionsBatch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      );

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Dining', 'Transport', 'Food']);
    });

    test('should handle network errors in batch processing', async () => {
      mockLLMService.categorizeTransactionsBatch.mockRejectedValue(new Error('Network error'));

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual(['Dining', 'Transport', 'Food']);
    });
  });

  describe('Custom Categories in Batch Processing', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should pass custom categories to batch processing', async () => {
      const customCategories = ['Custom Coffee', 'Custom Transport', 'Custom Food'];
      const mockResults = [
        { category: 'Custom Coffee', confidence: 0.9 },
        { category: 'Custom Transport', confidence: 0.85 },
        { category: 'Custom Food', confidence: 0.95 },
      ];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(mockTransactions, customCategories);

      expect(results).toEqual(['Custom Coffee', 'Custom Transport', 'Custom Food']);
      expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledWith(
        expect.any(Array),
        customCategories,
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should handle empty transaction array', async () => {
      const results = await categorizeTransactionsBatchWithAI([]);

      expect(results).toEqual([]);
      expect(mockLLMService.categorizeTransactionsBatch).not.toHaveBeenCalled();
    });

    test('should handle single transaction in batch', async () => {
      const singleTransaction = [mockTransactions[0]];
      const mockResults = [{ category: 'Coffee Shops', confidence: 0.9 }];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(singleTransaction);

      expect(results).toEqual(['Coffee Shops']);
    });

    test('should maintain transaction order in results', async () => {
      const orderedTransactions = [
        { description: 'First', amount: -10, date: '2024-01-01', existingCategory: 'A' },
        { description: 'Second', amount: -20, date: '2024-01-02', existingCategory: 'B' },
        { description: 'Third', amount: -30, date: '2024-01-03', existingCategory: 'C' },
      ];

      const mockResults = [
        { category: 'Result1', confidence: 0.8 },
        { category: 'Result2', confidence: 0.8 },
        { category: 'Result3', confidence: 0.8 },
      ];

      mockLLMService.categorizeTransactionsBatch.mockResolvedValue(mockResults);

      const results = await categorizeTransactionsBatchWithAI(orderedTransactions);

      expect(results).toEqual(['Result1', 'Result2', 'Result3']);
    });

    test('should handle very large batch sizes efficiently', async () => {
      const largeTransactionSet = Array.from({ length: 100 }, (_, i) => ({
        description: `Transaction ${i + 1}`,
        amount: -(i + 1),
        date: '2024-01-15',
        existingCategory: 'Original',
      }));

      // Mock 10 batch responses (10 transactions each)
      const mockBatchResults = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => ({ category: 'BatchResult', confidence: 0.8 })),
      );

      mockLLMService.categorizeTransactionsBatch.mockImplementation(
        (batch: TransactionForCategorization[]) =>
          Promise.resolve(mockBatchResults[Math.floor(mockBatchResults.length * Math.random())]),
      );

      const startTime = performance.now();
      const results = await categorizeTransactionsBatchWithAI(largeTransactionSet);
      const endTime = performance.now();

      expect(results).toHaveLength(100);
      expect(results.every((r) => r === 'BatchResult')).toBe(true);
      expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledTimes(10);

      // Should process 100 transactions reasonably quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should handle malformed batch responses', async () => {
      mockLLMService.categorizeTransactionsBatch.mockResolvedValue([
        null, // Malformed result
        { category: 'Valid', confidence: 0.8 },
        { confidence: 0.9 }, // Missing category
      ]);

      const results = await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(results).toEqual([
        'Dining', // Fallback for malformed result
        'Valid',
        'Food', // Fallback for missing category
      ]);
    });
  });

  describe('Logging in Batch Processing', () => {
    beforeEach(() => {
      localStorageMock.setItem('smartCategorization.enabled', 'true');
      localStorageMock.setItem('smartCategorization.apiKey', 'test-key');
    });

    test('should log batch processing errors', async () => {
      // logger already imported at top

      mockLLMService.categorizeTransactionsBatch.mockRejectedValue(new Error('Batch error'));

      await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(logger.error).toHaveBeenCalledWith('Error categorizing batch 1:', expect.any(Error));
    });

    test('should log overall batch processing errors', async () => {
      // logger already imported at top

      vi.mocked(createLLMService).mockImplementation(() => {
        throw new Error('Service creation failed');
      });

      await categorizeTransactionsBatchWithAI(mockTransactions);

      expect(logger.error).toHaveBeenCalledWith(
        'Error during batch AI categorization:',
        expect.any(Error),
      );
    });
  });
});

describe('Smart Categorization - Integration Tests', () => {
  let mockLLMService: {
    categorizeTransaction: Mock;
    categorizeTransactionsBatch: Mock;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    mockLLMService = {
      categorizeTransaction: vi.fn(),
      categorizeTransactionsBatch: vi.fn(),
    } as any;

    vi.mocked(createLLMService).mockReturnValue(mockLLMService as any);
  });

  test('should demonstrate complete AI categorization workflow', async () => {
    // Setup
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-api-key');
    localStorageMock.setItem('smartCategorization.model', 'gpt-4');

    const transactions: TransactionForCategorization[] = [
      {
        description: 'Whole Foods Market',
        amount: -125.5,
        date: '2024-01-15',
        existingCategory: 'Shopping',
      },
      {
        description: 'Shell Gas Station',
        amount: -45.0,
        date: '2024-01-16',
        existingCategory: 'Transport',
      },
      {
        description: 'Netflix Subscription',
        amount: -15.99,
        date: '2024-01-17',
        existingCategory: 'Entertainment',
      },
    ];

    // Mock AI responses
    mockLLMService.categorizeTransactionsBatch.mockResolvedValue([
      { category: 'Groceries', confidence: 0.95 }, // High confidence
      { category: 'Fuel', confidence: 0.4 }, // Low confidence
      { category: 'Streaming Services', confidence: 0.85 }, // High confidence
    ]);

    // Execute
    const results = await categorizeTransactionsBatchWithAI(transactions);

    // Verify
    expect(results).toEqual([
      'Groceries', // AI result (high confidence)
      'Transport', // Existing category (low confidence)
      'Streaming Services', // AI result (high confidence)
    ]);

    expect(mockLLMService.categorizeTransactionsBatch).toHaveBeenCalledWith(
      transactions,
      undefined,
    );
  });

  test('should handle mixed single and batch categorization', async () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

    const singleTransaction: TransactionForCategorization = {
      description: 'Amazon Purchase',
      amount: -89.99,
      date: '2024-01-15',
      existingCategory: 'Shopping',
    };

    const batchTransactions: TransactionForCategorization[] = [
      {
        description: 'Coffee Shop',
        amount: -5.5,
        date: '2024-01-16',
        existingCategory: 'Food',
      },
      {
        description: 'Gas Station',
        amount: -40.0,
        date: '2024-01-17',
        existingCategory: 'Transport',
      },
    ];

    // Mock responses
    mockLLMService.categorizeTransaction.mockResolvedValue({
      category: 'Online Shopping',
      confidence: 0.9,
    });

    mockLLMService.categorizeTransactionsBatch.mockResolvedValue([
      { category: 'Coffee Shops', confidence: 0.85 },
      { category: 'Fuel', confidence: 0.75 },
    ]);

    // Execute both operations
    const singleResult = await categorizeTransactionWithAI(singleTransaction);
    const batchResults = await categorizeTransactionsBatchWithAI(batchTransactions);

    // Verify
    expect(singleResult).toBe('Online Shopping');
    expect(batchResults).toEqual(['Coffee Shops', 'Fuel']);
  });

  test('should demonstrate confidence threshold boundary behavior', async () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

    const boundaryTests = [
      { confidence: 0.59, expected: 'Original' }, // Just below threshold
      { confidence: 0.6, expected: 'AI Category' }, // At threshold
      { confidence: 0.61, expected: 'AI Category' }, // Just above threshold
    ];

    for (const test of boundaryTests) {
      mockLLMService.categorizeTransaction.mockResolvedValue({
        category: 'AI Category',
        confidence: test.confidence,
      });

      const transaction: TransactionForCategorization = {
        description: `Test transaction with ${test.confidence} confidence`,
        amount: -25,
        date: '2024-01-15',
        existingCategory: 'Original',
      };

      const result = await categorizeTransactionWithAI(transaction);
      expect(result).toBe(test.expected);
    }
  });

  test('should handle real-world categorization scenarios', async () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

    const realWorldTransactions: TransactionForCategorization[] = [
      {
        description: 'POS DEBIT WALMART SUPERCENTER #1234',
        amount: -156.78,
        date: '2024-01-15',
        existingCategory: 'Shopping',
      },
      {
        description: "UBER EATS * MCDONALD'S",
        amount: -12.45,
        date: '2024-01-16',
        existingCategory: 'Dining',
      },
      {
        description: 'AMAZON.COM*MK1234567890',
        amount: -89.99,
        date: '2024-01-17',
        existingCategory: 'Online',
      },
      {
        description: 'ATM WITHDRAWAL CASH',
        amount: -100.0,
        date: '2024-01-18',
        existingCategory: 'Cash',
      },
    ];

    mockLLMService.categorizeTransactionsBatch.mockResolvedValue([
      { category: 'Groceries', confidence: 0.92 },
      { category: 'Food Delivery', confidence: 0.88 },
      { category: 'Online Shopping', confidence: 0.95 },
      { category: 'ATM & Cash', confidence: 0.75 },
    ]);

    const results = await categorizeTransactionsBatchWithAI(realWorldTransactions);

    expect(results).toEqual(['Groceries', 'Food Delivery', 'Online Shopping', 'ATM & Cash']);
  });

  test('should handle error recovery and fallback chains', async () => {
    localStorageMock.setItem('smartCategorization.enabled', 'true');
    localStorageMock.setItem('smartCategorization.apiKey', 'test-key');

    const transactions: TransactionForCategorization[] = [
      {
        description: 'Normal Transaction',
        amount: -50,
        date: '2024-01-15',
        existingCategory: 'Existing1',
      },
      {
        description: 'Another Transaction',
        amount: -75,
        date: '2024-01-16',
        existingCategory: 'Existing2',
      },
    ];

    // First call fails, second call succeeds
    mockLLMService.categorizeTransactionsBatch
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce([{ category: 'Success Category', confidence: 0.8 }]);

    // Should handle the error gracefully and fall back to existing categories
    const results = await categorizeTransactionsBatchWithAI(transactions);

    expect(results).toEqual(['Existing1', 'Existing2']);
  });
});
