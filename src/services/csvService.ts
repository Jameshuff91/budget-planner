import { Transaction } from '../types';
import { generateUUID } from '../utils/helpers';

import { logger } from './logger';

export interface CSVTransaction {
  date: string;
  description: string;
  amount: number;
  type?: 'income' | 'expense';
  category?: string;
  accountNumber?: string;
}

interface CSVParseOptions {
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  hasHeader?: boolean;
  delimiter?: ',' | ';' | '\t';
  amountColumn?: number;
  dateColumn?: number;
  descriptionColumn?: number;
  categoryColumn?: number;
}

const defaultOptions: CSVParseOptions = {
  dateFormat: 'MM/DD/YYYY',
  hasHeader: true,
  delimiter: ',',
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  categoryColumn: 3,
};

export class CSVService {
  private parseDate(dateStr: string, format: string): Date {
    const cleanDate = dateStr.trim();
    let date: Date;

    switch (format) {
      case 'MM/DD/YYYY':
        const [month, day, year] = cleanDate.split(/[\/\-]/).map(Number);
        date = new Date(year, month - 1, day);
        break;
      case 'DD/MM/YYYY':
        const [dayDM, monthDM, yearDM] = cleanDate.split(/[\/\-]/).map(Number);
        date = new Date(yearDM, monthDM - 1, dayDM);
        break;
      case 'YYYY-MM-DD':
        date = new Date(cleanDate);
        break;
      default:
        throw new Error(`Unsupported date format: ${format}`);
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    return date;
  }

  private parseAmount(amountStr: string): number {
    // Remove currency symbols and spaces
    const cleanAmount = amountStr.replace(/[$€£¥₹,\s]/g, '').trim();

    const amount = parseFloat(cleanAmount);
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${amountStr}`);
    }

    return amount;
  }

  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Don't forget the last field
    result.push(current.trim());
    return result;
  }

  async parseCSV(
    fileContent: string,
    options: Partial<CSVParseOptions> = {},
  ): Promise<CSVTransaction[]> {
    const opts = { ...defaultOptions, ...options };
    const lines = fileContent.trim().split(/\r?\n/);
    const transactions: CSVTransaction[] = [];

    // Skip header if present
    const startIndex = opts.hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const fields = this.parseLine(line, opts.delimiter!);

        // Ensure we have enough columns
        const requiredColumns = Math.max(
          opts.dateColumn! + 1,
          opts.descriptionColumn! + 1,
          opts.amountColumn! + 1,
          opts.categoryColumn !== undefined ? opts.categoryColumn + 1 : 0,
        );

        if (fields.length < requiredColumns) {
          logger.warn(`Line ${i + 1} has insufficient columns: ${line}`);
          continue;
        }

        const dateStr = fields[opts.dateColumn!];
        const description = fields[opts.descriptionColumn!];
        const amountStr = fields[opts.amountColumn!];
        const category =
          opts.categoryColumn !== undefined ? fields[opts.categoryColumn] : undefined;

        const date = this.parseDate(dateStr, opts.dateFormat!);
        const amount = this.parseAmount(amountStr);

        transactions.push({
          date: date.toISOString().split('T')[0],
          description: description || 'No description',
          amount: Math.abs(amount),
          type: amount >= 0 ? 'income' : 'expense',
          category: category || 'Uncategorized',
        });
      } catch (error) {
        logger.error(`Error parsing line ${i + 1}: ${error}`);
        // Continue with next line instead of failing entirely
      }
    }

    logger.info(`Successfully parsed ${transactions.length} transactions from CSV`);
    return transactions;
  }

  async detectCSVFormat(fileContent: string): Promise<Partial<CSVParseOptions>> {
    const lines = fileContent.trim().split(/\r?\n/).slice(0, 5); // Check first 5 lines
    if (lines.length === 0) return {};

    // Detect delimiter
    const delimiters = [',', ';', '\t'];
    let delimiter: ',' | ';' | '\t' = ',';
    let maxCount = 0;

    for (const delim of delimiters) {
      const count = (lines[0].match(new RegExp(delim, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        delimiter = delim as ',' | ';' | '\t';
      }
    }

    // Check if first line is header
    const firstLine = this.parseLine(lines[0], delimiter);
    const hasHeader = firstLine.some((field) =>
      /^(date|description|amount|category|type)/i.test(field),
    );

    // Try to detect date format from second line (or first if no header)
    const dataLine = hasHeader && lines.length > 1 ? lines[1] : lines[0];
    const fields = this.parseLine(dataLine, delimiter);

    let dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'MM/DD/YYYY';
    for (const field of fields) {
      if (/^\d{4}-\d{2}-\d{2}/.test(field)) {
        dateFormat = 'YYYY-MM-DD';
        break;
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(field)) {
        // Could be MM/DD or DD/MM, default to MM/DD for US
        dateFormat = 'MM/DD/YYYY';
        break;
      }
    }

    return {
      delimiter,
      hasHeader,
      dateFormat,
    };
  }

  convertToTransactions(csvTransactions: CSVTransaction[]): Omit<Transaction, 'id'>[] {
    return csvTransactions.map((csvTx) => ({
      date: csvTx.date,
      description: csvTx.description,
      amount: csvTx.type === 'expense' ? -Math.abs(csvTx.amount) : Math.abs(csvTx.amount),
      type: csvTx.type || 'expense',
      category: csvTx.category || 'Uncategorized',
      accountNumber: csvTx.accountNumber,
    }));
  }
}

export const csvService = new CSVService();
