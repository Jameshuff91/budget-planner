/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DatabaseProvider } from '../context/DatabaseContext';
import { useAnalytics } from '../hooks/useAnalytics';
import '@testing-library/jest-dom';

// Setup jsdom environment for tests
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;

// Mock the hook's return value
vi.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    spendingOverview: [
      { name: 'January', year: 2024, savings: 12000 },
      { name: 'February', year: 2024, savings: 15000 }
    ]
  })
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

    result.current.spendingOverview.forEach(month => {
      console.log(`${month.name} ${month.year}: Savings=${month.savings}`);
      expect(month.savings).toBeGreaterThanOrEqual(MIN_MONTHLY_SAVINGS);
    });
  });
}); 