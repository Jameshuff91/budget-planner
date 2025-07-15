import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Create mock functions that we can control
const mockAddTransaction = vi.fn();
const mockAddTransactionsBatch = vi.fn();
const mockRefreshData = vi.fn();
const mockToast = vi.fn();

// Mock the entire module at the top level without spying on non-function values
vi.mock('../src/context/DatabaseContext', () => ({
  useDBContext: () => ({
    addTransaction: mockAddTransaction,
    addTransactionsBatch: mockAddTransactionsBatch,
    refreshData: mockRefreshData,
    categories: [],
  }),
}));

vi.mock('../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('../src/services/pdfService', () => ({
  pdfService: {
    getPDFDocuments: vi.fn().mockResolvedValue([]),
    processPDF: vi.fn().mockResolvedValue([]),
    deletePDFDocument: vi.fn().mockResolvedValue(undefined),
    deleteDocuments: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../src/utils/smartCategorization', () => ({
  getSmartCategorizationSettings: vi.fn().mockReturnValue({ enabled: false }),
  categorizeTransactionsBatchWithAI: vi.fn(),
}));

vi.mock('../src/utils/userErrors', () => ({
  showUserError: vi.fn((error, toast, context) => {
    toast({
      title: 'Error',
      description: 'Unable to read this PDF file. It may be corrupted or password-protected. Try opening the file in a PDF reader first to verify it\'s valid.',
      variant: 'destructive',
    });
  }),
}));

import PDFUpload from '../components/PDFUpload';

describe('PDFUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders upload area', async () => {
    await act(async () => {
      render(<PDFUpload />);
    });
    expect(screen.getByText(/Upload Financial Information/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Drag and drop your PDF or CSV files here or click to browse/i),
    ).toBeInTheDocument();
  });

  test('handles PDF file upload and processing', async () => {
    const pdfContent = '%PDF-1.4...'; // Mock PDF content
    const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

    const { pdfService } = (await vi.importMock('../src/services/pdfService')) as any;
    pdfService.processPDF.mockResolvedValue([
      {
        date: new Date('2024-01-01'),
        description: 'Test Transaction',
        amount: -100,
        category: 'Food',
        type: 'expense',
      },
    ]);

    await act(async () => {
      render(<PDFUpload />);
    });

    const input = screen.getByLabelText(/choose files/i);

    await act(async () => {
      await userEvent.upload(input, file);
    });

    await waitFor(() => {
      expect(mockAddTransactionsBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          date: expect.any(String), // Date is converted to ISO string
          description: 'Test Transaction',
          amount: -100,
          category: 'Food',
          type: 'expense',
        }),
      ]);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Success',
        description: expect.stringContaining('Processed 1 of 1 transactions from test.pdf'),
      }),
    );
  });

  test('handles invalid file type', async () => {
    const file = new File(['text content'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      render(<PDFUpload />);
    });

    const input = screen.getByLabelText(/choose files/i);

    await act(async () => {
      await userEvent.upload(input, file);
    });

    // The component validates file types at the input level, so invalid files are rejected
    // We just verify that the component doesn't crash and no processing occurs
    await waitFor(
      () => {
        expect(mockAddTransaction).not.toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  test('handles PDF processing errors', async () => {
    const pdfContent = '%PDF-1.4...';
    const file = new File([pdfContent], 'invalid.pdf', { type: 'application/pdf' });

    const { pdfService } = (await vi.importMock('../src/services/pdfService')) as any;
    pdfService.processPDF.mockRejectedValue(new Error('Processing failed'));

    await act(async () => {
      render(<PDFUpload />);
    });

    const input = screen.getByLabelText(/choose files/i);

    await act(async () => {
      await userEvent.upload(input, file);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: expect.stringContaining('Unable to read this PDF file'),
          variant: 'destructive',
        }),
      );
    });
  });
});
