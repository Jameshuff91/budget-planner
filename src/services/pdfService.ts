// pdfservice.ts

import { dbService } from './db';
import { logger } from './logger';
import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Set worker path before any PDF operations
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

// Initialize PDF.js worker in a way that's compatible with Next.js
const initPdfWorker = async () => {
  if (typeof window === 'undefined') return; // Skip on server-side

  try {
    logger.info('PDF.js worker path set to:', pdfjs.GlobalWorkerOptions.workerSrc);
  } catch (error) {
    logger.error('Failed to initialize PDF worker:', error);
    throw new Error('Failed to initialize PDF processing');
  }
};

// Call initPdfWorker immediately
if (typeof window !== 'undefined') {
  initPdfWorker().catch((error) => {
    logger.error('Failed to initialize PDF worker on load:', error);
  });
}

export interface PDFDocument {
  id: string;
  name: string;
  content: ArrayBuffer;
  uploadDate: Date;
  processed: boolean;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  transactionCount?: number;
  contentHash: string; // SHA-256 hash of the file content
  statementPeriod?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ExtractedData {
  date: Date;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  category?: string;
  isMonthSummary?: boolean;
  accountNumber?: string;
}

class PDFService {
  private async storeDocument(document: PDFDocument): Promise<void> {
    try {
      await this.updateDocument(document);
      logger.info('PDF document stored successfully:', document.name);
    } catch (error) {
      logger.error('Error storing PDF document:', error);
      throw error;
    }
  }

  async pdfToImage(pdfPage: any): Promise<ImageData> {
    if (typeof window === 'undefined') {
      throw new Error('This function can only be used in browser environment');
    }

    const viewport = pdfPage.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Parses a currency amount string into a number.
   * Handles common OCR errors and ensures the amount is within reasonable limits.
   * @param amountStr The currency amount string to parse.
   * @returns The parsed number.
   */
  private parseCurrencyAmount(amountStr: string): number {
    // Check for parentheses first (typically means negative)
    const hasParentheses = /\(\$?[0-9,.]+\)/.test(amountStr);
    if (hasParentheses) {
      amountStr = '-' + amountStr.replace(/[()]/g, '');
    }

    // Remove any currency symbols and whitespace
    let cleanStr = amountStr.replace(/[$\s]/g, '');

    // Handle common OCR misreads (e.g., 'k' instead of '0', 'O' instead of '0')
    cleanStr = cleanStr.replace(/[koO]/gi, '0');

    // Check if it's a negative number
    const isNegative = cleanStr.startsWith('-');

    // Remove any remaining special characters except numbers, comma, and period
    let numberStr = cleanStr.replace(/[^0-9.,\-]/g, '');

    // Split by decimal point (if any)
    const parts = numberStr.split('.');

    // Remove commas from the whole number part
    const wholeNumber = parts[0].replace(/,/g, '');

    // Combine whole number with decimal part if it exists
    const finalNumberStr = parts.length > 1 ? `${wholeNumber}.${parts[1]}` : wholeNumber;

    // Parse to float and apply negative sign if needed
    let amount = parseFloat(finalNumberStr);
    if (isNaN(amount)) {
      logger.error(`Parsed amount is NaN for amount string: ${amountStr}`);
      return 0;
    }

    // Define reasonable limits
    const MAX_AMOUNT = 100000;
    const MIN_AMOUNT = -100000;

    if (amount > MAX_AMOUNT || amount < MIN_AMOUNT) {
      logger.warn(`Amount ${amount} is outside the reasonable range. Attempting to correct.`);

      // Attempt to correct common OCR errors
      // Example: Remove extraneous characters
      const correctedStr = amountStr.replace(/[^\d.,\-]/g, '').replace(/[koO]/gi, '0');
      const correctedAmount = parseFloat(correctedStr);

      if (!isNaN(correctedAmount) && correctedAmount >= MIN_AMOUNT && correctedAmount <= MAX_AMOUNT) {
        logger.info(`Corrected amount from ${amount} to ${correctedAmount}`);
        amount = correctedAmount;
      } else {
        logger.error(`Unable to correct amount for string: ${amountStr}. Setting amount to 0.`);
        amount = 0;
      }
    }

    return isNegative ? -amount : amount;
  }

  /**
   * Classifies a transaction as 'income' or 'expense' based on its description and amount.
   * @param description The transaction description.
   * @param amount The transaction amount.
   * @returns The classification: 'income' or 'expense'.
   */
  private classifyTransaction(description: string, amount: number): 'income' | 'expense' {
    const lowerDesc = description.toLowerCase();

    // Explicitly handle negative amounts
    if (amount < 0) {
      return 'expense';
    }

    // Define comprehensive keywords
    const incomeKeywords = [
      'payroll', 'direct deposit', 'salary', 'interest', 'refund', 'deposit from', 'transfer from', 'dfas-in'
    ];

    const expenseKeywords = [
      'payment', 'pmt', 'purchase', 'withdraw', 'debit', 'atm', 'fee', 'bill', 'transfer to', 'ach pmt',
      'venmo payment', 'amex pmt', 'chase pmt', 'bill pay', 'withdrawal'
    ];

    // Check for income keywords first
    if (incomeKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'income';
    }

    // Check for expense keywords
    if (expenseKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'expense';
    }

    // Default classification based on amount sign
    return amount < 0 ? 'expense' : 'income';
  }

  /**
   * Cleans the transaction description by removing extraneous characters or amounts.
   * @param description The raw transaction description.
   * @returns The cleaned description.
   */
  private cleanDescription(description: string): string {
    // Remove any balance amounts or payment amounts that might appear in the description
    return description.replace(/\+?\$?[0-9,.]+(?:\.\d{2})?(?=\s|$)/g, '').trim();
  }

  /**
   * Validates and corrects the transaction date.
   * @param transactionDate The parsed transaction date.
   * @param currentDate The current date to compare against.
   * @param statementPeriod Optional statement period for additional validation.
   * @returns The validated and possibly corrected transaction date.
   */
  private validateAndCorrectDate(
    transactionDate: Date,
    currentDate: Date,
    statementPeriod?: { startDate: Date; endDate: Date }
  ): Date {
    if (transactionDate > currentDate) {
      // Assume the year was misread; subtract one year
      transactionDate.setFullYear(transactionDate.getFullYear() - 1);
      logger.warn(`Adjusted transaction date to previous year: ${transactionDate}`);
    }

    // If statementPeriod is available, ensure the date falls within it
    if (statementPeriod) {
      if (transactionDate < statementPeriod.startDate || transactionDate > statementPeriod.endDate) {
        logger.warn(`Transaction date ${transactionDate.toDateString()} is outside the statement period.`);
        // Additional handling can be implemented here if needed
      }
    }

    return transactionDate;
  }

  /**
   * Parses a date string in MM/DD/YYYY or MM/DD/YY format.
   * @param dateStr The date string to parse.
   * @returns The parsed Date object or null if invalid.
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const [month, day, year] = dateStr.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      logger.error(`Error parsing date string "${dateStr}":`, error);
      return null;
    }
  }

  /**
   * Calculates the similarity between two strings using Levenshtein distance.
   * @param str1 The first string.
   * @param str2 The second string.
   * @returns A similarity score between 0 and 1.
   */
  private calculateDescriptionSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Calculates the Levenshtein distance between two strings.
   * @param str1 The first string.
   * @param str2 The second string.
   * @returns The Levenshtein distance.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // Deletion
          matrix[i][j - 1] + 1,    // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * Detects the statement period from the OCR-extracted text.
   * @param text The OCR-extracted text.
   * @returns The statement period or null if not found.
   */
  private async detectStatementPeriod(text: string): Promise<{ startDate: Date; endDate: Date } | null> {
    // Common date formats in statements
    const datePatterns = [
      /Statement Period:\s*(\d{2}\/\d{2}\/\d{2,4})\s*(?:to|-)\s*(\d{2}\/\d{2}\/\d{2,4})/i,
      /Billing Period:\s*(\d{2}\/\d{2}\/\d{2,4})\s*(?:to|-)\s*(\d{2}\/\d{2}\/\d{2,4})/i,
      /Activity from\s*(\d{2}\/\d{2}\/\d{2,4})\s*(?:to|-)\s*(\d{2}\/\d{2}\/\d{2,4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const [_, startDateStr, endDateStr] = match;
        try {
          const startDate = this.parseDate(startDateStr);
          const endDate = this.parseDate(endDateStr);
          if (startDate && endDate) {
            return { startDate, endDate };
          }
        } catch (error) {
          logger.error('Error parsing statement period dates:', error);
        }
      }
    }

    // Fallback: Use the earliest and latest transaction dates
    const transactionDates = Array.from(text.matchAll(/(\d{2}\/\d{2}\/\d{2,4})/g))
      .map(match => this.parseDate(match[1]))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (transactionDates.length >= 2) {
      return {
        startDate: transactionDates[0],
        endDate: transactionDates[transactionDates.length - 1]
      };
    }

    return null;
  }

  /**
   * Validates a transaction against existing transactions to prevent duplicates.
   * @param transaction The transaction to validate.
   * @returns True if the transaction is valid (not a duplicate), false otherwise.
   */
  private async validateTransaction(transaction: ExtractedData): Promise<boolean> {
    try {
      const db = await dbService.getDB();
      const txStore = db.transaction('transactions', 'readonly').objectStore('transactions');
      const existingTransactions: ExtractedData[] = await txStore.getAll();

      // Check for duplicate transactions (same date, amount, and similar description)
      const isDuplicate = existingTransactions.some(existing => {
        const sameDate = existing.date.toDateString() === transaction.date.toDateString();
        const sameAmount = existing.amount === transaction.amount;
        const similarDescription = this.calculateDescriptionSimilarity(
          existing.description,
          transaction.description
        ) > 0.8; // 80% similarity threshold

        return sameDate && sameAmount && similarDescription;
      });

      return !isDuplicate;
    } catch (error) {
      logger.error('Error validating transaction:', error);
      throw error;
    }
  }

  /**
   * Cleans and processes stored content lines into transactions.
   * This function can be used for reprocessing stored PDFs.
   * @param lines The lines of text extracted from the PDF.
   * @param docId The ID of the document being processed.
   * @returns An array of extracted transactions.
   */
  private async processStoredContent(lines: string[], docId: string): Promise<ExtractedData[]> {
    const extractedData: ExtractedData[] = [];
    let billInfo = {
      accountNumber: undefined as string | undefined,
    };

    // Use the same patterns as in processPDF
    const patterns = {
      accountNumber: /(?:Account\s*Ending|ending\s*in)\s*([\d-]+)/i,
      transactionLine: /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+([^$]+?)\s+\$?\s*([\d,]+\.\d{2})/i,
    };

    // First pass: extract account number
    for (const line of lines) {
      const accountMatch = line.match(patterns.accountNumber);
      if (accountMatch) {
        billInfo.accountNumber = accountMatch[1];
        break;
      }
    }

    // Second pass: extract transactions
    let inTransactionSection = false;

    for (const line of lines) {
      const match = line.match(patterns.transactionLine);
      if (match) {
        const [_, dateStr, description, amountStr] = match;
        try {
          // Parse date
          const [month, day, year] = dateStr.split('/').map(Number);
          const fullYear = year < 100 ? 2000 + year : year;
          const date = new Date(fullYear, month - 1, day);

          // Parse amount and description
          const amount = this.parseCurrencyAmount(amountStr);
          const cleanDescription = description.trim();

          if (!isNaN(amount) && cleanDescription) {
            extractedData.push({
              date,
              amount,
              description: cleanDescription,
              type: amount < 0 ? 'expense' : 'income',
              category: amount < 0 ? 'Credit Card Purchase' : 'Income',
              isMonthSummary: false,
              accountNumber: billInfo.accountNumber,
            });
          }
        } catch (error) {
          logger.error('Error parsing stored transaction line:', error);
        }
      }
    }

    return extractedData;
  }

  /**
   * Processes a PDF file, extracts transaction data, and stores it in the database.
   * @param file The PDF file to process.
   * @param onProgress Optional callback to report progress.
   * @returns An array of extracted transactions.
   */
  async processPDF(
    file: File,
    onProgress?: (current: number, total: number) => void,
  ): Promise<ExtractedData[]> {
    if (typeof window === 'undefined') {
      throw new Error('This function can only be used in browser environment');
    }

    try {
      const document: PDFDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        content: await file.arrayBuffer(),
        uploadDate: new Date(),
        processed: false,
        status: 'processing',
        contentHash: await this.calculateFileHash(await file.arrayBuffer()),
      };

      // Check for duplicate file
      const duplicate = await this.checkForDuplicateFile(document.contentHash);
      if (duplicate) {
        logger.info('Duplicate file detected:', duplicate.name);
        return [];
      }

      await this.storeDocument(document);
      logger.info('Document stored successfully');

      // Load PDF document
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const extractedData: ExtractedData[] = [];

      // Initialize Tesseract worker
      const worker = await createWorker({
        logger: (m: any) => logger.info(m)
      } as any);

      // Start the Tesseract worker
      await (worker as any).load();
      await (worker as any).loadLanguage('eng');
      await (worker as any).initialize('eng');

      // Process each page
      const totalPages = pdfDoc.numPages;
      for (let i = 1; i <= totalPages; i++) {
        logger.info(`Processing page ${i} of ${totalPages}`);
        onProgress?.(i, totalPages);

        const page = await pdfDoc.getPage(i);
        const imageData = await this.pdfToImage(page);

        // Convert ImageData to a format Tesseract can process
        const canvas = window.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);

        // Perform OCR on the image
        const {
          data: { text },
        } = await worker.recognize(canvas);
        logger.info('OCR extracted text:', text);

        // Enhanced patterns for credit card bills with looser matching
        const patterns = {
          balance: /New\s*Balance\s*\$?\s*([0-9,.]+)/i,
          dueDate: /(?:Payment\s*Due\s*Date|Due\s*Date)\s*(\d{2}\/\d{2}\/\d{2,4})/i,
          accountNumber: /(?:Account\s*Ending|ending\s*in)\s*([\d-]+)/i,
          paymentAmount: /(?:AutoPay\s*Amount|Payment\s*Amount)\s*\$?\s*([0-9,.]+)/i,
          transactions: /(?:Transaction Date|Date)\s*(?:Description|Merchant|Payee)\s*Amount/i,
          transactionLine: /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*?(?:-\$?[0-9,.]+\.\d{2})?)\s+(-?\$?[0-9,.]+\.\d{2}|\(\$?[0-9,.]+\.\d{2}\))\s*$/i,
        };

        // Extract bill summary and individual transactions
        let billInfo = {
          balance: null as number | null,
          dueDate: null as Date | null,
          accountNumber: undefined as string | undefined,
          paymentAmount: null as number | null,
        };

        // First pass: extract bill summary information
        for (const [key, pattern] of Object.entries(patterns)) {
          if (key === 'transactions' || key === 'transactionLine') continue;
          const match = text.match(pattern);
          logger.info(`Matching ${key}:`, { pattern: pattern.toString(), match });

          if (match) {
            const value = match[1];
            logger.info(`Found ${key}:`, value);

            switch (key) {
              case 'balance':
                billInfo.balance = this.parseCurrencyAmount(value);
                break;
              case 'dueDate':
                try {
                  const [month, day, year] = value.split('/').map(Number);
                  billInfo.dueDate = this.parseDate(value);
                } catch (error) {
                  logger.error('Error parsing due date:', error);
                }
                break;
              case 'accountNumber':
                billInfo.accountNumber = value;
                break;
              case 'paymentAmount':
                billInfo.paymentAmount = this.parseCurrencyAmount(value);
                break;
            }
          }
        }

        // Add monthly summary transaction
        if (billInfo.balance !== null) {
          const amount = billInfo.balance;
          const MAX_REASONABLE_AMOUNT = 50000;
          const isReasonableAmount = !isNaN(amount) && amount > 0 && amount < MAX_REASONABLE_AMOUNT;

          if (isReasonableAmount) {
            extractedData.push({
              date: billInfo.dueDate || new Date(),
              amount: amount,
              description: `Credit Card Bill - Account ending in ${billInfo.accountNumber || 'N/A'}`,
              type: 'expense' as const,
              category: 'Credit Card Payment',
              isMonthSummary: true,
              accountNumber: billInfo.accountNumber,
            });
            logger.info('Added summary transaction:', {
              amount,
              date: billInfo.dueDate,
              accountNumber: billInfo.accountNumber,
            });
          } else {
            logger.warn(`Summary amount ${amount} is unreasonable. Skipping summary transaction.`);
          }
        }

        // Process extracted text line by line
        const lines = text.split('\n');
        let currentMonth: number | null = null;
        let currentYear: number | null = null;

        for (const line of lines) {
          // Check for month headers (e.g., "Jan 2025" or "January 2025")
          const monthHeaderMatch = line.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:,?\s*)?(\d{4})/i);
          if (monthHeaderMatch) {
            const monthStr = monthHeaderMatch[0].substring(0, 3).toLowerCase();
            const yearStr = monthHeaderMatch[1];

            const monthMap: { [key: string]: number } = {
              'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
              'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };

            currentMonth = monthMap[monthStr];
            currentYear = parseInt(yearStr);
            continue;
          }

          const match = line.match(patterns.transactionLine);
          if (!match) continue;

          const [_, dateStr, rawDesc, rawAmt] = match;
          const amount = this.parseCurrencyAmount(rawAmt);

          try {
            // Parse date with current month/year context
            const [month, day, yearOrEmpty] = dateStr.split('/').map(Number);
            let transactionYear: number;
            let transactionMonth: number;

            if (yearOrEmpty?.toString().length === 2) {
              transactionYear = 2000 + yearOrEmpty;
            } else if (yearOrEmpty) {
              transactionYear = yearOrEmpty;
            } else if (currentYear !== null) {
              transactionYear = currentYear;
            } else {
              transactionYear = new Date().getFullYear();
            }

            transactionMonth = Number(month) - 1; // Convert to 0-based month

            // If we have a current month context and the transaction month is different,
            // use the context month instead (handles cases where the statement spans months)
            if (currentMonth !== null) {
              transactionMonth = currentMonth;
            }

            let transactionDate = new Date(transactionYear, transactionMonth, Number(day));
            transactionDate = this.validateAndCorrectDate(transactionDate, new Date('2025-01-30'), document.statementPeriod);

            const cleanDesc = this.cleanDescription(rawDesc);
            const type = this.classifyTransaction(cleanDesc, amount);

            // Detect statement period if not already detected
            if (!document.statementPeriod) {
              const statementPeriod = await this.detectStatementPeriod(text);
              if (statementPeriod) {
                document.statementPeriod = statementPeriod;
                logger.info('Detected statement period:', statementPeriod);
                // Re-validate the transaction date with the statement period
                transactionDate = this.validateAndCorrectDate(transactionDate, new Date('2025-01-30'), statementPeriod);
              }
            }

            if (!isNaN(amount) && cleanDesc) {
              // Validate amount
              const MAX_REASONABLE_AMOUNT = 50000;
              if (amount > MAX_REASONABLE_AMOUNT || amount < -MAX_REASONABLE_AMOUNT) {
                logger.warn(`Transaction amount ${amount} is outside the reasonable range. Skipping transaction: ${cleanDesc}`);
                continue; // Skip this transaction
              }

              // Extract amount from description if it contains a payment amount
              const paymentMatch = cleanDesc.match(/-\$?([0-9,.]+\.\d{2})/);
              const actualAmount = paymentMatch ?
                parseFloat(paymentMatch[1]) :
                (type === 'expense' ? -Math.abs(amount) : Math.abs(amount));

              extractedData.push({
                date: transactionDate,
                amount: actualAmount,
                description: cleanDesc,
                type: type,
                category: type === 'expense' ? 'Credit Card Purchase' : 'Income',
                isMonthSummary: false,
                accountNumber: billInfo.accountNumber,
              });
              logger.info('Added transaction:', {
                date: transactionDate,
                amount,
                description: cleanDesc,
                type,
              });
            }
          } catch (error) {
            logger.error('Error parsing transaction:', error);
          }
        }

        logger.info('Extracted transactions:', extractedData);
      }

      // Terminate Tesseract worker
      await worker.terminate();

      // Update document status
      await this.updateDocumentStatus(document.id, 'completed');
      if (extractedData.length > 0) {
        await this.updateTransactionCount(document.id, extractedData.length);
      }

      // Validate transactions
      const validatedTransactions: ExtractedData[] = [];
      for (const transaction of extractedData) {
        if (await this.validateTransaction(transaction)) {
          validatedTransactions.push(transaction);
        } else {
          logger.info('Skipping duplicate transaction:', transaction);
          // Optionally, flag for manual review or other handling
        }
      }

      return validatedTransactions;
    } catch (error) {
      logger.error('Error processing PDF:', error);
      // Attempt to update document status if possible
      try {
        const documentId = crypto.randomUUID(); // Replace with actual document ID if available
        await this.updateDocumentStatus(documentId, 'error', error instanceof Error ? error.message : 'Unknown error');
      } catch (updateError) {
        logger.error('Error updating document status after failure:', updateError);
      }
      throw error;
    }
  }

  /**
   * Updates the status of a PDF document.
   * @param id The ID of the document.
   * @param status The new status.
   * @param error Optional error message.
   */
  private async updateDocumentStatus(
    id: string,
    status: PDFDocument['status'],
    error?: string,
  ): Promise<void> {
    try {
      const document = await this.getDocument(id);
      if (!document) {
        logger.error('Document not found for status update:', id);
        throw new Error('Document not found');
      }

      document.status = status;
      if (error) {
        document.error = error;
      }

      await this.updateDocument(document);
    } catch (error) {
      logger.error('Error updating document status:', error);
      throw error;
    }
  }

  /**
   * Updates the transaction count of a PDF document.
   * @param id The ID of the document.
   * @param count The number of transactions.
   */
  private async updateTransactionCount(id: string, count: number): Promise<void> {
    try {
      const document = await this.getDocument(id);
      if (!document) {
        logger.error('Document not found for transaction count update:', id);
        throw new Error('Document not found');
      }

      document.transactionCount = count;

      await this.updateDocument(document);
    } catch (error) {
      logger.error('Error updating transaction count:', error);
      throw error;
    }
  }

  /**
   * Retrieves all stored PDF documents.
   * @returns An array of PDF documents.
   */
  async getPDFDocuments(): Promise<PDFDocument[]> {
    return this.getAllDocuments();
  }

  /**
   * Deletes a specific PDF document by ID.
   * @param id The ID of the document to delete.
   */
  async deletePDFDocument(id: string): Promise<void> {
    return this.deleteDocument(id);
  }

  /**
   * Reprocesses all stored PDFs and returns their transactions.
   * @returns An array of all extracted transactions from stored PDFs.
   */
  async reprocessStoredPDFs(): Promise<ExtractedData[]> {
    try {
      const documents = await this.getPDFDocuments();
      const allTransactions: ExtractedData[] = [];

      for (const doc of documents) {
        try {
          // Create a File object from the stored ArrayBuffer
          const file = new File([doc.content], doc.name, { type: 'application/pdf' });

          // Use the existing processPDF method
          const extractedData = await this.processPDF(file, (current, total) => {
            logger.info(`Reprocessing ${doc.name}: ${current}/${total} pages`);
          });

          allTransactions.push(...extractedData);

          // Update document status
          await this.updateDocumentStatus(doc.id, 'completed');
          if (extractedData.length > 0) {
            await this.updateTransactionCount(doc.id, extractedData.length);
          }

          logger.info(
            `Successfully processed PDF: ${doc.name} (${extractedData.length} transactions)`
          );
        } catch (error) {
          logger.error(`Error processing PDF ${doc.name}:`, error);
          await this.updateDocumentStatus(
            doc.id,
            'error',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      return allTransactions;
    } catch (error) {
      logger.error('Error reprocessing stored PDFs:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific PDF document by ID.
   * @param id The ID of the document.
   * @returns The PDF document or null if not found.
   */
  async getDocument(id: string): Promise<PDFDocument | null> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readonly');
      const store = transaction.objectStore('pdfs');
      const document = await store.get(id);
      return document || null;
    } catch (error) {
      logger.error('Error retrieving PDF document:', error);
      throw error;
    }
  }

  /**
   * Updates a PDF document in the database.
   * @param document The PDF document to update.
   */
  async updateDocument(document: PDFDocument): Promise<void> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readwrite');
      const store = transaction.objectStore('pdfs');
      await store.put(document);
      logger.info('PDF document updated successfully:', document.name);
    } catch (error) {
      logger.error('Error updating PDF document:', error);
      throw error;
    }
  }

  /**
   * Retrieves all PDF documents from the database.
   * @returns An array of PDF documents.
   */
  async getAllDocuments(): Promise<PDFDocument[]> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readonly');
      const store = transaction.objectStore('pdfs');
      const documents = await store.getAll();
      return documents;
    } catch (error) {
      logger.error('Error retrieving all PDF documents:', error);
      throw error;
    }
  }

  /**
   * Deletes a PDF document from the database by ID.
   * @param id The ID of the document to delete.
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readwrite');
      const store = transaction.objectStore('pdfs');
      await store.delete(id);
      logger.info('PDF document deleted successfully:', id);
    } catch (error) {
      logger.error('Error deleting PDF document:', error);
      throw error;
    }
  }

  /**
   * Calculates the SHA-256 hash of a file's ArrayBuffer.
   * @param arrayBuffer The ArrayBuffer of the file.
   * @returns The hexadecimal string representation of the hash.
   */
  private async calculateFileHash(arrayBuffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Checks if a file with the given hash already exists in the database.
   * @param hash The SHA-256 hash of the file.
   * @returns The duplicate PDF document or null if none found.
   */
  private async checkForDuplicateFile(hash: string): Promise<PDFDocument | null> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readonly');
      const store = transaction.objectStore('pdfs');
      const documents = await store.getAll();
      return documents.find(doc => doc.contentHash === hash) || null;
    } catch (error) {
      logger.error('Error checking for duplicate file:', error);
      throw error;
    }
  }
}

export const pdfService = new PDFService();
