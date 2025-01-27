import { render, screen } from '@testing-library/react';

import TransactionGraph from '@components/SpendingTrend';
import { useDBContext } from '@context/DatabaseContext';

jest.mock('@context/DatabaseContext');

describe('TransactionGraph Component', () => {
  const mockTransactions = [
    { amount: 100, category: 'Food', date: '2024-01-01' },
    { amount: 150, category: 'Food', date: '2024-01-02' },
    { amount: 200, category: 'Rent', date: '2024-01-03' },
  ];

  beforeEach(() => {
    (useDBContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions,
    });
  });

  test('renders graph with correct data points', () => {
    render(<TransactionGraph />);

    const graph = screen.getByTestId('transaction-graph');
    expect(graph).toBeInTheDocument();

    // Check if data points are rendered
    mockTransactions.forEach((transaction) => {
      expect(screen.getByText(transaction.amount.toString())).toBeInTheDocument();
    });
  });

  test('displays correct date range on x-axis', () => {
    render(<TransactionGraph />);

    expect(screen.getByText('Jan 1')).toBeInTheDocument();
    expect(screen.getByText('Jan 2')).toBeInTheDocument();
    expect(screen.getByText('Jan 3')).toBeInTheDocument();
  });

  test('shows correct amount range on y-axis', () => {
    render(<TransactionGraph />);

    // Check if y-axis shows range from min to max transaction amount
    const minAmount = Math.min(...mockTransactions.map((t) => t.amount));
    const maxAmount = Math.max(...mockTransactions.map((t) => t.amount));

    expect(screen.getByText(minAmount.toString())).toBeInTheDocument();
    expect(screen.getByText(maxAmount.toString())).toBeInTheDocument();
  });

  test('updates graph when transactions change', () => {
    const { rerender } = render(<TransactionGraph />);

    const newTransactions = [
      ...mockTransactions,
      { amount: 300, category: 'Entertainment', date: '2024-01-04' },
    ];

    (useDBContext as jest.Mock).mockReturnValue({
      transactions: newTransactions,
    });

    rerender(<TransactionGraph />);

    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('Jan 4')).toBeInTheDocument();
  });

  test('handles empty transaction list', () => {
    (useDBContext as jest.Mock).mockReturnValue({
      transactions: [],
    });

    render(<TransactionGraph />);

    expect(screen.getByText('No transaction data available')).toBeInTheDocument();
  });
});
