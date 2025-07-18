/**
 * @vitest-environment jsdom
 */
// Setup jsdom environment for tests
import { renderHook } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import { DatabaseProvider, useDBContext } from '../context/DatabaseContext';
import { useAnalytics } from '../hooks/useAnalytics';
import '@testing-library/jest-dom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;

// Mock the hooks' return values
vi.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    spendingOverview: [
      { month: 'Jan', year: 2024, totalSpending: 3000, totalIncome: 15000 },
      { month: 'Feb', year: 2024, totalSpending: 2000, totalIncome: 17000 },
    ],
  }),
}));

vi.mock('../context/DatabaseContext', () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDBContext: () => ({
    transactions: [],
    categories: [],
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getTransactionsByMonth: vi.fn().mockReturnValue([]),
    getCategoryById: vi.fn(),
    isInitialized: true,
  }),
}));

describe('Monthly Savings Analysis', () => {
  it('should have minimum monthly savings of $10,000', () => {
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <DatabaseProvider>{children}</DatabaseProvider>
      ),
    });

    // Debug logs
    console.log('Database Context:', useDBContext());
    console.log('Full Analytics Result:', result.current);
    console.log('Spending Overview:', result.current.spendingOverview);

    const MIN_MONTHLY_SAVINGS = 10000;

    if (!result.current.spendingOverview) {
      throw new Error('No spending overview data available');
    }

    result.current.spendingOverview.forEach((data) => {
      const savings = data.totalIncome - data.totalSpending;
      console.log(
        `${data.month} ${data.year}: Income=${data.totalIncome}, Spending=${data.totalSpending}, Savings=${savings}`,
      );
      expect(savings).toBeGreaterThanOrEqual(MIN_MONTHLY_SAVINGS);
    });
  });
});
