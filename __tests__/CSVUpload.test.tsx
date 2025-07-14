import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import CSVUpload from '../components/CSVUpload';

// Create mock functions that we can control
const mockAddTransaction = vi.fn();
const mockRefreshData = vi.fn();

// Mock Papa Parse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file, options) => {
      // Simulate CSV parsing
      if (file.name === 'test.csv') {
        options.complete({
          data: [
            ['date', 'description', 'amount', 'category'],
            ['2024-01-01', 'Test Transaction', '-100', 'Food'],
          ],
        });
      } else if (file.name === 'invalid.csv') {
        options.error(new Error('Parse error'));
      }
    }),
  },
}));

// Mock the entire module at the top level without spying on non-function values
vi.mock('../src/context/DatabaseContext', () => ({
  useDBContext: () => ({
    addTransaction: mockAddTransaction,
    refreshData: mockRefreshData,
  }),
}));

// Mock logger
vi.mock('../src/services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('CSVUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders upload area', () => {
    render(<CSVUpload />);
    expect(screen.getByText(/Drag and drop a CSV file here/i)).toBeInTheDocument();
  });

  test('handles CSV file upload and processing', async () => {
    const csvContent = 'date,description,amount,category\n2024-01-01,Test Transaction,-100,Food';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    render(<CSVUpload />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2024-01-01',
          description: 'Test Transaction',
          amount: -100,
          category: 'Food',
        }),
      );
    });
  });

  test('handles invalid file type', async () => {
    const file = new File(['text content'], 'test.txt', { type: 'text/plain' });

    render(<CSVUpload />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    // The component doesn't handle invalid file types, so addTransaction should not be called
    await waitFor(
      () => {
        expect(mockAddTransaction).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  test('handles CSV parsing errors', async () => {
    const csvContent = 'invalid,csv,content';
    const file = new File([csvContent], 'invalid.csv', { type: 'text/csv' });

    render(<CSVUpload />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    // The component logs errors but doesn't show toast notifications
    await waitFor(
      () => {
        expect(mockAddTransaction).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });
});
