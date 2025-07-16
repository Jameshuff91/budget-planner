import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LLMService,
  createLLMService,
  TransactionForCategorization,
  CategorySuggestion,
} from '@services/llmService';

// Mock logger
vi.mock('@services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMService', () => {
  let llmService: LLMService;
  const mockApiKey = 'test-api-key-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    llmService = new LLMService({ apiKey: mockApiKey });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default configuration', () => {
      const service = new LLMService({ apiKey: 'test-key' });
      expect(service).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const config = {
        apiKey: 'custom-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 200,
      };
      const service = new LLMService(config);
      expect(service).toBeDefined();
    });

    test('should use default values for optional parameters', () => {
      const service = new LLMService({ apiKey: 'test-key' });
      // Test that service was created successfully (defaults are internal)
      expect(service).toBeDefined();
    });
  });

  describe('Single Transaction Categorization', () => {
    const mockTransaction: TransactionForCategorization = {
      description: 'Whole Foods Market Purchase',
      amount: -125.5,
      date: '2024-01-15',
      existingCategory: 'Uncategorized',
    };

    test('should successfully categorize a transaction', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Groceries',
                  confidence: 0.85,
                  reasoning: 'Whole Foods is a grocery store',
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(mockTransaction);

      expect(result).toEqual({
        category: 'Groceries',
        confidence: 0.85,
        reasoning: 'Whole Foods is a grocery store',
      });

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );
    });

    test('should use custom categories when provided', async () => {
      const customCategories = ['Custom Groceries', 'Custom Transportation'];
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Custom Groceries',
                  confidence: 0.9,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.categorizeTransaction(mockTransaction, customCategories);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);

      expect(requestBody.messages[1].content).toContain('Custom Groceries');
      expect(requestBody.messages[1].content).toContain('Custom Transportation');
    });

    test('should handle malformed JSON response gracefully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Invalid JSON response',
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(mockTransaction);

      expect(result).toEqual({
        category: 'Other Expenses',
        confidence: 0.3,
      });
    });

    test('should handle API error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('Error details'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(llmService.categorizeTransaction(mockTransaction)).rejects.toThrow(
        'OpenAI API error: 400 Bad Request',
      );
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(llmService.categorizeTransaction(mockTransaction)).rejects.toThrow(
        'Network error',
      );
    });

    test('should handle rate limiting (429 status)', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: vi.fn().mockResolvedValue('Rate limit exceeded'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(llmService.categorizeTransaction(mockTransaction)).rejects.toThrow(
        'OpenAI API error: 429 Too Many Requests',
      );
    });

    test('should handle unauthorized access (401 status)', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Invalid API key'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(llmService.categorizeTransaction(mockTransaction)).rejects.toThrow(
        'OpenAI API error: 401 Unauthorized',
      );
    });

    test('should build correct prompt with transaction details', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Groceries',
                  confidence: 0.85,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.categorizeTransaction(mockTransaction);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);
      const userMessage = requestBody.messages[1].content;

      expect(userMessage).toContain('Whole Foods Market Purchase');
      expect(userMessage).toContain('$125.5 (expense)');
      expect(userMessage).toContain('2024-01-15');
      expect(userMessage).toContain('JSON format');
    });

    test('should handle positive amounts as income', async () => {
      const incomeTransaction: TransactionForCategorization = {
        description: 'Salary Payment',
        amount: 5000.0,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Salary',
                  confidence: 0.95,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.categorizeTransaction(incomeTransaction);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);
      const userMessage = requestBody.messages[1].content;

      expect(userMessage).toContain('$5000 (income)');
    });
  });

  describe('Batch Transaction Categorization', () => {
    const mockTransactions: TransactionForCategorization[] = [
      {
        description: 'Starbucks Coffee',
        amount: -4.5,
        date: '2024-01-15',
      },
      {
        description: 'Gas Station',
        amount: -35.0,
        date: '2024-01-16',
      },
      {
        description: 'Grocery Store',
        amount: -85.75,
        date: '2024-01-17',
      },
    ];

    test('should successfully categorize multiple transactions', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 1, category: 'Dining Out', confidence: 0.9 },
                  { index: 2, category: 'Transportation', confidence: 0.85 },
                  { index: 3, category: 'Groceries', confidence: 0.95 },
                ]),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const results = await llmService.categorizeTransactionsBatch(mockTransactions);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        category: 'Dining Out',
        confidence: 0.9,
      });
      expect(results[1]).toEqual({
        category: 'Transportation',
        confidence: 0.85,
      });
      expect(results[2]).toEqual({
        category: 'Groceries',
        confidence: 0.95,
      });
    });

    test('should handle batch API errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      await expect(llmService.categorizeTransactionsBatch(mockTransactions)).rejects.toThrow(
        'API Error',
      );
    });

    test('should handle malformed batch response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Invalid batch JSON',
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const results = await llmService.categorizeTransactionsBatch(mockTransactions);
      expect(results).toEqual([]);
    });

    test('should scale max_tokens based on batch size', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 1, category: 'Test', confidence: 0.8 },
                  { index: 2, category: 'Test', confidence: 0.8 },
                  { index: 3, category: 'Test', confidence: 0.8 },
                ]),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.categorizeTransactionsBatch(mockTransactions);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);

      // Default max_tokens is 150, so for 3 transactions it should be 450
      expect(requestBody.max_tokens).toBe(450);
    });

    test('should build correct batch prompt format', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([]),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.categorizeTransactionsBatch(mockTransactions);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);
      const userMessage = requestBody.messages[1].content;

      expect(userMessage).toContain('1. Description: Starbucks Coffee');
      expect(userMessage).toContain('2. Description: Gas Station');
      expect(userMessage).toContain('3. Description: Grocery Store');
      expect(userMessage).toContain('JSON array');
    });
  });

  describe('Custom Category Suggestions', () => {
    const mockTransactions: TransactionForCategorization[] = [
      {
        description: 'Uber Eats Delivery',
        amount: -25.5,
        date: '2024-01-15',
      },
      {
        description: 'Netflix Subscription',
        amount: -15.99,
        date: '2024-01-16',
      },
    ];

    test('should suggest custom categories based on transactions', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  'Food Delivery\nStreaming Services\nSubscriptions\nOnline Services\nDigital Entertainment',
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const suggestions = await llmService.suggestCustomCategories(mockTransactions);

      expect(suggestions).toEqual([
        'Food Delivery',
        'Streaming Services',
        'Subscriptions',
        'Online Services',
        'Digital Entertainment',
      ]);
    });

    test('should handle suggestion API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const suggestions = await llmService.suggestCustomCategories(mockTransactions);
      expect(suggestions).toEqual([]);
    });

    test('should filter empty lines from suggestions', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Food Delivery\n\nStreaming Services\n\n\nSubscriptions\n',
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const suggestions = await llmService.suggestCustomCategories(mockTransactions);

      expect(suggestions).toEqual(['Food Delivery', 'Streaming Services', 'Subscriptions']);
    });

    test('should use appropriate temperature for creativity', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Test Category',
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await llmService.suggestCustomCategories(mockTransactions);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);

      expect(requestBody.temperature).toBe(0.5); // Higher than categorization
    });
  });

  describe('Response Parsing', () => {
    test('should parse valid JSON categorization response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Test Category',
                  confidence: 0.75,
                  reasoning: 'Test reasoning',
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test',
        amount: -10,
        date: '2024-01-15',
      };

      const result = await llmService.categorizeTransaction(transaction);

      expect(result.category).toBe('Test Category');
      expect(result.confidence).toBe(0.75);
      expect(result.reasoning).toBe('Test reasoning');
    });

    test('should handle missing fields in response gracefully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Test Category',
                  // Missing confidence and reasoning
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test',
        amount: -10,
        date: '2024-01-15',
      };

      const result = await llmService.categorizeTransaction(transaction);

      expect(result.category).toBe('Test Category');
      expect(result.confidence).toBe(0.5); // Default value
      expect(result.reasoning).toBeUndefined();
    });

    test('should handle batch response with missing fields', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 1, category: 'Valid Category', confidence: 0.8 },
                  { index: 2 }, // Missing category and confidence
                  { index: 3, category: 'Another Category' }, // Missing confidence
                ]),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transactions = [
        { description: 'Test 1', amount: -10, date: '2024-01-15' },
        { description: 'Test 2', amount: -20, date: '2024-01-16' },
        { description: 'Test 3', amount: -30, date: '2024-01-17' },
      ];

      const results = await llmService.categorizeTransactionsBatch(transactions);

      expect(results[0].category).toBe('Valid Category');
      expect(results[0].confidence).toBe(0.8);

      expect(results[1].category).toBe('Other Expenses'); // Default
      expect(results[1].confidence).toBe(0.5); // Default

      expect(results[2].category).toBe('Another Category');
      expect(results[2].confidence).toBe(0.5); // Default
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle very long transaction descriptions', async () => {
      const longDescription = 'A'.repeat(1000) + ' grocery store ' + 'B'.repeat(1000);
      const transaction: TransactionForCategorization = {
        description: longDescription,
        amount: -50,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Groceries',
                  confidence: 0.8,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(transaction);
      expect(result.category).toBe('Groceries');
    });

    test('should handle special characters in descriptions', async () => {
      const transaction: TransactionForCategorization = {
        description: 'AT&T Payment - $100.50 "AutoPay"',
        amount: -100.5,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Utilities',
                  confidence: 0.9,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(transaction);
      expect(result.category).toBe('Utilities');
    });

    test('should handle zero amounts', async () => {
      const transaction: TransactionForCategorization = {
        description: 'Balance Adjustment',
        amount: 0,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Other',
                  confidence: 0.6,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(transaction);
      expect(result.category).toBe('Other');

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);
      const userMessage = requestBody.messages[1].content;

      expect(userMessage).toContain('$0 (income)'); // Zero is treated as income
    });

    test('should handle very large amounts', async () => {
      const transaction: TransactionForCategorization = {
        description: 'Large Purchase',
        amount: -999999.99,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Large Expenses',
                  confidence: 0.7,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(transaction);
      expect(result.category).toBe('Large Expenses');
    });

    test('should handle empty description', async () => {
      const transaction: TransactionForCategorization = {
        description: '',
        amount: -25,
        date: '2024-01-15',
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Unknown',
                  confidence: 0.3,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await llmService.categorizeTransaction(transaction);
      expect(result.category).toBe('Unknown');
    });

    test('should measure API response time', async () => {
      const mockResponse = {
        ok: true,
        json: async () => {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: 'Test',
                    confidence: 0.8,
                  }),
                },
              },
            ],
          };
        },
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25,
        date: '2024-01-15',
      };

      const startTime = performance.now();
      await llmService.categorizeTransaction(transaction);
      const endTime = performance.now();

      expect(endTime - startTime).toBeGreaterThan(100);
    });

    test('should handle timeout scenarios', async () => {
      // Mock a very slow response that times out
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100)),
      );

      const transaction: TransactionForCategorization = {
        description: 'Test Transaction',
        amount: -25,
        date: '2024-01-15',
      };

      await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
        'Request timeout',
      );
    });
  });

  describe('API Request Configuration', () => {
    test('should send correct request headers', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Test',
                  confidence: 0.8,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test',
        amount: -25,
        date: '2024-01-15',
      };

      await llmService.categorizeTransaction(transaction);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }),
      );
    });

    test('should send correct model configuration', async () => {
      const customService = new LLMService({
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 300,
      });

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Test',
                  confidence: 0.8,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test',
        amount: -25,
        date: '2024-01-15',
      };

      await customService.categorizeTransaction(transaction);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);

      expect(requestBody.model).toBe('gpt-4');
      expect(requestBody.temperature).toBe(0.1);
      expect(requestBody.max_tokens).toBe(300);
    });

    test('should include system message for context', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Test',
                  confidence: 0.8,
                }),
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const transaction: TransactionForCategorization = {
        description: 'Test',
        amount: -25,
        date: '2024-01-15',
      };

      await llmService.categorizeTransaction(transaction);

      const apiCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(apiCall[1].body);

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toContain(
        'financial transaction categorization assistant',
      );
      expect(requestBody.messages[1].role).toBe('user');
    });
  });
});

describe('LLMService Factory Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variable
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  });

  test('should create service with provided API key', () => {
    const service = createLLMService('test-api-key');
    expect(service).toBeInstanceOf(LLMService);
  });

  test('should use environment variable when no key provided', () => {
    process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'env-api-key';
    const service = createLLMService();
    expect(service).toBeInstanceOf(LLMService);
  });

  test('should return null when no API key available', () => {
    // Clear localStorage as well
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    const service = createLLMService();
    expect(service).toBeNull();
  });

  test('should prefer provided key over environment variable', () => {
    process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'env-api-key';
    const service = createLLMService('provided-key');
    expect(service).toBeInstanceOf(LLMService);
  });
});

describe('LLMService Rate Limiting and Error Recovery', () => {
  let llmService: LLMService;

  beforeEach(() => {
    vi.clearAllMocks();
    llmService = new LLMService({ apiKey: 'test-key' });
  });

  test('should handle 429 rate limit errors', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: vi.fn().mockResolvedValue('Rate limit exceeded'),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const transaction: TransactionForCategorization = {
      description: 'Test Transaction',
      amount: -25,
      date: '2024-01-15',
    };

    await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
      'OpenAI API error: 429 Too Many Requests',
    );
  });

  test('should handle 503 service unavailable errors', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: vi.fn().mockResolvedValue('Service temporarily unavailable'),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const transaction: TransactionForCategorization = {
      description: 'Test Transaction',
      amount: -25,
      date: '2024-01-15',
    };

    await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
      'OpenAI API error: 503 Service Unavailable',
    );
  });

  test('should handle quota exceeded errors', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Quota exceeded',
      text: vi.fn().mockResolvedValue('Monthly quota exceeded'),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const transaction: TransactionForCategorization = {
      description: 'Test Transaction',
      amount: -25,
      date: '2024-01-15',
    };

    await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
      'OpenAI API error: 429 Quota exceeded',
    );
  });

  test('should handle connection timeout', async () => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 100)),
    );

    const transaction: TransactionForCategorization = {
      description: 'Test Transaction',
      amount: -25,
      date: '2024-01-15',
    };

    await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
      'Connection timeout',
    );
  });

  test('should handle DNS resolution errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND api.openai.com'));

    const transaction: TransactionForCategorization = {
      description: 'Test Transaction',
      amount: -25,
      date: '2024-01-15',
    };

    await expect(llmService.categorizeTransaction(transaction)).rejects.toThrow(
      'getaddrinfo ENOTFOUND api.openai.com',
    );
  });
});
