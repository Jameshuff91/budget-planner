import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { Transaction } from '../types/index';
import { formatCurrency } from '../utils/helpers';

import { logger } from './logger';

export interface ReportOptions {
  startDate: Date;
  endDate: Date;
  includeCharts: boolean;
  includeTransactionDetails: boolean;
  includeCategorySummary: boolean;
  includeTaxReport: boolean;
  includeRecurringAnalysis: boolean;
  includeNetWorth: boolean;
  reportTitle?: string;
  reportType: 'monthly' | 'yearly' | 'custom';
}

export interface ChartData {
  element: HTMLElement;
  title: string;
  description?: string;
}

export interface ReportData {
  transactions: Transaction[];
  categorySpending: Array<{ name: string; value: number; target?: number }>;
  spendingTrend: Array<{ name: string; spending: number }>;
  monthlyTrends: Record<string, unknown>;
  merchantSpending: Array<{ name: string; value: number; transactionCount: number }>;
  potentialRecurringTransactions: Array<Record<string, unknown>>;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  periodLabel: string;
}

export class ReportService {
  private static instance: ReportService;

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  /**
   * Generate a comprehensive financial report in PDF format
   */
  public async generatePDFReport(
    reportData: ReportData,
    options: ReportOptions,
    charts: ChartData[] = [],
  ): Promise<Blob> {
    try {
      logger.info('Starting PDF report generation', {
        options,
        dataPoints: reportData.transactions.length,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      let currentY = 20;
      // const _pageHeight = pdf.internal.pageSize.height;
      // const _margin = 20;
      // const _usableHeight = _pageHeight - 2 * _margin; // Reserved for future use

      // Add header and title
      currentY = this.addReportHeader(pdf, options, currentY);

      // Add executive summary
      currentY = this.addExecutiveSummary(pdf, reportData, currentY);

      // Add category summary if requested
      if (options.includeCategorySummary) {
        currentY = this.checkPageBreak(pdf, currentY, 60);
        currentY = this.addCategorySummary(pdf, reportData, currentY);
      }

      // Add charts if requested
      if (options.includeCharts && charts.length > 0) {
        currentY = await this.addChartsToReport(pdf, charts, currentY);
      }

      // Add transaction details if requested
      if (options.includeTransactionDetails) {
        currentY = this.checkPageBreak(pdf, currentY, 40);
        currentY = this.addTransactionDetails(pdf, reportData, currentY, options);
      }

      // Add tax report if requested
      if (options.includeTaxReport) {
        currentY = this.checkPageBreak(pdf, currentY, 60);
        currentY = this.addTaxReport(pdf, reportData, currentY);
      }

      // Add recurring transactions analysis if requested
      if (options.includeRecurringAnalysis) {
        currentY = this.checkPageBreak(pdf, currentY, 60);
        this.addRecurringAnalysis(pdf, reportData, currentY);
      }

      // Add footer to all pages
      this.addFooter(pdf);

      logger.info('PDF report generation completed');
      return new Blob([pdf.output('blob')], { type: 'application/pdf' });
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      throw new Error(
        `Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate CSV export for transaction data
   */
  public generateCSVReport(reportData: ReportData, _options: ReportOptions): Blob {
    try {
      logger.info('Starting CSV report generation');

      const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Account'];

      const csvContent = [
        headers.join(','),
        ...reportData.transactions.map((transaction) =>
          [
            format(new Date(transaction.date), 'yyyy-MM-dd'),
            `"${transaction.description.replace(/"/g, '""')}"`,
            transaction.category,
            transaction.type,
            transaction.amount.toString(),
            transaction.accountNumber || 'N/A',
          ].join(','),
        ),
      ].join('\n');

      logger.info('CSV report generation completed');
      return new Blob([csvContent], { type: 'text/csv' });
    } catch (error) {
      logger.error('Error generating CSV report:', error);
      throw new Error(
        `Failed to generate CSV report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Add report header with title and date range
   */
  private addReportHeader(pdf: jsPDF, options: ReportOptions, y: number): number {
    const pageWidth = pdf.internal.pageSize.width;

    // Title
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    const title =
      options.reportTitle ||
      `Financial Report - ${options.reportType.charAt(0).toUpperCase() + options.reportType.slice(1)}`;
    pdf.text(title, pageWidth / 2, y, { align: 'center' });

    y += 15;

    // Date range
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    const dateRange = `${format(options.startDate, 'MMM dd, yyyy')} - ${format(options.endDate, 'MMM dd, yyyy')}`;
    pdf.text(dateRange, pageWidth / 2, y, { align: 'center' });

    y += 10;

    // Generated timestamp
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth / 2, y, {
      align: 'center',
    });
    pdf.setTextColor(0, 0, 0);

    return y + 20;
  }

  /**
   * Add executive summary section
   */
  private addExecutiveSummary(pdf: jsPDF, reportData: ReportData, y: number): number {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Executive Summary', 20, y);
    y += 10;

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');

    const summaryData = [
      ['Period:', reportData.periodLabel],
      ['Total Income:', formatCurrency(reportData.totalIncome)],
      ['Total Expenses:', formatCurrency(reportData.totalExpenses)],
      ['Net Savings:', formatCurrency(reportData.netSavings)],
      ['Transaction Count:', reportData.transactions.length.toString()],
      ['Savings Rate:', `${((reportData.netSavings / reportData.totalIncome) * 100).toFixed(1)}%`],
    ];

    summaryData.forEach(([label, value]) => {
      pdf.text(label, 25, y);
      pdf.text(value, 100, y);
      y += 7;
    });

    return y + 10;
  }

  /**
   * Add category spending summary
   */
  private addCategorySummary(pdf: jsPDF, reportData: ReportData, y: number): number {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Category Breakdown', 20, y);
    y += 15;

    // Table headers
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Category', 25, y);
    pdf.text('Amount', 100, y);
    pdf.text('Budget', 140, y);
    pdf.text('% of Total', 170, y);
    y += 5;

    // Draw header line
    pdf.line(20, y, 190, y);
    y += 8;

    // Category data
    pdf.setFont(undefined, 'normal');
    const totalSpending = reportData.categorySpending.reduce((sum, cat) => sum + cat.value, 0);

    reportData.categorySpending
      .filter((cat) => cat.value > 0)
      .sort((a, b) => b.value - a.value)
      .forEach((category) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }

        const percentage =
          totalSpending > 0 ? ((category.value / totalSpending) * 100).toFixed(1) : '0.0';

        pdf.text(category.name, 25, y);
        pdf.text(formatCurrency(category.value), 100, y);
        pdf.text(category.target ? formatCurrency(category.target) : 'N/A', 140, y);
        pdf.text(`${percentage}%`, 170, y);

        y += 7;
      });

    return y + 10;
  }

  /**
   * Add charts to the report
   */
  private async addChartsToReport(pdf: jsPDF, charts: ChartData[], y: number): Promise<number> {
    for (const chart of charts) {
      y = this.checkPageBreak(pdf, y, 100);

      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text(chart.title, 20, y);
      y += 10;

      if (chart.description) {
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(chart.description, 20, y);
        y += 8;
      }

      try {
        const canvas = await html2canvas(chart.element, {
          background: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (y + imgHeight > 270) {
          pdf.addPage();
          y = 20;
        }

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);

        y += imgHeight + 15;
      } catch (error) {
        logger.error('Error capturing chart:', error);
        pdf.setFontSize(10);
        pdf.setTextColor(255, 0, 0);
        pdf.text('Error: Chart could not be captured', 20, y);
        pdf.setTextColor(0, 0, 0);
        y += 15;
      }
    }

    return y;
  }

  /**
   * Add transaction details section
   */
  private addTransactionDetails(
    pdf: jsPDF,
    reportData: ReportData,
    y: number,
    _options: ReportOptions,
  ): number {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Transaction Details', 20, y);
    y += 15;

    // Limit transactions for large datasets
    const maxTransactions = 100;
    const transactions = reportData.transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxTransactions);

    if (reportData.transactions.length > maxTransactions) {
      pdf.setFontSize(10);
      pdf.setTextColor(255, 0, 0);
      pdf.text(
        `Note: Showing first ${maxTransactions} transactions of ${reportData.transactions.length} total`,
        20,
        y,
      );
      pdf.setTextColor(0, 0, 0);
      y += 8;
    }

    // Table headers
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Date', 20, y);
    pdf.text('Description', 45, y);
    pdf.text('Category', 120, y);
    pdf.text('Amount', 160, y);
    y += 5;

    pdf.line(20, y, 190, y);
    y += 5;

    // Transaction rows
    pdf.setFont(undefined, 'normal');
    transactions.forEach((transaction) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }

      const dateStr = format(new Date(transaction.date), 'MM/dd/yy');
      const description =
        transaction.description.length > 30
          ? transaction.description.substring(0, 27) + '...'
          : transaction.description;

      pdf.text(dateStr, 20, y);
      pdf.text(description, 45, y);
      pdf.text(transaction.category, 120, y);

      // Color code amounts
      if (transaction.type === 'expense') {
        pdf.setTextColor(255, 0, 0);
        pdf.text(`-${formatCurrency(transaction.amount)}`, 160, y);
      } else {
        pdf.setTextColor(0, 128, 0);
        pdf.text(`+${formatCurrency(transaction.amount)}`, 160, y);
      }
      pdf.setTextColor(0, 0, 0);

      y += 6;
    });

    return y + 10;
  }

  /**
   * Add tax preparation report
   */
  private addTaxReport(pdf: jsPDF, reportData: ReportData, y: number): number {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Tax Preparation Summary', 20, y);
    y += 15;

    // Define tax-deductible categories
    const taxCategories = [
      'Business Meals',
      'Office Supplies',
      'Professional Services',
      'Education',
      'Medical',
      'Charitable Donations',
      'Home Office',
      'Business Travel',
    ];

    const taxDeductibleExpenses = reportData.transactions.filter(
      (t) =>
        t.type === 'expense' &&
        taxCategories.some((cat) => t.category.toLowerCase().includes(cat.toLowerCase())),
    );

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(
      `Potentially tax-deductible expenses: ${taxDeductibleExpenses.length} transactions`,
      20,
      y,
    );
    y += 10;

    const categoryTotals = new Map<string, number>();
    taxDeductibleExpenses.forEach((transaction) => {
      const current = categoryTotals.get(transaction.category) || 0;
      categoryTotals.set(transaction.category, current + transaction.amount);
    });

    Array.from(categoryTotals.entries()).forEach(([category, total]) => {
      pdf.text(`${category}: ${formatCurrency(total)}`, 25, y);
      y += 7;
    });

    const totalDeductible = Array.from(categoryTotals.values()).reduce((sum, val) => sum + val, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Total Potential Deductions: ${formatCurrency(totalDeductible)}`, 20, y + 5);

    return y + 20;
  }

  /**
   * Add recurring transactions analysis
   */
  private addRecurringAnalysis(pdf: jsPDF, reportData: ReportData, y: number): number {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Recurring Transactions Analysis', 20, y);
    y += 15;

    if (reportData.potentialRecurringTransactions.length === 0) {
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'normal');
      pdf.text('No recurring transaction patterns detected.', 20, y);
      return y + 20;
    }

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text(
      `Found ${reportData.potentialRecurringTransactions.length} recurring transaction patterns:`,
      20,
      y,
    );
    y += 15;

    reportData.potentialRecurringTransactions.slice(0, 10).forEach((recurring) => {
      if (y > 260) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFont(undefined, 'bold');
      pdf.text(`${recurring.merchantName} - ${formatCurrency(recurring.amount)}`, 25, y);
      y += 6;

      pdf.setFont(undefined, 'normal');
      pdf.text(
        `Frequency: ${recurring.frequency} (${recurring.transactions.length} occurrences)`,
        30,
        y,
      );
      y += 6;

      if (recurring.nextEstimatedDate) {
        pdf.text(
          `Next expected: ${format(new Date(recurring.nextEstimatedDate), 'MMM dd, yyyy')}`,
          30,
          y,
        );
        y += 6;
      }

      y += 5;
    });

    return y + 10;
  }

  /**
   * Add footer to all pages
   */
  private addFooter(pdf: jsPDF): void {
    const pageCount = (pdf as unknown as { getNumberOfPages?: () => number }).getNumberOfPages
      ? (pdf as unknown as { getNumberOfPages?: () => number }).getNumberOfPages()
      : (pdf as unknown as { internal: { pages: unknown[] } }).internal.pages?.length || 1;

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);

      // Page number
      pdf.text(`Page ${i} of ${pageCount}`, 170, 285);

      // Branding
      pdf.text('Generated by Budget Planner', 20, 285);

      pdf.setTextColor(0, 0, 0);
    }
  }

  /**
   * Check if we need a page break and add one if necessary
   */
  private checkPageBreak(pdf: jsPDF, currentY: number, requiredSpace: number): number {
    if (currentY + requiredSpace > 270) {
      pdf.addPage();
      return 20;
    }
    return currentY;
  }
}

export const reportService = ReportService.getInstance();
