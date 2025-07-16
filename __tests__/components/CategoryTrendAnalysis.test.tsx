import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CategoryTrendAnalysis from '../../components/CategoryTrendAnalysis';
import { DatabaseProvider } from '../../src/context/DatabaseContext';
import { vi } from 'vitest';

// Mock the chart components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey }: any) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock transactions data
const mockTransactions = [
  {
    id: '1',
    date: new Date('2024-01-15').toISOString(),
    description: 'Grocery Store',
    amount: 100,
    type: 'expense' as const,
    category: 'Food',
  },
  {
    id: '2',
    date: new Date('2024-01-20').toISOString(),
    description: 'Gas Station',
    amount: 50,
    type: 'expense' as const,
    category: 'Transportation',
  },
  {
    id: '3',
    date: new Date('2024-02-10').toISOString(),
    description: 'Restaurant',
    amount: 75,
    type: 'expense' as const,
    category: 'Food',
  },
  {
    id: '4',
    date: new Date('2024-02-15').toISOString(),
    description: 'Electric Bill',
    amount: 120,
    type: 'expense' as const,
    category: 'Utilities',
  },
];

const mockCategories = [
  { id: '1', name: 'Food', type: 'expense' as const, budget: 500 },
  { id: '2', name: 'Transportation', type: 'expense' as const, budget: 200 },
  { id: '3', name: 'Utilities', type: 'expense' as const, budget: 150 },
];

describe('CategoryTrendAnalysis', () => {
  const mockContextValue = {
    transactions: mockTransactions,
    categories: mockCategories,
    loading: false,
    error: null,
    // Add other required context properties
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    updateCategoryBudget: vi.fn(),
    pdfs: [],
    addPDF: vi.fn(),
    deletePDF: vi.fn(),
    assets: [],
    liabilities: [],
    addAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
    addLiability: vi.fn(),
    updateLiability: vi.fn(),
    deleteLiability: vi.fn(),
    recurringPreferences: [],
    addRecurringPreference: vi.fn(),
    updateRecurringPreference: vi.fn(),
    deleteRecurringPreference: vi.fn(),
    getTransactionsByDateRange: vi.fn(),
    monthlyStats: { totalIncome: 0, totalExpenses: 0 },
  };

  it('renders without crashing', () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    expect(screen.getByText('Category Spending Trends')).toBeInTheDocument();
  });

  it('displays available categories in the selection list', () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
  });

  it('allows toggling category selection', async () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    const foodCheckbox = screen.getByRole('checkbox', { name: /Food/i });
    
    // Food should be selected by default (top 3 categories)
    expect(foodCheckbox).toBeChecked();
    
    // Uncheck Food
    fireEvent.click(foodCheckbox);
    await waitFor(() => {
      expect(foodCheckbox).not.toBeChecked();
    });
    
    // Check it again
    fireEvent.click(foodCheckbox);
    await waitFor(() => {
      expect(foodCheckbox).toBeChecked();
    });
  });

  it('handles Top 5 button click', async () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    const top5Button = screen.getByRole('button', { name: /Top 5/i });
    fireEvent.click(top5Button);
    
    // Since we only have 3 categories, all should be selected
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });
  });

  it('handles Select All / Clear All button', async () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    const selectAllButton = screen.getByRole('button', { name: /Select All/i });
    
    // Click Select All
    fireEvent.click(selectAllButton);
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });
    
    // Button should now say "Clear All"
    const clearAllButton = screen.getByRole('button', { name: /Clear All/i });
    fireEvent.click(clearAllButton);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  it('shows no data message when no categories are selected', () => {
    const emptyContext = {
      ...mockContextValue,
      transactions: [],
    };
    
    render(
      <DatabaseProvider value={emptyContext}>
        <CategoryTrendAnalysis />
      </DatabaseProvider>
    );
    
    expect(screen.getByText('No categories selected')).toBeInTheDocument();
  });

  it('respects selectedYear prop', () => {
    render(
      <DatabaseProvider value={mockContextValue}>
        <CategoryTrendAnalysis selectedYear={2023} />
      </DatabaseProvider>
    );
    
    // Component should render without errors
    expect(screen.getByText('Category Spending Trends')).toBeInTheDocument();
  });
});