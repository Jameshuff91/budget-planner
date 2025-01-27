import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PDFUpload from '@components/PDFUpload';
import { useToast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { logger } from '@services/logger';

jest.mock('@context/DatabaseContext');
jest.mock('@services/logger');
jest.mock('@components/ui/use-toast');
jest.mock('@services/pdfService');

describe('PDFUpload Component CSV Handling', () => {
  const mockAddTransaction = jest.fn();
  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useDBContext as jest.Mock).mockReturnValue({
      addTransaction: mockAddTransaction,
    });
    (useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    });
  });

  test('handles CSV file upload', async () => {
    const csvContent = 'date,description,amount,category\n2024-01-01,Groceries,-100,Food';
    const file = new File([csvContent], 'transactions.csv', { type: 'text/csv' });

    render(<PDFUpload />);

    const input = screen.getByLabelText(/drag and drop pdf or csv files/i);
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: expect.any(Date),
        description: 'Groceries',
        amount: -100,
        category: 'Food',
        type: 'expense',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: expect.stringContaining('Successfully processed 1 file'),
      })
    );
  });

  test('handles multiple CSV files', async () => {
    const csvContent1 = 'date,description,amount,category\n2024-01-01,Salary,2000,Income';
    const csvContent2 = 'date,description,amount,category\n2024-01-02,Rent,-1000,Housing';

    const files = [
      new File([csvContent1], 'transactions1.csv', { type: 'text/csv' }),
      new File([csvContent2], 'transactions2.csv', { type: 'text/csv' }),
    ];

    render(<PDFUpload />);

    const input = screen.getByLabelText(/drag and drop pdf or csv files/i);
    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledTimes(2);
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: expect.any(Date),
        description: 'Salary',
        amount: 2000,
        category: 'Income',
        type: 'income',
      });
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: expect.any(Date),
        description: 'Rent',
        amount: -1000,
        category: 'Housing',
        type: 'expense',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: expect.stringContaining('Successfully processed 2 file'),
      })
    );
  });

  test('handles invalid CSV files', async () => {
    const invalidContent = 'invalid,csv,content';
    const file = new File([invalidContent], 'invalid.csv', { type: 'text/csv' });

    render(<PDFUpload />);

    const input = screen.getByLabelText(/drag and drop pdf or csv files/i);
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: expect.stringContaining('Failed to process files'),
        })
      );
    });
  });

  test('handles mixed PDF and CSV files', async () => {
    const csvContent = 'date,description,amount,category\n2024-01-01,Groceries,-100,Food';
    const files = [
      new File([csvContent], 'transactions.csv', { type: 'text/csv' }),
      new File(['pdf content'], 'document.pdf', { type: 'application/pdf' }),
    ];

    render(<PDFUpload />);

    const input = screen.getByLabelText(/drag and drop pdf or csv files/i);
    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(mockAddTransaction).toHaveBeenCalledWith({
        date: expect.any(Date),
        description: 'Groceries',
        amount: -100,
        category: 'Food',
        type: 'expense',
      });
    });
  });
});
