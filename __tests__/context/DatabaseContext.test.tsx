import React from 'react';
import { render, renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { DatabaseProvider, useDBContext } from '@context/DatabaseContext';
import { Asset, Liability } from '@services/db';

// Mock dependencies
vi.mock('@services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@services/pdfService', () => ({
  pdfService: {
    reprocessStoredPDFs: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@utils/helpers', () => ({
  generateUUID: vi.fn(() => `test-uuid-${Date.now()}`),
}));

vi.mock('@utils/offline-queue', () => ({
  offlineQueue: {
    onSync: vi.fn(() => () => {}), // Return unsubscribe function
    queueAddTransaction: vi.fn().mockResolvedValue('queue-id-1'),
    queueUpdateTransaction: vi.fn().mockResolvedValue('queue-id-2'),
    queueDeleteTransaction: vi.fn().mockResolvedValue('queue-id-3'),
  },
}));

vi.mock('@hooks/useOfflineStatus', () => ({
  useOfflineStatus: vi.fn(() => ({ isOffline: false })),
}));

// Mock database service
const mockDbService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getTransactions: vi.fn().mockResolvedValue([]),
  getCategories: vi.fn().mockResolvedValue([]),
  getAllRecurringPreferences: vi.fn().mockResolvedValue({}),
  getAllAssets: vi.fn().mockResolvedValue([]),
  getAllLiabilities: vi.fn().mockResolvedValue([]),
  addTransaction: vi.fn().mockResolvedValue('new-tx-id'),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  clearTransactions: vi.fn().mockResolvedValue(undefined),
  addCategory: vi.fn().mockResolvedValue('new-cat-id'),
  updateCategoryBudget: vi.fn().mockResolvedValue(undefined),
  setRecurringPreference: vi.fn().mockResolvedValue(undefined),
  deleteRecurringPreference: vi.fn().mockResolvedValue(undefined),
  addAsset: vi.fn().mockResolvedValue('new-asset-id'),
  updateAsset: vi.fn().mockResolvedValue(undefined),
  deleteAsset: vi.fn().mockResolvedValue(undefined),
  addLiability: vi.fn().mockResolvedValue('new-liability-id'),
  updateLiability: vi.fn().mockResolvedValue(undefined),
  deleteLiability: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@services/db', () => ({
  dbService: mockDbService,
}));

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}

describe('DatabaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockDbService.getTransactions.mockResolvedValue([]);
    mockDbService.getCategories.mockResolvedValue([]);
    mockDbService.getAllRecurringPreferences.mockResolvedValue({});
    mockDbService.getAllAssets.mockResolvedValue([]);
    mockDbService.getAllLiabilities.mockResolvedValue([]);
  });

  describe('Provider Initialization', () => {
    test('should initialize with loading state', () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      expect(result.current.loading).toBe(true);
    });

    test('should load data on initialization', async () => {
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

      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Test Category',
          type: 'expense' as const,
        },
      ];

      mockDbService.getTransactions.mockResolvedValue(mockTransactions);
      mockDbService.getCategories.mockResolvedValue(mockCategories);

      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.categories).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    test('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useDBContext());
      }).toThrow('useDBContext must be used within a DatabaseProvider');
    });
  });

  describe('Transaction Operations', () => {
    test('should add transaction successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const transactionData = {
        amount: 100,
        category: 'Test',
        description: 'New transaction',
        date: '2024-01-01',
        type: 'expense' as const,
      };

      await act(async () => {
        const id = await result.current.addTransaction(transactionData);
        expect(id).toBeDefined();
      });

      expect(mockDbService.addTransaction).toHaveBeenCalled();
    });

    test('should update transaction successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const transaction = {
        id: 'tx-1',
        amount: 150,
        category: 'Updated',
        description: 'Updated transaction',
        date: '2024-01-01',
        type: 'expense' as const,
      };

      await act(async () => {
        await result.current.updateTransaction(transaction);
      });

      expect(mockDbService.updateTransaction).toHaveBeenCalled();
    });

    test('should delete transaction successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteTransaction('tx-1');
      });

      expect(mockDbService.deleteTransaction).toHaveBeenCalledWith('tx-1');
    });

    test('should clear all transactions', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.clearTransactions();
      });

      expect(mockDbService.clearTransactions).toHaveBeenCalled();
    });
  });

  describe('Category Operations', () => {
    test('should add category successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const categoryData = {
        name: 'New Category',
        type: 'expense' as const,
        budget: 500,
      };

      await act(async () => {
        const id = await result.current.addCategory(categoryData);
        expect(id).toBe('new-cat-id');
      });

      expect(mockDbService.addCategory).toHaveBeenCalled();
    });

    test('should update category budget successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateCategoryBudget('cat-1', 750);
      });

      expect(mockDbService.updateCategoryBudget).toHaveBeenCalledWith('cat-1', 750);
    });
  });

  describe('Asset Operations', () => {
    test('should add asset successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const assetData = {
        name: 'Test Asset',
        type: 'Savings Account',
        currentValue: 10000,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      await act(async () => {
        const id = await result.current.addAsset(assetData);
        expect(id).toBe('new-asset-id');
      });

      expect(mockDbService.addAsset).toHaveBeenCalledWith(assetData);
    });

    test('should update asset successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const asset: Asset = {
        id: 'asset-1',
        name: 'Updated Asset',
        type: 'Investment',
        currentValue: 15000,
        lastUpdated: '2024-01-15T00:00:00.000Z',
      };

      await act(async () => {
        await result.current.updateAsset(asset);
      });

      expect(mockDbService.updateAsset).toHaveBeenCalledWith(asset);
    });

    test('should delete asset successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteAsset('asset-1');
      });

      expect(mockDbService.deleteAsset).toHaveBeenCalledWith('asset-1');
    });
  });

  describe('Liability Operations', () => {
    test('should add liability successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const liabilityData = {
        name: 'Test Liability',
        type: 'Credit Card',
        currentBalance: 2500,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      await act(async () => {
        const id = await result.current.addLiability(liabilityData);
        expect(id).toBe('new-liability-id');
      });

      expect(mockDbService.addLiability).toHaveBeenCalledWith(liabilityData);
    });

    test('should update liability successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const liability: Liability = {
        id: 'liability-1',
        name: 'Updated Liability',
        type: 'Mortgage',
        currentBalance: 200000,
        lastUpdated: '2024-01-15T00:00:00.000Z',
      };

      await act(async () => {
        await result.current.updateLiability(liability);
      });

      expect(mockDbService.updateLiability).toHaveBeenCalledWith(liability);
    });

    test('should delete liability successfully', async () => {
      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteLiability('liability-1');
      });

      expect(mockDbService.deleteLiability).toHaveBeenCalledWith('liability-1');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      const error = new Error('Database initialization failed');
      mockDbService.getTransactions.mockRejectedValue(error);

      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
    });

    test('should handle transaction add errors', async () => {
      mockDbService.addTransaction.mockRejectedValue(new Error('Add failed'));

      const { result } = renderHook(() => useDBContext(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const transactionData = {
        amount: 100,
        category: 'Test',
        description: 'Error transaction',
        date: '2024-01-01',
        type: 'expense' as const,
      };

      await expect(
        act(async () => {
          await result.current.addTransaction(transactionData);
        }),
      ).rejects.toThrow('Add failed');
    });
  });

  describe('Provider Rendering', () => {
    test('should render children correctly', () => {
      const TestComponent = () => {
        const { loading } = useDBContext();
        return <div data-testid='test-component'>Loading: {loading.toString()}</div>;
      };

      const { getByTestId } = render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>,
      );

      expect(getByTestId('test-component')).toBeInTheDocument();
    });

    test('should provide context values to children', async () => {
      const TestComponent = () => {
        const context = useDBContext();
        return (
          <div data-testid='context-values'>
            <div data-testid='transactions-count'>{context.transactions.length}</div>
            <div data-testid='categories-count'>{context.categories.length}</div>
            <div data-testid='loading'>{context.loading.toString()}</div>
          </div>
        );
      };

      const { getByTestId } = render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>,
      );

      expect(getByTestId('transactions-count')).toBeInTheDocument();
      expect(getByTestId('categories-count')).toBeInTheDocument();
      expect(getByTestId('loading')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });
});
