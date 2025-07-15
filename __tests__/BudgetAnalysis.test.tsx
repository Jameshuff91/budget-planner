import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import BudgetGoal from '../components/BudgetGoal';

// Mock localStorage for this component
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Use Object.defineProperty to mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('BudgetGoal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('10000');
  });

  test('renders budget goal component', () => {
    render(<BudgetGoal />);
    expect(screen.getByText(/Budget Goal/i)).toBeInTheDocument();
  });

  test('displays goal amount', () => {
    render(<BudgetGoal />);
    expect(screen.getByText(/Goal Amount:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$10,000/i)).toHaveLength(2); // Appears in goal amount and description
  });

  test('shows monthly savings input', () => {
    render(<BudgetGoal />);
    expect(screen.getByLabelText(/Monthly Savings/i)).toBeInTheDocument();
  });

  test('displays time to reach goal', () => {
    render(<BudgetGoal />);
    expect(screen.getByText(/months/i)).toBeInTheDocument();
  });

  test('handles localStorage for goal persistence', () => {
    render(<BudgetGoal />);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('budgetGoal');
  });
});
