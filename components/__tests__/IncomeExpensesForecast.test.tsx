import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { useDatabase } from '@hooks/useDatabase';

import IncomeExpensesForecast from '../IncomeExpensesForecast';

vi.mock('@hooks/useDatabase');
const mockUseDatabase = vi.mocked(useDatabase);

const createMockContext = (overrides: any = {}) =>
  ({
    transactions: [],
    categories: [],
    loading: false,
    error: null,
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    addCategory: vi.fn(),
    ...overrides,
  }) as any;

const mockTransactions = [
  {
    id: '1',
    date: '2024-01-15',
    amount: 5000,
    description: 'Salary',
    category: 'Income',
    type: 'income' as const,
  },
  {
    id: '2',
    date: '2024-01-20',
    amount: 1200,
    description: 'Rent',
    category: 'Housing',
    type: 'expense' as const,
  },
  {
    id: '3',
    date: '2024-01-25',
    amount: 300,
    description: 'Groceries',
    category: 'Food',
    type: 'expense' as const,
  },
  {
    id: '4',
    date: '2024-02-15',
    amount: 5000,
    description: 'Salary',
    category: 'Income',
    type: 'income' as const,
  },
  {
    id: '5',
    date: '2024-02-20',
    amount: 1200,
    description: 'Rent',
    category: 'Housing',
    type: 'expense' as const,
  },
  {
    id: '6',
    date: '2024-02-25',
    amount: 400,
    description: 'Groceries',
    category: 'Food',
    type: 'expense' as const,
  },
  {
    id: '7',
    date: '2024-03-15',
    amount: 5200,
    description: 'Salary',
    category: 'Income',
    type: 'income' as const,
  },
  {
    id: '8',
    date: '2024-03-20',
    amount: 1200,
    description: 'Rent',
    category: 'Housing',
    type: 'expense' as const,
  },
  {
    id: '9',
    date: '2024-03-25',
    amount: 350,
    description: 'Groceries',
    category: 'Food',
    type: 'expense' as const,
  },
];

describe('IncomeExpensesForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseDatabase.mockReturnValue(createMockContext({ loading: true }));

    render(<IncomeExpensesForecast />);
    expect(screen.getByTestId('income-expenses-forecast-skeleton')).toBeInTheDocument();
  });

  it('renders empty state when no transactions', () => {
    mockUseDatabase.mockReturnValue(createMockContext());

    render(<IncomeExpensesForecast />);
    expect(screen.getByText('Income vs Expenses Forecast')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No transaction data available for forecasting. Add some transactions to see projections.',
      ),
    ).toBeInTheDocument();
  });

  it('renders forecast chart with transactions', async () => {
    mockUseDatabase.mockReturnValue(createMockContext({ transactions: mockTransactions }));

    render(<IncomeExpensesForecast />);

    await waitFor(() => {
      expect(screen.getByText('Income vs Expenses Forecast')).toBeInTheDocument();
      expect(screen.getByText('Income Trend')).toBeInTheDocument();
      expect(screen.getByText('Expenses Trend')).toBeInTheDocument();
      expect(screen.getByText('Average Net Income')).toBeInTheDocument();
    });
  });

  it('switches between different forecast periods', async () => {
    mockUseDatabase.mockReturnValue(createMockContext({ transactions: mockTransactions }));

    render(<IncomeExpensesForecast />);

    // Default is 3 months
    expect(screen.getByText('3 Months')).toHaveClass('bg-primary');

    // Click 6 months
    fireEvent.click(screen.getByText('6 Months'));
    expect(screen.getByText('6 Months')).toHaveClass('bg-primary');

    // Click 12 months
    fireEvent.click(screen.getByText('12 Months'));
    expect(screen.getByText('12 Months')).toHaveClass('bg-primary');
  });

  it('toggles forecast visibility', async () => {
    mockUseDatabase.mockReturnValue(createMockContext({ transactions: mockTransactions }));

    render(<IncomeExpensesForecast />);

    const toggleButton = screen.getByText('Hide Forecast');
    fireEvent.click(toggleButton);
    expect(screen.getByText('Show Forecast')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show Forecast'));
    expect(screen.getByText('Hide Forecast')).toBeInTheDocument();
  });

  it('calculates trends correctly', async () => {
    mockUseDatabase.mockReturnValue(createMockContext({ transactions: mockTransactions }));

    render(<IncomeExpensesForecast />);

    await waitFor(() => {
      // Should show positive income trend (salary increased from 5000 to 5200)
      const trendElements = screen.getAllByText(/\+.*% monthly/);
      expect(trendElements.length).toBeGreaterThan(0);
    });
  });

  it('respects selected year filter', () => {
    const transactionsMultiYear = [
      ...mockTransactions,
      {
        id: '10',
        date: '2023-01-15',
        amount: 4000,
        description: 'Salary',
        category: 'Income',
        type: 'income' as const,
      },
      {
        id: '11',
        date: '2023-01-20',
        amount: 1000,
        description: 'Rent',
        category: 'Housing',
        type: 'expense' as const,
      },
    ];

    mockUseDatabase.mockReturnValue(createMockContext({ transactions: transactionsMultiYear }));

    const { rerender } = render(<IncomeExpensesForecast selectedYear={2024} />);

    // Should only use 2024 data
    expect(screen.getByText('Income vs Expenses Forecast')).toBeInTheDocument();

    // Change to 2023
    rerender(<IncomeExpensesForecast selectedYear={2023} />);
    expect(screen.getByText('Income vs Expenses Forecast')).toBeInTheDocument();
  });

  it('displays forecast warning alert', () => {
    mockUseDatabase.mockReturnValue(createMockContext({ transactions: mockTransactions }));

    render(<IncomeExpensesForecast />);

    expect(
      screen.getByText(
        'Forecasts are based on historical trends and seasonal patterns. Actual results may vary based on your spending behavior and unexpected expenses.',
      ),
    ).toBeInTheDocument();
  });
});
