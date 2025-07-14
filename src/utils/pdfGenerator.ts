import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

import { Transaction } from '../types/index';
import { formatCurrency } from './helpers';
import { logger } from '../services/logger';

export interface PDFOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize?: {
    title: number;
    heading: number;
    body: number;
    small: number;
  };
  colors?: {
    primary: string;
    secondary: string;
    success: string;
    danger: string;
    muted: string;
  };
}

export interface TableColumn {
  header: string;
  accessor: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any) => string;
}

export interface ChartElement {
  element: HTMLElement;
  title: string;
  width?: number;
  height?: number;
}

export class PDFGenerator {
  private pdf: jsPDF;
  private options: Required<PDFOptions>;
  private currentY: number = 0;
  private pageHeight: number;
  private pageWidth: number;

  constructor(options: PDFOptions = {}) {
    this.options = {
      orientation: options.orientation || 'portrait',
      format: options.format || 'a4',
      margins: options.margins || { top: 20, right: 20, bottom: 20, left: 20 },
      fontSize: options.fontSize || { title: 24, heading: 16, body: 12, small: 10 },
      colors: options.colors || {
        primary: '#2563eb',
        secondary: '#64748b',
        success: '#16a34a',
        danger: '#dc2626',
        muted: '#6b7280'
      }
    };

    this.pdf = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: this.options.format,
    });

    this.pageHeight = this.pdf.internal.pageSize.height;
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.currentY = this.options.margins.top;
  }

  /**
   * Add title to the document
   */
  public addTitle(text: string, color?: string): PDFGenerator {
    this.setFontSize(this.options.fontSize.title);
    this.setFont('bold');
    if (color) this.setTextColor(color);
    
    this.pdf.text(text, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 15;
    
    this.resetTextColor();
    return this;
  }

  /**
   * Add heading to the document
   */
  public addHeading(text: string, level: 1 | 2 | 3 = 1): PDFGenerator {
    this.checkPageBreak(20);
    
    const sizes = {
      1: this.options.fontSize.heading,
      2: this.options.fontSize.heading - 2,
      3: this.options.fontSize.heading - 4
    };
    
    this.setFontSize(sizes[level]);
    this.setFont('bold');
    this.pdf.text(text, this.options.margins.left, this.currentY);
    this.currentY += 10;
    
    // Add underline for level 1 headings
    if (level === 1) {
      const textWidth = this.pdf.getTextWidth(text);
      this.pdf.line(
        this.options.margins.left,
        this.currentY - 8,
        this.options.margins.left + textWidth,
        this.currentY - 8
      );
    }
    
    this.currentY += 5;
    return this;
  }

  /**
   * Add paragraph text
   */
  public addParagraph(text: string, color?: string): PDFGenerator {
    this.setFontSize(this.options.fontSize.body);
    this.setFont('normal');
    if (color) this.setTextColor(color);
    
    const lines = this.pdf.splitTextToSize(text, this.pageWidth - this.options.margins.left - this.options.margins.right);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(8);
      this.pdf.text(line, this.options.margins.left, this.currentY);
      this.currentY += 7;
    });
    
    this.currentY += 5;
    this.resetTextColor();
    return this;
  }

  /**
   * Add key-value pairs
   */
  public addKeyValuePairs(pairs: Array<[string, string]>, labelWidth: number = 50): PDFGenerator {
    this.setFontSize(this.options.fontSize.body);
    
    pairs.forEach(([key, value]) => {
      this.checkPageBreak(8);
      
      this.setFont('bold');
      this.pdf.text(key, this.options.margins.left, this.currentY);
      
      this.setFont('normal');
      this.pdf.text(value, this.options.margins.left + labelWidth, this.currentY);
      
      this.currentY += 7;
    });
    
    this.currentY += 5;
    return this;
  }

  /**
   * Add a table to the document
   */
  public addTable(data: any[], columns: TableColumn[]): PDFGenerator {
    const tableWidth = this.pageWidth - this.options.margins.left - this.options.margins.right;
    const rowHeight = 8;
    
    // Calculate column widths
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const scaleFactor = tableWidth / totalWidth;
    
    // Draw table headers
    this.checkPageBreak(rowHeight * 2);
    
    this.setFontSize(this.options.fontSize.body);
    this.setFont('bold');
    this.setTextColor(this.options.colors.primary);
    
    let currentX = this.options.margins.left;
    
    columns.forEach(column => {
      const colWidth = column.width * scaleFactor;
      this.pdf.text(
        column.header,
        currentX + (column.align === 'center' ? colWidth / 2 : column.align === 'right' ? colWidth - 2 : 2),
        this.currentY,
        { align: column.align || 'left' }
      );
      currentX += colWidth;
    });
    
    this.currentY += rowHeight;
    
    // Draw header separator
    this.pdf.line(
      this.options.margins.left,
      this.currentY - 2,
      this.pageWidth - this.options.margins.right,
      this.currentY - 2
    );
    
    this.currentY += 3;
    
    // Draw table rows
    this.setFont('normal');
    this.resetTextColor();
    
    data.forEach(row => {
      this.checkPageBreak(rowHeight);
      
      currentX = this.options.margins.left;
      
      columns.forEach(column => {
        const colWidth = column.width * scaleFactor;
        let value = row[column.accessor];
        
        if (column.formatter) {
          value = column.formatter(value);
        }
        
        this.pdf.text(
          value?.toString() || '',
          currentX + (column.align === 'center' ? colWidth / 2 : column.align === 'right' ? colWidth - 2 : 2),
          this.currentY,
          { align: column.align || 'left' }
        );
        
        currentX += colWidth;
      });
      
      this.currentY += rowHeight;
    });
    
    this.currentY += 10;
    return this;
  }

  /**
   * Add a chart from HTML element
   */
  public async addChart(chartElement: ChartElement): Promise<PDFGenerator> {
    try {
      this.addHeading(chartElement.title, 2);
      
      const canvas = await html2canvas(chartElement.element, {
        background: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      const imgWidth = chartElement.width || 170;
      const imgHeight = chartElement.height || (canvas.height * imgWidth) / canvas.width;
      
      this.checkPageBreak(imgHeight + 10);
      
      const imgData = canvas.toDataURL('image/png');
      this.pdf.addImage(
        imgData,
        'PNG',
        this.options.margins.left,
        this.currentY,
        imgWidth,
        imgHeight
      );
      
      this.currentY += imgHeight + 15;
    } catch (error) {
      logger.error('Error adding chart to PDF:', error);
      this.addParagraph(`Error: Chart "${chartElement.title}" could not be captured`, this.options.colors.danger);
    }
    
    return this;
  }

  /**
   * Add financial summary section
   */
  public addFinancialSummary(
    totalIncome: number,
    totalExpenses: number,
    netSavings: number,
    transactionCount: number
  ): PDFGenerator {
    this.addHeading('Financial Summary');
    
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : '0.0';
    
    const summaryData: Array<[string, string]> = [
      ['Total Income:', formatCurrency(totalIncome)],
      ['Total Expenses:', formatCurrency(totalExpenses)],
      ['Net Savings:', formatCurrency(netSavings)],
      ['Savings Rate:', `${savingsRate}%`],
      ['Transaction Count:', transactionCount.toString()]
    ];
    
    this.addKeyValuePairs(summaryData, 60);
    
    return this;
  }

  /**
   * Add transaction list with pagination
   */
  public addTransactionList(
    transactions: Transaction[],
    maxTransactions: number = 50,
    sortByDate: boolean = true
  ): PDFGenerator {
    this.addHeading('Transaction Details');
    
    let processedTransactions = [...transactions];
    
    if (sortByDate) {
      processedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    if (transactions.length > maxTransactions) {
      this.addParagraph(
        `Note: Showing first ${maxTransactions} transactions of ${transactions.length} total`,
        this.options.colors.muted
      );
      processedTransactions = processedTransactions.slice(0, maxTransactions);
    }
    
    const columns: TableColumn[] = [
      {
        header: 'Date',
        accessor: 'date',
        width: 25,
        formatter: (value) => format(new Date(value), 'MM/dd/yy')
      },
      {
        header: 'Description',
        accessor: 'description',
        width: 70,
        formatter: (value) => value.length > 40 ? value.substring(0, 37) + '...' : value
      },
      {
        header: 'Category',
        accessor: 'category',
        width: 30
      },
      {
        header: 'Amount',
        accessor: 'amount',
        width: 25,
        align: 'right' as const,
        formatter: (value: number) => {
          // Note: row data not available in this context
          return formatCurrency(Math.abs(value));
        }
      }
    ];
    
    // Create data with type info for formatter
    const tableData = processedTransactions.map(t => ({
      ...t,
      type: t.type // Ensure type is available for formatter
    }));
    
    this.addTable(tableData, columns);
    
    return this;
  }

  /**
   * Add page break
   */
  public addPageBreak(): PDFGenerator {
    this.pdf.addPage();
    this.currentY = this.options.margins.top;
    return this;
  }

  /**
   * Add footer to all pages
   */
  public addFooters(footerText?: string): PDFGenerator {
    const pageCount = (this.pdf as any).getNumberOfPages ? (this.pdf as any).getNumberOfPages() : this.pdf.internal.pages?.length || 1;
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      this.setFontSize(this.options.fontSize.small);
      this.setTextColor(this.options.colors.muted);
      
      // Page number
      this.pdf.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth - this.options.margins.right,
        this.pageHeight - this.options.margins.bottom,
        { align: 'right' }
      );
      
      // Custom footer text or default branding
      const footer = footerText || 'Generated by Budget Planner';
      this.pdf.text(
        footer,
        this.options.margins.left,
        this.pageHeight - this.options.margins.bottom
      );
      
      // Generated timestamp
      this.pdf.text(
        `Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        this.pageWidth / 2,
        this.pageHeight - this.options.margins.bottom,
        { align: 'center' }
      );
    }
    
    this.resetTextColor();
    return this;
  }

  /**
   * Generate and return the PDF blob
   */
  public generate(): Blob {
    return new Blob([this.pdf.output('blob')], { type: 'application/pdf' });
  }

  /**
   * Download the PDF
   */
  public download(filename: string = 'financial-report.pdf'): void {
    this.pdf.save(filename);
  }

  /**
   * Get the jsPDF instance for advanced operations
   */
  public getPDF(): jsPDF {
    return this.pdf;
  }

  // Private helper methods
  
  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.pageHeight - this.options.margins.bottom) {
      this.addPageBreak();
    }
  }

  private setFontSize(size: number): void {
    this.pdf.setFontSize(size);
  }

  private setFont(style: 'normal' | 'bold' | 'italic' = 'normal'): void {
    this.pdf.setFont(undefined, style);
  }

  private setTextColor(color: string): void {
    // Convert hex color to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    this.pdf.setTextColor(r, g, b);
  }

  private resetTextColor(): void {
    this.pdf.setTextColor(0, 0, 0);
  }
}

/**
 * Utility function to create standard financial report
 */
export function createFinancialReport(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  options: Partial<PDFOptions> = {}
): PDFGenerator {
  const generator = new PDFGenerator(options);
  
  // Calculate summary data
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const netSavings = totalIncome - totalExpenses;
  
  // Add report content
  generator
    .addTitle(`Financial Report`)
    .addParagraph(`Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`)
    .addFinancialSummary(totalIncome, totalExpenses, netSavings, transactions.length)
    .addTransactionList(transactions);
  
  return generator;
}

/**
 * Utility function to capture multiple chart elements
 */
export async function captureCharts(chartSelectors: string[]): Promise<ChartElement[]> {
  const charts: ChartElement[] = [];
  
  for (const selector of chartSelectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      charts.push({
        element,
        title: element.getAttribute('data-chart-title') || 'Chart'
      });
    }
  }
  
  return charts;
}

export default PDFGenerator;