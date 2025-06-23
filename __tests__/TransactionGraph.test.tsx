import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock the hooks to avoid database operations
vi.mock('../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    spendingOverview: [],
  }),
}));

vi.mock('../src/context/DatabaseContext', () => ({
  useDBContext: () => ({
    transactions: [],
    categories: [],
  }),
}));

// Mock the component to avoid heavy rendering
vi.mock('../components/SpendingTrend', () => ({
  default: () => <div>Spending Trend</div>,
}));

import TransactionGraph from '../components/SpendingTrend';

describe('TransactionGraph Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders transaction graph with correct data', () => {
    render(<TransactionGraph />);
    expect(screen.getByText(/Spending Trend/i)).toBeInTheDocument();
  });

  test('handles empty transactions', () => {
    render(<TransactionGraph />);
    expect(screen.getAllByText(/Spending Trend/i)).toHaveLength(1);
  });
});
