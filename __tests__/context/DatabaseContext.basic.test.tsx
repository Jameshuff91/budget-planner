import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { DatabaseProvider, useDBContext } from '@context/DatabaseContext';

// Basic mocks
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
  generateUUID: vi.fn(() => 'test-uuid'),
}));

vi.mock('@utils/offline-queue', () => ({
  offlineQueue: {
    onSync: vi.fn(() => () => {}),
    queueAddTransaction: vi.fn().mockResolvedValue('queue-id'),
    queueUpdateTransaction: vi.fn().mockResolvedValue('queue-id'),
    queueDeleteTransaction: vi.fn().mockResolvedValue('queue-id'),
  },
}));

vi.mock('@hooks/useOfflineStatus', () => ({
  useOfflineStatus: vi.fn(() => ({ isOffline: false })),
}));

// Simple mock database service
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

describe('DatabaseContext Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render provider without crashing', () => {
    const TestComponent = () => <div>Test</div>;

    expect(() => {
      render(
        <DatabaseProvider>
          <TestComponent />
        </DatabaseProvider>,
      );
    }).not.toThrow();
  });

  test('should throw error when hook used outside provider', () => {
    const TestComponent = () => {
      useDBContext();
      return <div>Test</div>;
    };

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useDBContext must be used within a DatabaseProvider');
  });

  test('should provide context when used within provider', () => {
    const TestComponent = () => {
      const context = useDBContext();
      return <div data-testid='context-test'>{typeof context}</div>;
    };

    const { getByTestId } = render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>,
    );

    expect(getByTestId('context-test')).toHaveTextContent('object');
  });

  test('should provide loading state initially', () => {
    const TestComponent = () => {
      const { loading } = useDBContext();
      return <div data-testid='loading-state'>{loading.toString()}</div>;
    };

    const { getByTestId } = render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>,
    );

    expect(getByTestId('loading-state')).toHaveTextContent('true');
  });

  test('should provide empty arrays initially', () => {
    const TestComponent = () => {
      const { transactions, categories, assets, liabilities } = useDBContext();
      return (
        <div>
          <div data-testid='transactions-length'>{transactions.length}</div>
          <div data-testid='categories-length'>{categories.length}</div>
          <div data-testid='assets-length'>{assets.length}</div>
          <div data-testid='liabilities-length'>{liabilities.length}</div>
        </div>
      );
    };

    const { getByTestId } = render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>,
    );

    expect(getByTestId('transactions-length')).toHaveTextContent('0');
    expect(getByTestId('categories-length')).toHaveTextContent('0');
    expect(getByTestId('assets-length')).toHaveTextContent('0');
    expect(getByTestId('liabilities-length')).toHaveTextContent('0');
  });

  test('should provide all required context methods', () => {
    const TestComponent = () => {
      const context = useDBContext();
      const methods = [
        'addTransaction',
        'addTransactionsBatch',
        'updateTransaction',
        'deleteTransaction',
        'clearTransactions',
        'addCategory',
        'updateCategoryBudget',
        'setRecurringPreference',
        'deleteRecurringPreference',
        'addAsset',
        'updateAsset',
        'deleteAsset',
        'addLiability',
        'updateLiability',
        'deleteLiability',
        'refreshData',
        'getTransactionsByMonth',
      ];

      const allMethodsPresent = methods.every((method) => typeof context[method] === 'function');

      return <div data-testid='methods-check'>{allMethodsPresent.toString()}</div>;
    };

    const { getByTestId } = render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>,
    );

    expect(getByTestId('methods-check')).toHaveTextContent('true');
  });

  test('should provide error state as null initially', () => {
    const TestComponent = () => {
      const { error } = useDBContext();
      return <div data-testid='error-state'>{error ? 'error' : 'null'}</div>;
    };

    const { getByTestId } = render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>,
    );

    expect(getByTestId('error-state')).toHaveTextContent('null');
  });
});
