import { beforeEach, describe, test } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

import BudgetAnalysis from '@components/SpendingByCategory';
import { useDBContext } from '@context/DatabaseContext';

jest.mock('@context/DatabaseContext');

describe('BudgetAnalysis Component', () => {
  const mockTransactions = [
    { amount: 100, category: 'Food', date: '2024-01-01' },
    { amount: 200, category: 'Rent', date: '2024-01-01' },
    { amount: 50, category: 'Transport', date: '2024-01-01' },
  ];

  beforeEach((): void => {
    (useDBContext as jest.Mock).mockReturnValue({
      transactions: mockTransactions,
    });
  });

  test('renders budget breakdown pie chart correctly', async () => {
    render(<BudgetAnalysis />);

    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    // Check if all categories are displayed
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
  });

  test('calculates correct budget percentages', () => {
    render(<BudgetAnalysis />);

    const total = 350; // 100 + 200 + 50
    const foodPercentage = (100 / total) * 100;
    const rentPercentage = (200 / total) * 100;
    const transportPercentage = (50 / total) * 100;

    expect(screen.getByText(`${foodPercentage.toFixed(1)}%`)).toBeInTheDocument();
    expect(screen.getByText(`${rentPercentage.toFixed(1)}%`)).toBeInTheDocument();
    expect(screen.getByText(`${transportPercentage.toFixed(1)}%`)).toBeInTheDocument();
  });

  test('displays realistic budget ranges', () => {
    render(<BudgetAnalysis />);

    // Check if the budget amounts are within realistic ranges
    const rentElement = screen.getByText(/Rent/i).closest('div');
    const rentAmountText = rentElement?.querySelector('.text-sm')?.textContent;
    const rentAmount = rentAmountText
      ? parseFloat(rentAmountText.match(/\$?([\d,]+(\.\d{2})?)/)?.[1]?.replace(',', '') || '0')
      : 0;

    expect(rentAmount).toBeGreaterThan(0);
    expect(rentAmount).toBeLessThan(10000); // Assuming reasonable rent range

    const foodElement = screen.getByText(/Food/i).closest('div');
    const foodAmountText = foodElement?.querySelector('.text-sm')?.textContent;
    const foodAmount = foodAmountText
      ? parseFloat(foodAmountText.match(/\$?([\d,]+(\.\d{2})?)/)?.[1]?.replace(',', '') || '0')
      : 0;

    expect(foodAmount).toBeGreaterThan(0);
    expect(foodAmount).toBeLessThan(2000); // Assuming reasonable monthly food budget
  });
});
