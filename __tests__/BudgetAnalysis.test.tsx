import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import BudgetAnalysis from '../components/BudgetGoal';

// Mock the entire module at the top level without spying on non-function values
vi.mock('../src/context/DatabaseContext', () => ({
  useDBContext: () => ({
    transactions: [],
    categories: [],
  })
}));

describe('BudgetAnalysis Component', () => {
  const mockTransactions = [
    { amount: -100, category: 'Food', date: new Date('2024-01-01') },
    { amount: -200, category: 'Rent', date: new Date('2024-01-02') },
    { amount: 500, category: 'Salary', date: new Date('2024-01-03'), type: 'income' },
  ];

  const mockCategories = [
    { id: '1', name: 'Food', budget: 150, warningThreshold: 120 },
    { id: '2', name: 'Rent', budget: 1000, warningThreshold: 800 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // No need to mock again, as it's done at the top level
  });

  test('renders budget analysis with correct data', () => {
    render(<BudgetAnalysis />);
    expect(screen.getByText(/Budget Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Food/i)).toBeInTheDocument();
    expect(screen.getByText(/Rent/i)).toBeInTheDocument();
  });

  test('displays correct spending for each category', () => {
    render(<BudgetAnalysis />);
    expect(screen.getByText(/\$100/i)).toBeInTheDocument(); // Food
    expect(screen.getByText(/\$200/i)).toBeInTheDocument(); // Rent
  });

  test('shows budget status correctly', () => {
    render(<BudgetAnalysis />);
    expect(screen.getByText(/of \$150/i)).toBeInTheDocument(); // Food budget
    expect(screen.getByText(/of \$1000/i)).toBeInTheDocument(); // Rent budget
  });

  test('highlights categories over warning threshold', () => {
    render(<BudgetAnalysis />);
    const foodElement = screen.getByText(/Food/i).closest('div');
    expect(foodElement).toHaveClass('text-red-500'); // Food over warning threshold (100 > 120)
  });

  test('handles empty transactions', () => {
    render(<BudgetAnalysis />);
    expect(screen.getByText(/\$0/i)).toBeInTheDocument();
  });
});
