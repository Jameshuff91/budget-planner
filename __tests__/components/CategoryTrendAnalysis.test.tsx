import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CategoryTrendAnalysis from '../../components/CategoryTrendAnalysis';
import { vi } from 'vitest';

// Mock the DatabaseContext
vi.mock('@context/DatabaseContext', () => {
  const mockUseDBContext = vi.fn();
  return {
    useDBContext: mockUseDBContext,
    __mockUseDBContext: mockUseDBContext,
  };
});

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

// Import the mock function
import { __mockUseDBContext } from '@context/DatabaseContext';

// Mock transactions data with recent dates
const currentDate = new Date();
const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15);
const twoMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 10);

const mockTransactions = [
  {
    id: '1',
    date: lastMonth.toISOString(),
    description: 'Grocery Store',
    amount: 100,
    type: 'expense' as const,
    category: 'Food',
  },
  {
    id: '2',
    date: lastMonth.toISOString(),
    description: 'Gas Station',
    amount: 50,
    type: 'expense' as const,
    category: 'Transportation',
  },
  {
    id: '3',
    date: twoMonthsAgo.toISOString(),
    description: 'Restaurant',
    amount: 75,
    type: 'expense' as const,
    category: 'Food',
  },
  {
    id: '4',
    date: twoMonthsAgo.toISOString(),
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

const mockContextValue = {
  transactions: mockTransactions,
  categories: mockCategories,
  loading: false,
  error: null,
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  importData: vi.fn(),
  exportData: vi.fn(),
};

describe('CategoryTrendAnalysis', () => {
  const mockUseDBContext = __mockUseDBContext as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock context values
    mockUseDBContext.mockReturnValue({
      transactions: mockTransactions,
      categories: mockCategories,
      loading: false,
      error: null,
    });
  });

  it('renders without crashing', () => {
    render(<CategoryTrendAnalysis />);
    
    expect(screen.getByText('Category Spending Trends')).toBeInTheDocument();
  });

  it('displays available categories in the selection list', () => {
    render(<CategoryTrendAnalysis />);
    
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Transportation')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
  });

  it('allows toggling category selection', async () => {
    render(<CategoryTrendAnalysis />);
    
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
    render(<CategoryTrendAnalysis />);
    
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
    __mockUseDBContext.mockReturnValue(mockContextValue);
    
    render(<CategoryTrendAnalysis />);
    
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
    
    __mockUseDBContext.mockReturnValue(emptyContext);
    
    render(<CategoryTrendAnalysis />);
    
    expect(screen.getByText('No categories selected')).toBeInTheDocument();
  });

  it('respects selectedYear prop', () => {
    __mockUseDBContext.mockReturnValue(mockContextValue);
    
    render(<CategoryTrendAnalysis selectedYear={2023} />);
    
    // Component should render without errors
    expect(screen.getByText('Category Spending Trends')).toBeInTheDocument();
  });
});