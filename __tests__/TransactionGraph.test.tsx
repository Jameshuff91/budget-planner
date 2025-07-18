import { render, screen } from '@testing-library/react';
import { vi, beforeEach, describe, test, expect } from 'vitest';
import SpendingTrend from '../components/SpendingTrend';

// Mock Recharts to avoid rendering issues in test environment
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Create mock functions that can be modified per test
const mockUseAnalytics = vi.fn();
const mockUseDBContext = vi.fn();

// Mock the hooks
vi.mock('../src/hooks/useAnalytics', () => ({
  useAnalytics: () => mockUseAnalytics(),
}));

vi.mock('../src/context/DatabaseContext', () => ({
  useDBContext: () => mockUseDBContext(),
}));

describe('SpendingTrend Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default mock values
    mockUseDBContext.mockReturnValue({
      transactions: [],
      categories: [],
      loading: false,
    });
  });

  test('renders spending trend chart with correct title', () => {
    mockUseAnalytics.mockReturnValue({
      spendingOverview: [
        {
          month: 'Jan',
          year: 2024,
          totalSpending: 2500,
          totalIncome: 5000,
        },
        {
          month: 'Feb',
          year: 2024,
          totalSpending: 2800,
          totalIncome: 5000,
        },
      ],
    });

    render(<SpendingTrend />);
    expect(screen.getByText('Spending Trend & Forecast')).toBeInTheDocument();
  });

  test('handles empty data gracefully', () => {
    mockUseAnalytics.mockReturnValue({
      spendingOverview: [],
    });

    render(<SpendingTrend />);
    expect(screen.getByText('No trend data available')).toBeInTheDocument();
  });

  test('shows loading state when data is loading', () => {
    mockUseDBContext.mockReturnValue({
      transactions: [],
      categories: [],
      loading: true,
    });

    mockUseAnalytics.mockReturnValue({
      spendingOverview: [],
    });

    const { container } = render(<SpendingTrend />);
    // ChartSkeleton should be rendered when loading
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
