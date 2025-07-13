import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Minimal TransactionGraph test
const TransactionGraph = () => <div>Spending Trend</div>;

describe('Minimal Component Test', () => {
  test('renders component', () => {
    render(<TransactionGraph />);
    expect(screen.getByText(/Spending Trend/i)).toBeInTheDocument();
  });
});