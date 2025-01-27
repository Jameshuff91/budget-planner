import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PDFUpload from '@components/PDFUpload';
import { useDBContext } from '@context/DatabaseContext';
import { logger } from '@services/logger';
import { pdfService } from '@services/pdfService';

// Mock the dependencies
jest.mock('@context/DatabaseContext');
jest.mock('@services/pdfService');
jest.mock('@services/logger');

describe('PDFUpload Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('allows multiple file uploads', async () => {
    const mockAddTransaction = jest.fn();
    (useDBContext as jest.Mock).mockReturnValue({ addTransaction: mockAddTransaction });

    const files = [
      new File(['file1 content'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['file2 content'], 'file2.pdf', { type: 'application/pdf' }),
    ];

    render(<PDFUpload />);

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, files);

    expect(pdfService.processPDF).toHaveBeenCalledTimes(2);
    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
  });

  test('handles drag and drop file upload', async () => {
    render(<PDFUpload />);

    const dropzone = screen.getByTestId('dropzone');

    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('dragging');

    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass('dragging');

    const files = [new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })];

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files,
      },
    });

    await waitFor(() => {
      expect(pdfService.processPDF).toHaveBeenCalledWith(files[0]);
    });
  });

  test('shows error toast for invalid file types', async () => {
    const files = [new File(['invalid content'], 'test.txt', { type: 'text/plain' })];

    render(<PDFUpload />);

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, files);

    expect(screen.getByText('Invalid file type')).toBeInTheDocument();
  });
});
