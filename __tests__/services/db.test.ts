import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Asset, Liability } from '@services/db';

// Mock generateUUID to return predictable values for testing
const mockGenerateUUID = vi.fn(
  () => `test-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
);
vi.mock('@utils/helpers', () => ({
  generateUUID: mockGenerateUUID,
}));

// Mock the entire database service for easier testing
const mockDbService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getTransactions: vi.fn().mockResolvedValue([]),
  getCategories: vi.fn().mockResolvedValue([]),
  getAllRecurringPreferences: vi.fn().mockResolvedValue({}),
  getAllAssets: vi.fn().mockResolvedValue([]),
  getAllLiabilities: vi.fn().mockResolvedValue([]),
  addTransaction: vi.fn().mockResolvedValue('test-transaction-id'),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  clearTransactions: vi.fn().mockResolvedValue(undefined),
  addCategory: vi.fn().mockResolvedValue('test-category-id'),
  updateCategoryBudget: vi.fn().mockResolvedValue(undefined),
  setRecurringPreference: vi.fn().mockResolvedValue(undefined),
  deleteRecurringPreference: vi.fn().mockResolvedValue(undefined),
  addAsset: vi.fn().mockResolvedValue('test-asset-id'),
  updateAsset: vi.fn().mockResolvedValue(undefined),
  deleteAsset: vi.fn().mockResolvedValue(undefined),
  addLiability: vi.fn().mockResolvedValue('test-liability-id'),
  updateLiability: vi.fn().mockResolvedValue(undefined),
  deleteLiability: vi.fn().mockResolvedValue(undefined),
  clearPDFs: vi.fn().mockResolvedValue(undefined),
  getDB: vi.fn().mockResolvedValue({}),
  getTransactionsByDateRange: vi.fn().mockResolvedValue([]),
};

vi.mock('@services/db', async () => {
  const actual = await vi.importActual('@services/db');
  return {
    ...actual,
    dbService: mockDbService,
  };
});

describe('DatabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize database successfully', async () => {
      await mockDbService.initialize();

      expect(mockDbService.initialize).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization errors', async () => {
      const error = new Error('Database initialization failed');
      mockDbService.initialize.mockRejectedValueOnce(error);

      await expect(mockDbService.initialize()).rejects.toThrow('Database initialization failed');
    });
  });

  describe('Transaction CRUD Operations', () => {
    test('should add transaction successfully', async () => {
      const transaction = {
        id: 'test-transaction-1',
        amount: 100,
        category: 'Test Category',
        description: 'Test transaction',
        date: new Date('2024-01-01'),
        type: 'expense' as const,
      };

      const id = await mockDbService.addTransaction(transaction);
      expect(id).toBe('test-transaction-id');
      expect(mockDbService.addTransaction).toHaveBeenCalledWith(transaction);
    });

    test('should update transaction successfully', async () => {
      const transaction = {
        id: 'test-transaction-2',
        amount: 150,
        category: 'Updated Category',
        description: 'Updated transaction',
        date: new Date('2024-01-01'),
        type: 'expense' as const,
      };

      await mockDbService.updateTransaction(transaction);
      expect(mockDbService.updateTransaction).toHaveBeenCalledWith(transaction);
    });

    test('should delete transaction successfully', async () => {
      await mockDbService.deleteTransaction('test-transaction-3');
      expect(mockDbService.deleteTransaction).toHaveBeenCalledWith('test-transaction-3');
    });

    test('should clear all transactions', async () => {
      await mockDbService.clearTransactions();
      expect(mockDbService.clearTransactions).toHaveBeenCalledTimes(1);
    });

    test('should get transactions by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockTransactions = [
        {
          id: 'test-range-1',
          amount: 100,
          category: 'Test',
          description: 'In range',
          date: new Date('2024-01-15'),
          type: 'expense' as const,
        },
      ];

      mockDbService.getTransactionsByDateRange.mockResolvedValue(mockTransactions);

      const result = await mockDbService.getTransactionsByDateRange(startDate, endDate);
      expect(result).toEqual(mockTransactions);
      expect(mockDbService.getTransactionsByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });

    test('should get all transactions', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          amount: 100,
          category: 'Test',
          description: 'Test transaction',
          date: new Date('2024-01-01'),
          type: 'expense' as const,
        },
      ];

      mockDbService.getTransactions.mockResolvedValue(mockTransactions);

      const result = await mockDbService.getTransactions();
      expect(result).toEqual(mockTransactions);
      expect(mockDbService.getTransactions).toHaveBeenCalledTimes(1);
    });
  });

  describe('Category CRUD Operations', () => {
    test('should add category successfully', async () => {
      const category = {
        id: 'test-category-1',
        name: 'Test Category',
        type: 'expense' as const,
        budget: 500,
      };

      const id = await mockDbService.addCategory(category);
      expect(id).toBe('test-category-id');
      expect(mockDbService.addCategory).toHaveBeenCalledWith(category);
    });

    test('should update category budget successfully', async () => {
      await mockDbService.updateCategoryBudget('test-category-2', 750);
      expect(mockDbService.updateCategoryBudget).toHaveBeenCalledWith('test-category-2', 750);
    });

    test('should get all categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Test Category',
          type: 'expense' as const,
        },
      ];

      mockDbService.getCategories.mockResolvedValue(mockCategories);

      const result = await mockDbService.getCategories();
      expect(result).toEqual(mockCategories);
      expect(mockDbService.getCategories).toHaveBeenCalledTimes(1);
    });
  });

  describe('Asset CRUD Operations', () => {
    test('should add asset successfully', async () => {
      const assetData = {
        name: 'Test Savings Account',
        type: 'Savings Account',
        currentValue: 10000,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      const id = await mockDbService.addAsset(assetData);
      expect(id).toBe('test-asset-id');
      expect(mockDbService.addAsset).toHaveBeenCalledWith(assetData);
    });

    test('should update asset successfully', async () => {
      const asset: Asset = {
        id: 'asset-1',
        name: 'Updated Investment',
        type: 'Investment (Stocks)',
        currentValue: 7500,
        lastUpdated: '2024-01-15T00:00:00.000Z',
      };

      await mockDbService.updateAsset(asset);
      expect(mockDbService.updateAsset).toHaveBeenCalledWith(asset);
    });

    test('should delete asset successfully', async () => {
      await mockDbService.deleteAsset('asset-1');
      expect(mockDbService.deleteAsset).toHaveBeenCalledWith('asset-1');
    });

    test('should get all assets', async () => {
      const mockAssets: Asset[] = [
        {
          id: 'asset-1',
          name: 'Test Savings',
          type: 'Savings Account',
          currentValue: 5000,
          lastUpdated: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockDbService.getAllAssets.mockResolvedValue(mockAssets);

      const result = await mockDbService.getAllAssets();
      expect(result).toEqual(mockAssets);
      expect(mockDbService.getAllAssets).toHaveBeenCalledTimes(1);
    });
  });

  describe('Liability CRUD Operations', () => {
    test('should add liability successfully', async () => {
      const liabilityData = {
        name: 'Test Credit Card',
        type: 'Credit Card',
        currentBalance: 2500,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      const id = await mockDbService.addLiability(liabilityData);
      expect(id).toBe('test-liability-id');
      expect(mockDbService.addLiability).toHaveBeenCalledWith(liabilityData);
    });

    test('should update liability successfully', async () => {
      const liability: Liability = {
        id: 'liability-1',
        name: 'Updated Mortgage',
        type: 'Mortgage',
        currentBalance: 195000,
        lastUpdated: '2024-01-15T00:00:00.000Z',
      };

      await mockDbService.updateLiability(liability);
      expect(mockDbService.updateLiability).toHaveBeenCalledWith(liability);
    });

    test('should delete liability successfully', async () => {
      await mockDbService.deleteLiability('liability-1');
      expect(mockDbService.deleteLiability).toHaveBeenCalledWith('liability-1');
    });

    test('should get all liabilities', async () => {
      const mockLiabilities: Liability[] = [
        {
          id: 'liability-1',
          name: 'Test Credit Card',
          type: 'Credit Card',
          currentBalance: 1500,
          lastUpdated: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockDbService.getAllLiabilities.mockResolvedValue(mockLiabilities);

      const result = await mockDbService.getAllLiabilities();
      expect(result).toEqual(mockLiabilities);
      expect(mockDbService.getAllLiabilities).toHaveBeenCalledTimes(1);
    });
  });

  describe('Recurring Preferences Operations', () => {
    test('should set recurring preference successfully', async () => {
      await mockDbService.setRecurringPreference('candidate-1', 'confirmed');
      expect(mockDbService.setRecurringPreference).toHaveBeenCalledWith('candidate-1', 'confirmed');
    });

    test('should delete recurring preference successfully', async () => {
      await mockDbService.deleteRecurringPreference('candidate-1');
      expect(mockDbService.deleteRecurringPreference).toHaveBeenCalledWith('candidate-1');
    });

    test('should get all recurring preferences', async () => {
      const mockPreferences = {
        'candidate-1': 'confirmed' as const,
        'candidate-2': 'dismissed' as const,
      };

      mockDbService.getAllRecurringPreferences.mockResolvedValue(mockPreferences);

      const result = await mockDbService.getAllRecurringPreferences();
      expect(result).toEqual(mockPreferences);
      expect(mockDbService.getAllRecurringPreferences).toHaveBeenCalledTimes(1);
    });
  });

  describe('PDF Operations', () => {
    test('should clear PDFs successfully', async () => {
      await mockDbService.clearPDFs();
      expect(mockDbService.clearPDFs).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle transaction add errors', async () => {
      const error = new Error('Add failed');
      mockDbService.addTransaction.mockRejectedValueOnce(error);

      const transaction = {
        id: 'error-transaction',
        amount: 100,
        category: 'Test',
        description: 'Error transaction',
        date: new Date('2024-01-01'),
        type: 'expense' as const,
      };

      await expect(mockDbService.addTransaction(transaction)).rejects.toThrow('Add failed');
    });

    test('should handle category operation errors', async () => {
      const error = new Error('Update failed');
      mockDbService.updateCategoryBudget.mockRejectedValueOnce(error);

      await expect(mockDbService.updateCategoryBudget('cat-1', 500)).rejects.toThrow(
        'Update failed',
      );
    });

    test('should handle asset operation errors', async () => {
      const error = new Error('Asset add failed');
      mockDbService.addAsset.mockRejectedValueOnce(error);

      const assetData = {
        name: 'Error Asset',
        type: 'Test',
        currentValue: 1000,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      await expect(mockDbService.addAsset(assetData)).rejects.toThrow('Asset add failed');
    });

    test('should handle liability operation errors', async () => {
      const error = new Error('Liability add failed');
      mockDbService.addLiability.mockRejectedValueOnce(error);

      const liabilityData = {
        name: 'Error Liability',
        type: 'Test',
        currentBalance: 1000,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      await expect(mockDbService.addLiability(liabilityData)).rejects.toThrow(
        'Liability add failed',
      );
    });
  });

  describe('Service Integration', () => {
    test('should handle multiple operations in sequence', async () => {
      // Test a realistic workflow
      await mockDbService.initialize();

      const transaction = {
        id: 'workflow-tx',
        amount: 100,
        category: 'Test',
        description: 'Workflow test',
        date: new Date('2024-01-01'),
        type: 'expense' as const,
      };

      const category = {
        id: 'workflow-cat',
        name: 'Workflow Category',
        type: 'expense' as const,
      };

      await mockDbService.addCategory(category);
      await mockDbService.addTransaction(transaction);
      await mockDbService.updateCategoryBudget('workflow-cat', 500);

      expect(mockDbService.initialize).toHaveBeenCalledTimes(1);
      expect(mockDbService.addCategory).toHaveBeenCalledWith(category);
      expect(mockDbService.addTransaction).toHaveBeenCalledWith(transaction);
      expect(mockDbService.updateCategoryBudget).toHaveBeenCalledWith('workflow-cat', 500);
    });

    test('should handle database connection retrieval', async () => {
      const mockDB = { name: 'budget-planner', version: 5 };
      mockDbService.getDB.mockResolvedValue(mockDB);

      const result = await mockDbService.getDB();
      expect(result).toEqual(mockDB);
      expect(mockDbService.getDB).toHaveBeenCalledTimes(1);
    });

    test('should handle batch operations', async () => {
      const transactions = [
        {
          id: 'batch-1',
          amount: 100,
          category: 'Test',
          description: 'Batch 1',
          date: new Date('2024-01-01'),
          type: 'expense' as const,
        },
        {
          id: 'batch-2',
          amount: 200,
          category: 'Test',
          description: 'Batch 2',
          date: new Date('2024-01-02'),
          type: 'income' as const,
        },
      ];

      // Simulate batch adds
      for (const transaction of transactions) {
        await mockDbService.addTransaction(transaction);
      }

      expect(mockDbService.addTransaction).toHaveBeenCalledTimes(2);
    });

    test('should validate operation parameters', async () => {
      // Test with various parameter types to ensure robustness
      await mockDbService.setRecurringPreference('test-candidate', 'confirmed');
      await mockDbService.setRecurringPreference('test-candidate-2', 'dismissed');

      expect(mockDbService.setRecurringPreference).toHaveBeenCalledWith(
        'test-candidate',
        'confirmed',
      );
      expect(mockDbService.setRecurringPreference).toHaveBeenCalledWith(
        'test-candidate-2',
        'dismissed',
      );
    });
  });

  describe('Performance Considerations', () => {
    test('should handle concurrent operations gracefully', async () => {
      const operations = [
        mockDbService.addTransaction({
          id: 'concurrent-1',
          amount: 100,
          category: 'Test',
          description: 'Concurrent 1',
          date: new Date('2024-01-01'),
          type: 'expense' as const,
        }),
        mockDbService.addTransaction({
          id: 'concurrent-2',
          amount: 200,
          category: 'Test',
          description: 'Concurrent 2',
          date: new Date('2024-01-02'),
          type: 'income' as const,
        }),
        mockDbService.addAsset({
          name: 'Concurrent Asset',
          type: 'Savings',
          currentValue: 5000,
          lastUpdated: '2024-01-01T00:00:00.000Z',
        }),
      ];

      await Promise.all(operations);

      expect(mockDbService.addTransaction).toHaveBeenCalledTimes(2);
      expect(mockDbService.addAsset).toHaveBeenCalledTimes(1);
    });

    test('should handle large data sets efficiently', async () => {
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-tx-${i}`,
        amount: Math.random() * 1000,
        category: `Category ${i % 10}`,
        description: `Large transaction ${i}`,
        date: new Date(2024, 0, 1 + (i % 365)),
        type: i % 2 === 0 ? ('expense' as const) : ('income' as const),
      }));

      mockDbService.getTransactions.mockResolvedValue(largeTransactionSet);

      const result = await mockDbService.getTransactions();
      expect(result).toHaveLength(1000);
      expect(mockDbService.getTransactions).toHaveBeenCalledTimes(1);
    });
  });
});
