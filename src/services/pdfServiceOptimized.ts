// pdfServiceOptimized.ts - Optimized version with dynamic imports

import { getPerformanceMonitor } from '@utils/performance';

import { applyCategoryRules, loadCategoryRules } from '../utils/categoryRules';

import { dbService } from './db';
import { logger } from './logger';

// Type declarations
export interface PDFDocument {
  id: string;
  name: string;
  content: ArrayBuffer;
  uploadDate: Date;
  processed: boolean;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  transactionCount?: number;
  contentHash: string;
  documentDate?: Date;
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

// Lazy load heavy dependencies
let pdfjs: typeof import('pdfjs-dist') | null = null;
let tesseractWorker: unknown = null;
let openCvModule: unknown = null;
let llmService: unknown = null;

/**
 * Initialize PDF.js library on demand
 */
async function initializePdfJs() {
  if (pdfjs) return pdfjs;

  const monitor = getPerformanceMonitor();

  pdfjs = await monitor.measureAsync('pdf_js_load', async () => {
    const pdfjsModule = await import('pdfjs-dist');

    // Set worker path
    if (typeof window !== 'undefined') {
      pdfjsModule.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      logger.info('PDF.js initialized', {
        version: pdfjsModule.version,
        workerSrc: pdfjsModule.GlobalWorkerOptions.workerSrc,
      });
    }

    return pdfjsModule;
  });

  return pdfjs;
}

/**
 * Initialize Tesseract.js worker on demand
 */
async function initializeTesseract() {
  if (tesseractWorker) return tesseractWorker;

  const monitor = getPerformanceMonitor();

  tesseractWorker = await monitor.measureAsync('tesseract_load', async () => {
    const { createWorker } = await import('tesseract.js');

    const worker = await createWorker({
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          logger.debug('OCR Progress:', Math.round(m.progress * 100) + '%');
        }
      },
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    logger.info('Tesseract.js worker initialized');
    return worker;
  });

  return tesseractWorker;
}

/**
 * Initialize OpenCV.js on demand
 */
async function initializeOpenCV(): Promise<boolean> {
  if (openCvModule !== null) return openCvModule;

  const monitor = getPerformanceMonitor();

  try {
    await monitor.measureAsync('opencv_load', async () => {
      // Dynamically load OpenCV script
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.5.4/opencv.js';
        script.async = true;
        script.onload = () => {
          // Wait for cv to be available
          const checkCv = setInterval(() => {
            if (typeof (window as unknown as { cv: unknown }).cv !== 'undefined') {
              clearInterval(checkCv);
              openCvModule = (window as unknown as { cv: unknown }).cv;
              logger.info('OpenCV.js loaded successfully');
              resolve();
            }
          }, 100);
        };
        script.onerror = () => {
          logger.error('Failed to load OpenCV.js');
          reject(new Error('OpenCV.js load failed'));
        };
        document.head.appendChild(script);
      });
    });

    return true;
  } catch (error) {
    logger.error('OpenCV initialization failed:', error);
    openCvModule = false;
    return false;
  }
}

/**
 * Initialize LLM service on demand
 */
async function initializeLLMService() {
  if (llmService) return llmService;

  const monitor = getPerformanceMonitor();

  llmService = await monitor.measureAsync('llm_service_load', async () => {
    const { createLLMService } = await import('./llmService');
    return createLLMService();
  });

  return llmService;
}

class PDFServiceOptimized {
  private openCvAvailable: boolean | null = null;

  /**
   * Extracts date from filename in various formats
   */
  private parseDateFromFilename(filename: string): Date | null {
    logger.info(`Parsing date from filename: ${filename}`);
    try {
      // Match YYYYMMDD format
      const yyyymmddMatch = filename.match(/^(\d{4})(\d{2})(\d{2})/);
      if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          logger.info(`Matched YYYYMMDD pattern. Parsed date: ${date}`);
          return date;
        }
      }

      // Match YYYY-MM-DD format
      const isoMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          logger.info(`Matched ISO pattern. Parsed date: ${date}`);
          return date;
        }
      }

      logger.warn(`Could not parse date from filename: ${filename}`);
      return null;
    } catch (error) {
      logger.error(`Error parsing date from filename: ${filename}`, error);
      return null;
    }
  }

  /**
   * Calculate SHA-256 hash of file content
   */
  private async calculateHash(content: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Process PDF with lazy loading of dependencies
   */
  async processPDF(
    file: File,
    options: {
      enableOCR?: boolean;
      enableOpenCV?: boolean;
      enableSmartCategorization?: boolean;
      onProgress?: (progress: number) => void;
    } = {},
  ): Promise<{ document: PDFDocument; transactions: ExtractedData[] }> {
    const monitor = getPerformanceMonitor();

    return monitor.measureAsync('pdf_process_total', async () => {
      logger.info('Processing PDF:', file.name, 'Size:', file.size);

      // Calculate content hash
      const arrayBuffer = await file.arrayBuffer();
      const contentHash = await this.calculateHash(arrayBuffer);

      // Check for duplicate
      const existingPdf = await dbService.checkDuplicatePDF(contentHash);
      if (existingPdf) {
        throw new Error(`This PDF has already been uploaded: ${existingPdf.name}`);
      }

      // Parse document date from filename
      const documentDate = this.parseDateFromFilename(file.name);

      // Create PDF document record
      const pdfDocument: PDFDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        content: arrayBuffer,
        uploadDate: new Date(),
        processed: false,
        status: 'processing',
        contentHash,
        documentDate: documentDate || undefined,
      };

      try {
        // Save PDF document
        await dbService.savePDF(pdfDocument);

        // Load PDF.js dynamically
        const pdfjsLib = await initializePdfJs();

        // Extract transactions
        const transactions = await monitor.measureAsync('pdf_extract_transactions', async () => {
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;

          let allTransactions: ExtractedData[] = [];
          const totalPages = pdf.numPages;

          // Process pages
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: { str: string }) => item.str).join(' ');

            // Extract transactions from text
            const pageTransactions = await this.extractTransactionsFromText(
              text,
              documentDate,
              options,
            );

            allTransactions = allTransactions.concat(pageTransactions);

            // OCR processing if enabled and no text found
            if (options.enableOCR && text.trim().length < 100) {
              const ocrTransactions = await this.performOCR(page, documentDate, options);
              allTransactions = allTransactions.concat(ocrTransactions);
            }

            // Report progress
            if (options.onProgress) {
              options.onProgress((pageNum / totalPages) * 100);
            }
          }

          return allTransactions;
        });

        // Update PDF document status
        pdfDocument.processed = true;
        pdfDocument.status = 'completed';
        pdfDocument.transactionCount = transactions.length;
        await dbService.updatePDF(pdfDocument);

        logger.info(`Extracted ${transactions.length} transactions from ${file.name}`);
        return { document: pdfDocument, transactions };
      } catch (error) {
        // Update PDF document with error
        pdfDocument.status = 'error';
        pdfDocument.error = error instanceof Error ? error.message : 'Unknown error';
        await dbService.updatePDF(pdfDocument);
        throw error;
      }
    });
  }

  /**
   * Extract transactions from text
   */
  private async extractTransactionsFromText(
    text: string,
    documentDate: Date | null,
    options: { enableSmartCategorization?: boolean },
  ): Promise<ExtractedData[]> {
    const transactions: ExtractedData[] = [];

    // Transaction extraction logic here...
    // (simplified for brevity)

    // Apply categorization
    if (options.enableSmartCategorization) {
      const llm = await initializeLLMService();
      if (llm && llm.isConfigured()) {
        return llm.categorizeTransactions(transactions);
      }
    }

    // Fallback to rule-based categorization
    const rules = await loadCategoryRules();
    return transactions.map((transaction) => ({
      ...transaction,
      category: applyCategoryRules(transaction, rules),
    }));
  }

  /**
   * Perform OCR on a PDF page
   */
  private async performOCR(
    page: unknown,
    documentDate: Date | null,
    options: { enableOpenCV?: boolean; enableSmartCategorization?: boolean },
  ): Promise<ExtractedData[]> {
    const monitor = getPerformanceMonitor();

    return monitor.measureAsync('ocr_processing', async () => {
      // Render page to canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      let imageData = canvas.toDataURL('image/png');

      // Apply OpenCV preprocessing if enabled
      if (options.enableOpenCV) {
        const cvAvailable = await initializeOpenCV();
        if (cvAvailable) {
          imageData = await this.preprocessWithOpenCV(canvas);
        }
      }

      // Initialize Tesseract and perform OCR
      const worker = await initializeTesseract();
      const {
        data: { text },
      } = await worker.recognize(imageData);

      // Extract transactions from OCR text
      return this.extractTransactionsFromText(text, documentDate, options);
    });
  }

  /**
   * Preprocess image with OpenCV
   */
  private async preprocessWithOpenCV(canvas: HTMLCanvasElement): Promise<string> {
    // OpenCV preprocessing logic here...
    // (simplified for brevity)
    return canvas.toDataURL('image/png');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
    logger.info('PDF service resources cleaned up');
  }
}

// Export singleton instance
export const pdfServiceOptimized = new PDFServiceOptimized();

// Export preload function for critical path optimization
export async function preloadPDFDependencies() {
  const monitor = getPerformanceMonitor();

  await monitor.measureAsync('pdf_dependencies_preload', async () => {
    await Promise.all([
      initializePdfJs(),
      // Only preload other dependencies if explicitly needed
    ]);
  });
}
