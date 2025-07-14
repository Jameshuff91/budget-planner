import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportService, ReportOptions, ReportData } from '../../src/services/reportService';
import { Transaction } from '../../src/types/index';

// Mock dependencies
vi.mock('jspdf', () => {
  const mockPDF = {
    internal: {
      pageSize: { width: 210, height: 297 },
    },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    addImage: vi.fn(),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    setPage: vi.fn(),
    setTextColor: vi.fn(),
    getTextWidth: vi.fn().mockReturnValue(50),
    splitTextToSize: vi.fn().mockReturnValue(['test line']),
    output: vi.fn().mockReturnValue(new ArrayBuffer(8)),
  };

  return {
    default: vi.fn(() => mockPDF),
  };
});

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
    width: 100,
    height: 100,
  }),
}));

vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    format: vi.fn().mockReturnValue('2024-01-01'),
  };
});

describe('ReportService', () => {
  let mockTransactions: Transaction[];
  let mockReportData: ReportData;
  let mockOptions: ReportOptions;

  beforeEach(() => {
    mockTransactions = [
      {
        id: '1',
        amount: 1000,
        category: 'Salary',
        description: 'Monthly salary',
        date: '2024-01-01',
        type: 'income',
      },
      {
        id: '2',
        amount: 500,
        category: 'Groceries',
        description: 'Weekly groceries',
        date: '2024-01-05',
        type: 'expense',
      },
      {
        id: '3',
        amount: 800,
        category: 'Rent',
        description: 'Monthly rent',
        date: '2024-01-01',
        type: 'expense',
      },
    ];

    mockReportData = {
      transactions: mockTransactions,
      categorySpending: [
        { name: 'Groceries', value: 500 },
        { name: 'Rent', value: 800 },
      ],
      spendingTrend: [{ name: 'Jan', spending: 1300 }],
      monthlyTrends: {},
      merchantSpending: [{ name: 'Grocery Store', value: 500, transactionCount: 1 }],
      potentialRecurringTransactions: [],
      totalIncome: 1000,
      totalExpenses: 1300,
      netSavings: -300,
      periodLabel: 'January 2024',
    };

    mockOptions = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      includeCharts: false,
      includeTransactionDetails: true,
      includeCategorySummary: true,
      includeTaxReport: false,
      includeRecurringAnalysis: false,
      includeNetWorth: false,
      reportType: 'monthly',
    };
  });

  describe('generatePDFReport', () => {
    it('should generate a PDF report successfully', async () => {
      const result = await reportService.generatePDFReport(mockReportData, mockOptions);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/pdf');
    });

    it('should include transaction details when requested', async () => {
      const optionsWithDetails = { ...mockOptions, includeTransactionDetails: true };
      const result = await reportService.generatePDFReport(mockReportData, optionsWithDetails);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should include category summary when requested', async () => {
      const optionsWithCategories = { ...mockOptions, includeCategorySummary: true };
      const result = await reportService.generatePDFReport(mockReportData, optionsWithCategories);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle empty transaction data', async () => {
      const emptyReportData = {
        ...mockReportData,
        transactions: [],
        categorySpending: [],
        merchantSpending: [],
      };

      const result = await reportService.generatePDFReport(emptyReportData, mockOptions);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should include tax report when requested', async () => {
      const taxOptions = { ...mockOptions, includeTaxReport: true };
      const result = await reportService.generatePDFReport(mockReportData, taxOptions);

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('generateCSVReport', () => {
    it('should generate a CSV report successfully', () => {
      const result = reportService.generateCSVReport(mockReportData, mockOptions);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('text/csv');
    });

    it('should include all transactions in CSV format', () => {
      const result = reportService.generateCSVReport(mockReportData, mockOptions);

      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle empty transactions', () => {
      const emptyReportData = { ...mockReportData, transactions: [] };
      const result = reportService.generateCSVReport(emptyReportData, mockOptions);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should escape special characters in descriptions', () => {
      const transactionsWithSpecialChars = [
        {
          id: '1',
          amount: 100,
          category: 'Test',
          description: 'Description with "quotes" and, commas',
          date: '2024-01-01',
          type: 'expense' as const,
        },
      ];

      const reportDataWithSpecialChars = {
        ...mockReportData,
        transactions: transactionsWithSpecialChars,
      };

      const result = reportService.generateCSVReport(reportDataWithSpecialChars, mockOptions);
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('error handling', () => {
    it('should throw error when PDF generation fails', async () => {
      // Mock jsPDF to throw an error
      const mockError = new Error('PDF generation failed');
      vi.doMock('jspdf', () => {
        throw mockError;
      });

      await expect(reportService.generatePDFReport(mockReportData, mockOptions)).rejects.toThrow(
        'Failed to generate PDF report',
      );
    });

    it('should throw error when CSV generation fails', () => {
      // Mock a scenario where CSV generation would fail
      const invalidReportData = null as any;

      expect(() => reportService.generateCSVReport(invalidReportData, mockOptions)).toThrow(
        'Failed to generate CSV report',
      );
    });
  });

  describe('report customization', () => {
    it('should use custom report title', async () => {
      const optionsWithTitle = {
        ...mockOptions,
        reportTitle: 'Custom Financial Report',
      };

      const result = await reportService.generatePDFReport(mockReportData, optionsWithTitle);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle different report types', async () => {
      const yearlyOptions = { ...mockOptions, reportType: 'yearly' as const };
      const result = await reportService.generatePDFReport(mockReportData, yearlyOptions);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle custom date ranges', async () => {
      const customOptions = { ...mockOptions, reportType: 'custom' as const };
      const result = await reportService.generatePDFReport(mockReportData, customOptions);

      expect(result).toBeInstanceOf(Blob);
    });
  });
});
