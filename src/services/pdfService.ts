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
  contentHash: string;  // SHA-256 hash of the file content
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

  private parseCurrencyAmount(amountStr: string): number {
    // Check for parentheses first (typically means negative)
    const hasParentheses = /\(\$?[0-9,.]+\)/.test(amountStr);
    if (hasParentheses) {
      amountStr = '-' + amountStr.replace(/[()]/g, '');
    }

    // Remove any currency symbols and whitespace
    const cleanStr = amountStr.replace(/[$\s]/g, '');

    // Check if it's a negative number
    const isNegative = cleanStr.startsWith('-');

    // Remove any remaining special characters except numbers, comma, and period
    const numberStr = cleanStr.replace(/[^0-9.,\-]/g, '');

    // Split by decimal point (if any)
    const parts = numberStr.split('.');

    // Remove commas from the whole number part
    const wholeNumber = parts[0].replace(/,/g, '');

    // Combine whole number with decimal part if it exists
    const finalNumberStr = parts.length > 1 ? `${wholeNumber}.${parts[1]}` : wholeNumber;

    // Parse to float and apply negative sign if needed
    const amount = parseFloat(finalNumberStr);
    return isNegative ? -amount : amount;
  }

  private classifyTransaction(description: string, amount: number): 'income' | 'expense' {
    const lowerDesc = description.toLowerCase();
    
    // If the description contains a negative amount (e.g., "-1,453.74"), treat as expense
    if (/-\d/.test(description)) {
      return 'expense';
    }

    // Keywords that strongly indicate expense, regardless of amount sign
    const strongExpenseKeywords = [
      'payment to',
      'ach pmt',
      'venmo payment',
      'amex pmt',
      'chase pmt',
      'bill pay',
      'withdrawal'
    ];

    // Check strong expense keywords first
    if (strongExpenseKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'expense';
    }
    
    // Keywords that indicate income
    const incomeKeywords = [
      'payroll',
      'direct dep',
      'deposit from',
      'dfas-in',
      'salary',
      'interest paid',
      'refund from',
      'transfer from'
    ];
    
    // Keywords that indicate expense
    const expenseKeywords = [
      'payment',
      'pmt',
      'purchase',
      'withdraw',
      'atm',
      'debit',
      'pos debit',
      'transfer to',
      'fee'
    ];

    // If amount is negative, it's an expense
    if (amount < 0) {
      return 'expense';
    }

    // Check for income keywords
    if (incomeKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'income';
    }

    // Check for expense keywords
    if (expenseKeywords.some(kw => lowerDesc.includes(kw))) {
      return 'expense';
    }

    // For positive amounts with no clear keywords, default to expense for payment-like descriptions
    if (lowerDesc.includes('pmt') || lowerDesc.includes('payment')) {
      return 'expense';
    }

    // If no clear indicators and positive amount, treat as income
    return 'income';
  }

  private cleanDescription(description: string): string {
    // Remove any balance amounts that might appear in the description
    return description.replace(/\+?\$[0-9,.]+(?:\.\d{2})?(?=\s|$)/g, '').trim();
  }

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
      const worker = await createWorker('eng');

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
          dueDate: /(?:Payment\s*Due\s*Date|Due\s*Date)\s*(\d{2}\/\d{2}\/\d{2})/i,
          accountNumber: /(?:Account\s*Ending|ending\s*in)\s*([\d-]+)/i,
          paymentAmount: /(?:AutoPay\s*Amount|Payment\s*Amount)\s*\$?\s*([0-9,.]+)/i,
          transactions: /(?:Transaction Date|Date)\s*(?:Description|Merchant|Payee)\s*Amount/i,
          // Updated to be more precise about capturing the transaction amount
          transactionLine: /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*?)(?:\s+\+?\$[0-9,.]+)*\s+(-?\$?[0-9,.]+\.\d{2}|\(\$?[0-9,.]+\.\d{2}\))\s*$/i,
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
                  billInfo.dueDate = new Date(2000 + year, month - 1, day);
                } catch (error) {
                  logger.error('Error parsing date:', error);
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
          }
        }

        // Process extracted text line by line
        const lines = text.split('\n');
        let currentMonth: number | null = null;
        let currentYear: number | null = null;

        for (const line of lines) {
          // Check for month headers (e.g., "Jan 2025" or "January 2025")
          const monthHeaderMatch = line.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:,\s*)?(\d{4})/i);
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
            const [month, day, yearOrEmpty] = dateStr.split('/');
            let transactionYear: number;
            let transactionMonth: number;

            if (yearOrEmpty?.length === 2) {
              transactionYear = 2000 + parseInt(yearOrEmpty);
            } else if (yearOrEmpty) {
              transactionYear = parseInt(yearOrEmpty);
            } else if (currentYear !== null) {
              transactionYear = currentYear;
            } else {
              transactionYear = new Date().getFullYear();
            }

            transactionMonth = parseInt(month) - 1; // Convert to 0-based month
            
            // If we have a current month context and the transaction month is different,
            // use the context month instead (handles cases where the statement spans months)
            if (currentMonth !== null) {
              transactionMonth = currentMonth;
            }

            const transactionDate = new Date(transactionYear, transactionMonth, parseInt(day));
            const cleanDesc = this.cleanDescription(rawDesc);
            const type = this.classifyTransaction(cleanDesc, amount);

            if (!isNaN(amount) && cleanDesc) {
              extractedData.push({
                date: transactionDate,
                amount: Math.abs(amount), // Store absolute amount
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

      // Detect statement period
      const statementPeriod = await this.detectStatementPeriod(text);
      if (statementPeriod) {
        document.statementPeriod = statementPeriod;
        logger.info('Detected statement period:', statementPeriod);
      }

      // Update document status
      await this.updateDocumentStatus(document.id, 'completed');
      if (extractedData.length > 0) {
        await this.updateTransactionCount(document.id, extractedData.length);
      }

      // Validate transactions
      for (const transaction of extractedData) {
        if (!(await this.validateTransaction(transaction))) {
          logger.info('Skipping duplicate transaction:', transaction);
          continue;
        }
      }

      return extractedData;
    } catch (error) {
      logger.error('Error processing PDF:', error);
      throw error;
    }
  }

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

  async getPDFDocuments(): Promise<PDFDocument[]> {
    return this.getAllDocuments();
  }

  async deletePDFDocument(id: string): Promise<void> {
    return this.deleteDocument(id);
  }

  // Reprocess all stored PDFs and return their transactions
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

  private async calculateFileHash(arrayBuffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

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

  private parseDate(dateStr: string): Date | null {
    try {
      const [month, day, year] = dateStr.split('/').map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }

  private async checkForOverlappingStatements(period: { startDate: Date; endDate: Date }): Promise<PDFDocument[]> {
    try {
      const documents = await this.getAllDocuments();
      return documents.filter(doc => {
        if (!doc.statementPeriod) return false;
        
        const overlap = (
          period.startDate <= doc.statementPeriod.endDate &&
          period.endDate >= doc.statementPeriod.startDate
        );
        
        return overlap;
      });
    } catch (error) {
      logger.error('Error checking for overlapping statements:', error);
      throw error;
    }
  }

  private async validateTransaction(transaction: ExtractedData): Promise<boolean> {
    try {
      const db = await dbService.getDB();
      const txStore = db.transaction('transactions', 'readonly').objectStore('transactions');
      const existingTransactions = await txStore.getAll();

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

  private calculateDescriptionSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return 1 - distance / maxLength;
  }

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
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[str1.length][str2.length];
  }
}

export const pdfService = new PDFService();
