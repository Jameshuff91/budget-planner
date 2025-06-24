// pdfservice.ts

import { dbService } from './db';
import { logger } from './logger';
import * as pdfjs from 'pdfjs-dist';
import { createWorker, WorkerOptions } from 'tesseract.js';

// Type declaration for OpenCV global variable
declare global {
  var cv: any;
}

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
  documentDate?: Date; // Date extracted from filename
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
  private openCvAvailable: boolean | null = null;
  /**
   * Extracts date from filename in various formats like:
   * - YYYYMMDD-description.pdf (e.g., 20241219-statements-8731-.pdf)
   * - YYYY-MM-DD.pdf (e.g., 2023-06-08.pdf)
   * @param filename The name of the file
   * @returns Date object if successfully parsed, null otherwise
   */
  private parseDateFromFilename(filename: string): Date | null {
    logger.info(`Parsing date from filename: ${filename}`);
    try {
      // Match YYYYMMDD format (e.g., 20241219-statements-8731-.pdf)
      const yyyymmddMatch = filename.match(/^(\d{4})(\d{2})(\d{2})/);
      if (yyyymmddMatch) {
        const [_, year, month, day] = yyyymmddMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          logger.info(`Matched YYYYMMDD pattern. Parsed date: ${date}`, { filename });
          return date;
        }
      }

      // Match YYYY-MM-DD format (e.g., 2023-06-08.pdf)
      const isoMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [_, year, month, day] = isoMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          logger.info(`Matched YYYY-MM-DD pattern. Parsed date: ${date}`, { filename });
          return date;
        }
      }

      logger.info(`No date pattern matched for filename: ${filename}`);
      return null;
    } catch (error) {
      logger.error(`Error parsing date from filename: ${filename}`, error);
      return null;
    }
  }

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
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // **[Improvement]**: Preprocess the image for better OCR accuracy
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const preprocessedData = this.preprocessImage(imageData);
    context.putImageData(preprocessedData, 0, 0);

    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Preprocesses the image data to enhance OCR accuracy.
   * Converts to grayscale and applies thresholding.
   * @param imageData The original ImageData.
   * @returns The preprocessed ImageData.
   */
  private preprocessImage(imageData: ImageData): ImageData {
    // Check if OpenCV (cv) is loaded and available globally
    if (typeof cv === 'undefined') {
      // Only log this once to avoid spam
      if (this.openCvAvailable === null) {
        logger.info('OpenCV.js not detected. Using basic image preprocessing. For enhanced OCR accuracy with skewed documents, consider loading OpenCV.js.');
        this.openCvAvailable = false;
      }
      // Fallback to basic preprocessing if OpenCV is not available
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const grayscale = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        data[i] = grayscale; data[i + 1] = grayscale; data[i + 2] = grayscale;
      }
      for (let i = 0; i < data.length; i += 4) {
        const thresholdVal = data[i] > 128 ? 255 : 0;
        data[i] = thresholdVal; data[i + 1] = thresholdVal; data[i + 2] = thresholdVal;
      }
      return imageData;
    }

    let src: any = null;
    let gray: any = null;
    let edges: any = null;
    let lines: any = null;
    let deskewed: any = null;
    let blurred: any = null;
    let adaptThresh: any = null;

    try {
      // Mark OpenCV as available on first successful use
      if (this.openCvAvailable === null) {
        logger.info('OpenCV.js detected and working. Using advanced image preprocessing.');
        this.openCvAvailable = true;
      }
      
      src = cv.matFromImageData(imageData);
      gray = new cv.Mat();
      deskewed = src.clone(); // Initialize deskewed with src, apply operations if skew is detected

      // 1. Grayscaling
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 2. Deskewing
      // Create a binary image for contour detection for deskewing
      let binary = new cv.Mat();
      cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);

      // Find contours
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let angles: number[] = [];
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const rect = cv.minAreaRect(contour);
        let angle = rect.angle;

        // Adjust angle: OpenCV's minAreaRect returns angles in [-90, 0).
        // We want to find the dominant angle of the text lines.
        if (rect.size.width < rect.size.height) {
          angle += 90;
        } else {
          // Angle is likely correct
        }
        
        // Filter out very small contours if necessary (e.g., by area)
        if (rect.size.width * rect.size.height > 100) { // Example threshold for contour area
            angles.push(angle);
        }
        contour.delete();
      }

      if (angles.length > 0) {
        // Calculate median angle
        angles.sort((a, b) => a - b);
        const medianAngle = angles[Math.floor(angles.length / 2)];

        // Only rotate if the angle is significant (e.g., > 0.5 or < -0.5 degrees from horizontal)
        // Note: minAreaRect angles might need adjustment based on text orientation.
        // This simple median might not be robust for all cases.
        // A more robust method would involve projection profiles or Hough transform.
        if (Math.abs(medianAngle) > 0.5 && Math.abs(medianAngle) < 45) { // Avoid extreme rotations
          logger.info(`Deskewing image by ${medianAngle.toFixed(2)} degrees.`);
          const M = cv.getRotationMatrix2D(new cv.Point(gray.cols / 2, gray.rows / 2), medianAngle, 1);
          cv.warpAffine(gray, deskewed, M, new cv.Size(gray.cols, gray.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
          M.delete();
        } else {
          gray.copyTo(deskewed); // No significant skew or unable to determine reliably
        }
      } else {
        gray.copyTo(deskewed); // No contours found to determine skew
      }
      
      binary.delete();
      contours.delete();
      hierarchy.delete();

      // 3. Noise Removal (Median Filter)
      blurred = new cv.Mat();
      // Use the deskewed image (which is grayscale) if deskewing was applied, otherwise use original gray
      cv.medianBlur(deskewed, blurred, 3); // Kernel size 3x3. Adjust if needed.

      // 4. Adaptive Thresholding
      adaptThresh = new cv.Mat();
      cv.adaptiveThreshold(blurred, adaptThresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
      // Parameters: (src, dst, maxValue, adaptiveMethod, thresholdType, blockSize, C)
      // blockSize = 11 (size of the neighborhood area)
      // C = 2 (constant subtracted from the mean or weighted mean)

      // Convert the final processed Mat back to ImageData
      // Ensure the output is RGBA for putImageData
      let finalMat = new cv.Mat();
      if (adaptThresh.channels() === 1) {
        cv.cvtColor(adaptThresh, finalMat, cv.COLOR_GRAY2RGBA);
      } else {
        finalMat = adaptThresh.clone(); // Should already be RGBA if adaptThresh was not GRAY
      }
      
      const outputImageData = new ImageData(new Uint8ClampedArray(finalMat.data), finalMat.cols, finalMat.rows);
      finalMat.delete();
      return outputImageData;

    } catch (error) {
      logger.error('Error during OpenCV image preprocessing:', error);
      // Fallback to original image data or basic processing if error occurs
      // For now, return original imageData if advanced processing fails
      return imageData;
    } finally {
      // Clean up OpenCV Mats
      if (src) src.delete();
      if (gray) gray.delete();
      if (edges) edges.delete();
      if (lines) lines.delete(); // lines from HoughLinesP if used
      if (deskewed) deskewed.delete();
      if (blurred) blurred.delete();
      if (adaptThresh) adaptThresh.delete();
    }
  }

  /**
   * Parses a currency amount string into a number.
   * Handles common OCR errors and ensures the amount is within reasonable limits.
   * @param amountStr The currency amount string to parse.
   * @returns The parsed number.
   */
  private parseCurrencyAmount(amountStr: string): number {
    if (!amountStr || typeof amountStr !== 'string' || amountStr.trim() === '') {
      logger.warn(`Input amount string is empty or invalid: "${amountStr}"`);
      return 0;
    }

    let originalAmountStr = amountStr; // For logging
    let str = amountStr.trim();

    // Handle parentheses for negative numbers
    let isNegative = false;
    if (str.startsWith('(') && str.endsWith(')')) {
      isNegative = true;
      str = str.substring(1, str.length - 1);
    }

    // Handle common OCR misreads for digits and negative signs
    str = str.replace(/[Ss]/g, '5')
             .replace(/[B]/g, '8')
             .replace(/[Il]/g, '1') // I (capital i) and l (lowercase L)
             .replace(/[Zz]/g, '2')
             .replace(/[Gg]/g, '6') // Assuming G is more likely 6 in currency
             .replace(/[Qq]/g, '9')
             .replace(/[kKoO]/gi, '0') // k, K, o, O to 0
             .replace(/[–—]/g, '-'); // En-dash, Em-dash to hyphen

    // Remove currency symbols (common ones) and excess whitespace
    str = str.replace(/[\$€£¥\s]/g, '');

    // Check for trailing negative sign and move to front
    if (str.endsWith('-')) {
      isNegative = true;
      str = '-' + str.substring(0, str.length - 1);
    }
    if (str.startsWith('-')) {
        isNegative = true;
        // Ensure only one leading negative sign if multiple due to replacements
        str = '-' + str.replace(/^-+/, '');
    }


    // Detect European format (e.g., 1.234,56) vs. US format (1,234.56)
    const hasDot = str.includes('.');
    const hasComma = str.includes(',');

    let numberStr = str;

    if (hasDot && hasComma) {
      const lastDotIndex = str.lastIndexOf('.');
      const lastCommaIndex = str.lastIndexOf(',');
      // If comma is after dot and likely a decimal separator (1 or 2 digits after)
      if (lastCommaIndex > lastDotIndex && (str.length - lastCommaIndex - 1 <= 2 && str.length - lastCommaIndex - 1 > 0)) {
        // European format: 1.234,56 -> 1234.56
        numberStr = str.replace(/\./g, '').replace(',', '.');
      } else if (lastDotIndex > lastCommaIndex) {
        // US format: 1,234.56 -> 1234.56 (commas are thousand separators)
        numberStr = str.replace(/,/g, '');
      } else {
        // Ambiguous or potentially malformed, try removing all non-essential separators
        // If only one type of separator is present, assume it's for thousands if it's not the last one before 1-2 digits
        // This part can be tricky. Defaulting to removing commas if a period exists as decimal.
        if (hasDot) numberStr = str.replace(/,/g, ''); // Assume dot is decimal, remove commas
        else if (hasComma) numberStr = str.replace(/\./g, '').replace(',', '.'); // Assume comma is decimal, remove dots
      }
    } else if (hasComma && !hasDot) {
      // Only commas present. If last comma is followed by 1 or 2 digits, it's likely a decimal. Otherwise, it's a thousand separator.
      const lastCommaIndex = str.lastIndexOf(',');
      if (str.length - lastCommaIndex - 1 <= 2 && str.length - lastCommaIndex - 1 > 0) {
        numberStr = str.replace(/,/g, (match, offset) => offset === lastCommaIndex ? '.' : '');
      } else {
        numberStr = str.replace(/,/g, ''); // All commas are thousand separators
      }
    }
    // If only dots or no separators, numberStr is already mostly fine, just need to ensure no multiple decimals.

    // Final cleanup: remove any characters that are not digits, a single decimal point, or a leading hyphen
    numberStr = numberStr.replace(/[^-0-9.]/g, ''); // Remove anything not a digit, hyphen, or period

    // Ensure only one decimal point
    const decimalParts = numberStr.split('.');
    if (decimalParts.length > 2) {
      // Multiple dots, e.g., "1.2.34" or OCR error "1..23"
      // Try to form a valid number, e.g., take first part as whole, second as decimal
      numberStr = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }
     if (numberStr.startsWith('.')) {
        numberStr = '0' + numberStr;
    }


    let amount = parseFloat(numberStr);

    if (isNaN(amount)) {
      logger.error(`Parsed amount is NaN for amount string: "${originalAmountStr}" (cleaned: "${numberStr}")`);
      return 0;
    }

    if (isNegative) {
      amount = -Math.abs(amount);
    }

    // Define reasonable limits
    const MAX_AMOUNT = 100000; // Increased limit for flexibility
    const MIN_AMOUNT = -100000;

    if (amount > MAX_AMOUNT || amount < MIN_AMOUNT) {
      logger.warn(`Amount ${amount} from string "${originalAmountStr}" is outside the reasonable range [${MIN_AMOUNT}, ${MAX_AMOUNT}].`);
      // Basic correction attempt (could be enhanced if needed)
      // For now, we'll rely on the parsing logic. If it's still out of range, it might be a genuine large number or a severe OCR error.
      // Consider if capping or a more sophisticated correction is needed here.
      // If the original string was complex, the current parsing might already be the best guess.
      // Setting to 0 if still out of range after parsing.
      logger.error(`Amount ${amount} remains outside reasonable limits. Setting to 0 for string: "${originalAmountStr}".`);
      return 0;

    }
    
    // Ensure correct sign, especially if -0 was parsed.
    if (Object.is(amount, -0)) return -0;


    return amount;
  }

  /**
   * Classifies a transaction as 'income' or 'expense' based on its description and amount.
   * @param description The transaction description.
   * @param amount The transaction amount.
   * @returns The classification: 'income' or 'expense'.
   */
  private classifyTransaction(description: string, amount: number): 'income' | 'expense' {
    const lowerDesc = description.toLowerCase();

    // Handle peer-to-peer payments first
    if (lowerDesc.includes('zelle') || lowerDesc.includes('venmo')) {
      if (lowerDesc.includes('from')) {
        return 'income';
      } else if (lowerDesc.includes('to') || lowerDesc.includes('payment')) {
        return 'expense';
      }
    }

    // Investment-related keywords that should be treated as income/savings
    const investmentKeywords = [
      'vanguard', 'fidelity', 'schwab', 'investment', 'etf', 'mutual fund',
      'stocks', 'bonds', '401k', 'ira', 'retirement'
    ];

    // Check if this is an investment transaction (using word boundaries to avoid false matches)
    for (const kw of investmentKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        return 'income'; // Treat investments as income/savings
      }
    }

    const incomeKeywords = [
      'payroll', 'direct deposit', 'salary', 'interest', 'refund', 'deposit from',
      'transfer from', 'dfas-in', 'payment from', 'credit', 'deposit',
      'cash deposit', 'mobile deposit', 'payment received', 'dividend',
      'reimbursement', 'cashback reward'
    ];

    const expenseKeywords = [
      'payment to', 'pmt to', 'purchase', 'withdraw', 'debit', 'atm', 'fee', 'bill',
      'transfer to', 'ach pmt', 'amex pmt', 'chase pmt', 'bill pay', 'withdrawal',
      'utility', 'insurance', // 'pur' is handled below with word boundary
      'recurring payment', 'subscription', 'service fee', 'online purchase',
      'pos debit', 'atm withdrawal'
    ];

    // Improved keyword matching with word boundaries
    for (const kw of incomeKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        return 'income';
      }
    }

    for (const kw of expenseKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        return 'expense';
      }
    }
    
    // Specific handling for 'pur' or 'purchase' as whole words/prefixes
    if (/\bpur\b|\bpurchase\b/i.test(lowerDesc)) {
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
    let cleaned = description;

    // 1. Remove specific known patterns and boilerplate first
    const patternsToRemove: RegExp[] = [
      /\b(?:Transaction Date|Posting Date|Effective Date)[:\s]*\d{1,2}[-/. ]\d{1,2}(?:[-/. ]\d{2,4})?/gi,
      /\b(?:Card No\.|Account Number|Member Number|Account ending in)[:\s]*[X\d\s*-]+/gi,
      /\b(?:Reference Number|Transaction ID|Ref #|Trace Number|Invoice Number|Auth Code|Authorization #|Approval Code)[\s:]*[\w\d-]+/gi,
      /\b(?:Web ID|PPD ID)[\s:]*\S+/gi, // Kept from original
      /\b(?:Purchase from merchant|Payment to merchant)\b/gi,
      // More generic payment descriptions - apply carefully
      /\bOnline payment\b/gi, 
      /\bInternet payment\b/gi,
      /\bWeb payment(?:\s+to)?\b/gi, // Match "Web payment to" or just "Web payment"
      // Remove "to" after payment descriptions
      /\b(?:payment|online payment|web payment)\s+to\b/gi,
      // Trailing OCR artifacts
      /\s*\.{2,}$/g, // remove trailing ".." or "..."
      // Amounts - kept from original, applied early
      /\+?\$?[0-9,.]+(?:\.\d{2})?(?=\s|$)/g,
      // Common prefixes that are often too generic if merchant info follows
      /^(?:CHECKCARD PURCHASE|POS DEBIT|ACH DEBIT|DEBIT CARD PURCHASE|ONLINE TRANSFER TO)\s+/i,
    ];

    for (const pattern of patternsToRemove) {
      cleaned = cleaned.replace(pattern, '');
    }

    // 2. Standardize common abbreviations (case-insensitive for matching, specific for replacement)
    const abbreviationMap: { [key: string]: string } = {
      'PMT': 'Payment',
      'DEPT': 'Department',
      'SVC': 'Service',
      'TRN': 'Transaction',
      'REF': 'Reference',
      'ACCT': 'Account',
      'PUR': 'Purchase', // Consider if this is too aggressive or if it should be part of expense keywords
      'XFER': 'Transfer',
      'PYMT': 'Payment',
      'WD': 'Withdrawal',
      'DEP': 'Deposit',
      'BAL': 'Balance',
      'STMT': 'Statement',
      'SVC CHG': 'Service Charge',
      'CHECKCARD': 'Checkcard', // Standardize casing
      'P O S': 'POS', // Point Of Sale
      'RECD': 'Received',
    };

    for (const [abbr, full] of Object.entries(abbreviationMap)) {
      // Use regex to match whole words, case-insensitive
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      cleaned = cleaned.replace(regex, full);
    }
    
    // 3. Refined Character Filtering:
    // Allow alphanumeric, spaces, and a specific set of useful symbols: - & / . #
    // Remove characters that are NOT in this allowed set.
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s\-&/.#]/g, '');


    // 4. Normalize Whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // 5. Remove isolated special characters that might be left, e.g. a single "-" or "." surrounded by spaces
    cleaned = cleaned.replace(/\s+[-&/.#]\s+/g, ' '); // remove isolated symbols surrounded by space
    cleaned = cleaned.replace(/^[-&/.#]\s+/, ''); // remove leading symbol followed by space
    cleaned = cleaned.replace(/\s+[-&/.#]$/, ''); // remove trailing space followed by symbol
    cleaned = cleaned.replace(/^[-&/.#]+$/, '');   // remove if string is only special symbols

    // 6. Final cleanup - if only special characters remain, return empty string
    if (/^[-&/.#\s]*$/.test(cleaned)) {
      return '';
    }

    return cleaned.trim(); // Final trim
  }

  /**
   * Parses a date string in MM/DD/YYYY or MM/DD/YY format.
   * @param dateStr The date string to parse.
   * @returns The parsed Date object or null if invalid.
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') {
      logger.warn(`Invalid date string provided: ${dateStr}`);
      return null;
    }
    logger.info(`Attempting to parse date string: '${dateStr}'`);
    // Clean the date string: normalize spaces, handle commas
    let cleanedDateStr = dateStr.trim().replace(/\s+/g, ' '); // Normalize multiple spaces to single space
    cleanedDateStr = cleanedDateStr.replace(/[,.]/g, m => (m === ',' && dateStr.includes('.') ? '' : m)); // Remove commas unless it's the only separator, then keep for EU style dot later

    const monthMap: { [key: string]: number } = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
      oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };

    const currentYear = new Date().getFullYear();

    // Helper to check if a date is valid
    const isValidDate = (year: number, month: number, day: number): boolean => {
      const d = new Date(year, month, day);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    };

    const dateFormats: { regex: RegExp; parser: (match: RegExpMatchArray) => Date | null }[] = [
      // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
      {
        regex: /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/,
        parser: (match) => {
          const [, year, month, day] = match.map(Number);
          if (!isValidDate(year, month - 1, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[0].regex.toString()}: year=${year}, month=${month}, day=${day}. Input: "${dateStr}"`);
            return null;
          }
          return new Date(year, month - 1, day);
        },
      },
      // MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY (also M/D/YYYY)
      {
        regex: /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/,
        parser: (match) => {
          const [, month, day, year] = match.map(Number);
          if (!isValidDate(year, month - 1, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[1].regex.toString()}: year=${year}, month=${month}, day=${day}. Input: "${dateStr}"`);
            return null;
          }
          return new Date(year, month - 1, day);
        },
      },
      // MM/DD/YY or MM-DD-YY or MM.DD.YY (also M/D/YY)
      {
        regex: /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2})$/,
        parser: (match) => {
          const [, month, day, yearShort] = match.map(Number);
          const year = 2000 + yearShort; // Assume 20xx
          if (!isValidDate(year, month - 1, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[2].regex.toString()}: year=${year}, month=${month}, day=${day} (short year ${yearShort}). Input: "${dateStr}"`);
            return null;
          }
          return new Date(year, month - 1, day);
        },
      },
      // Month DD, YYYY (e.g., Jan 01, 2023, January 01, 2023, Jan. 01 2023)
      {
        regex: /^([a-zA-Z]{3,})\.?\s+(\d{1,2})\s*,?\s*(\d{4})$/i,
        parser: (match) => {
          const [, monthStr, dayStr, yearStr] = match;
          const month = monthMap[monthStr.toLowerCase()];
          const day = parseInt(dayStr, 10);
          const year = parseInt(yearStr, 10);
          if (month === undefined || !isValidDate(year, month, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[3].regex.toString()}: year=${year}, monthStr=${monthStr}(parsedMonth=${month}), day=${day}. Input: "${dateStr}"`);
            return null;
          }
          return new Date(year, month, day);
        },
      },
      // DD Month YYYY (e.g., 01 Jan 2023, 1 January 2023, 01 Jan. 2023)
      {
        regex: /^(\d{1,2})\s+([a-zA-Z]{3,})\.?\s+(\d{4})$/i,
        parser: (match) => {
          const [, dayStr, monthStr, yearStr] = match;
          const day = parseInt(dayStr, 10);
          const month = monthMap[monthStr.toLowerCase()];
          const year = parseInt(yearStr, 10);
          if (month === undefined || !isValidDate(year, month, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[4].regex.toString()}: year=${year}, monthStr=${monthStr}(parsedMonth=${month}), day=${day}. Input: "${dateStr}"`);
            return null;
          }
          return new Date(year, month, day);
        },
      },
       // MM/DD or M/D (assuming current year, common in statements)
       {
        regex: /^(\d{1,2})[-/. ](\d{1,2})$/,
        parser: (match) => {
          const [, month, day] = match.map(Number);
          // Year will be set by validateAndCorrectDate based on context
          if (!isValidDate(currentYear, month - 1, day)) {
            logger.warn(`Invalid date components for format ${dateFormats[5].regex.toString()} (assuming current year ${currentYear}): month=${month}, day=${day}. Input: "${dateStr}"`);
            return null;
          }
          return new Date(currentYear, month - 1, day);
        },
      },
    ];

    for (const format of dateFormats) {
      const match = cleanedDateStr.match(format.regex);
      if (match) {
        const date = format.parser(match);
        if (date) return date;
      }
    }
    
    logger.error(`Error parsing date string "${dateStr}"`, 'unknown format or invalid date');
    return null;
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
    // General date string regex part - designed to be flexible for parseDate
    const datePatternStr = String.raw`([\w\s.,/-]+?)`; // Capture group for a date string

    const primaryPeriodPatterns: { regex: RegExp; startGroup: number; endGroup: number }[] = [
      { // Keywords: Statement Period, Billing Period, Account Period, Billing Cycle, Activity from
        regex: new RegExp(String.raw`(?:Statement Period|Billing Period|Account Period|Billing Cycle|Activity from)\s*[:\-]?\s*${datePatternStr}\s*(?:to|-|through|–)\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      },
      { // Keywords: Statement Date ... to ... (common in some statements)
        regex: new RegExp(String.raw`Statement Date\s*[:\-]?\s*${datePatternStr}\s*(?:to|-|through|–)\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      },
      { // Keywords: Opening Date ... Closing Date
        regex: new RegExp(String.raw`(?:Opening Date|Statement open)\s*[:\-]?\s*${datePatternStr}\s*(?:Closing Date|Statement close)\s*[:\-]?\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      },
       { // Keywords: from DATE through DATE / from DATE to DATE
        regex: new RegExp(String.raw`from\s*${datePatternStr}\s*(?:to|through|–)\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      },
      { // Keywords: Statement includes activity between DATE and DATE
        regex: new RegExp(String.raw`activity between\s*${datePatternStr}\s*(?:and|&)\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      },
      { // Statement Dates: DATE - DATE
        regex: new RegExp(String.raw`Statement Dates\s*[:\-]?\s*${datePatternStr}\s*(?:to|-|through|–)\s*${datePatternStr}`, 'i'),
        startGroup: 1,
        endGroup: 2,
      }
    ];

    for (const patternInfo of primaryPeriodPatterns) {
      logger.info(`Attempting to match statement period with pattern: ${patternInfo.regex.toString()}`);
      const match = text.match(patternInfo.regex);
      if (match) {
        const startDateStr = match[patternInfo.startGroup];
        const endDateStr = match[patternInfo.endGroup];
        logger.info(`Matched period strings: Start='${startDateStr}', End='${endDateStr}'`);
        
        if (startDateStr && endDateStr) {
          const startDate = this.parseDate(startDateStr);
          const endDate = this.parseDate(endDateStr);
          logger.info(`Parsed period dates: Start=${startDate?.toISOString()}, End=${endDate?.toISOString()}`);

          if (startDate && endDate) {
            if (startDate.getTime() <= endDate.getTime()) {
              logger.info(`Statement period found via primary pattern: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
              return { startDate, endDate };
            } else {
              logger.warn(`Parsed dates from primary pattern are in wrong order: Start: ${startDateStr}, End: ${endDateStr}. Ignoring.`);
            }
          }
        }
      }
    }

    logger.info('Primary statement period patterns failed. Attempting fallback logic.');

    // Fallback logic: Find all parsable dates in the text
    // This regex aims to capture various date-like structures broadly.
    // It's less precise than primary patterns but gives parseDate a chance.
    const generalDateRegex = /\b(?:\d{1,4}[-/. ]\d{1,2}(?:[-/. ]\d{1,4})?|[A-Za-z]{3,9}\.?\s\d{1,2},?\s\d{2,4}|\d{1,2}\s[A-Za-z]{3,9}\.?\s\d{2,4})\b/gi;
    let potentialDates: Date[] = [];
    let match;
    while ((match = generalDateRegex.exec(text)) !== null) {
      const parsed = this.parseDate(match[0]);
      if (parsed) {
        potentialDates.push(parsed);
      }
    }
    
    // Remove duplicate dates by converting to time value
    const uniqueDateTimes = new Set(potentialDates.map(d => d.getTime()));
    const uniqueDates = Array.from(uniqueDateTimes).map(time => new Date(time));
    logger.info(`Unique dates found for fallback: ${uniqueDates.map(d => d.toISOString())}`);


    if (uniqueDates.length >= 2) {
      uniqueDates.sort((a, b) => a.getTime() - b.getTime());
      const startDate = uniqueDates[0];
      const endDate = uniqueDates[uniqueDates.length - 1];

      if (startDate.getTime() < endDate.getTime()) { // Ensure start is strictly before end for a period
        logger.info(`Statement period derived from fallback logic: Start=${startDate.toISOString()}, End=${endDate.toISOString()} (from ${uniqueDates.length} unique dates)`);
        return { startDate, endDate };
      } else {
         logger.warn('Fallback logic resulted in start date not before end date or only one unique date value.');
         return null;
      }
    }

    if (uniqueDates.length === 1) {
      logger.warn('Fallback logic resulted in start date not before end date or only one unique date value.');
    } else {
      logger.warn('Could not determine statement period from text after all attempts.');
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
   * Determines the category of an expense based on the description.
   * @param description The transaction description.
   * @returns The specific category of the expense.
   */
  private determineExpenseCategory(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    // Check for credit card payments first (highest priority)
    const ccPaymentKeywords = ['payment to chase card', 'amex e-payment', 'bill pay to citi card', 'credit card pmt', 'online payment thank you'];
    for (const kw of ccPaymentKeywords) {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(lowerDesc)) {
            return 'Credit Card Payment';
        }
    }
    // Special case for Amazon Store Card and similar credit card references
    if (/\b(?:store card|credit card)\b/i.test(lowerDesc) && /\b(?:ach pmt|payment)\b/i.test(lowerDesc)) {
        return 'Credit Card Payment';
    }
    // Fallback for 'ach pmt' if it's likely a credit card payment and not caught by other categories
    if (/\bach pmt\b/i.test(lowerDesc) && !lowerDesc.includes('rent') && !lowerDesc.includes('utility')) {
        return 'Credit Card Payment';
    }

    // Check for insurance premium (should override health insurance for premium payments)
    if (/\binsurance premium\b/i.test(lowerDesc)) {
        return 'Insurance';
    }

    const categoryMappings: { [key: string]: string } = {
      // Rent/Housing
      'rent': 'Rent',
      'mortgage': 'Rent',
      'newrez-shellpoin': 'Rent',
      'housing': 'Rent',
      
      // Pet Care (place before Groceries to avoid 'food' conflicts)
      'petco': 'Pet Care', 'petsmart': 'Pet Care', 'vet': 'Pet Care', 'veterinarian': 'Pet Care',
      'pet food': 'Pet Care', 'dog food': 'Pet Care', 'cat food': 'Pet Care',

      // Groceries
      'grocery': 'Groceries', 'trader': 'Groceries', 'whole foods': 'Groceries',
      'safeway': 'Groceries', 'food': 'Groceries', 'supermarket': 'Groceries',
      'market': 'Groceries', 'fresh market': 'Groceries', 'aldi': 'Groceries',
      'lidl': 'Groceries', 'publix': 'Groceries', 'kroger': 'Groceries',

      // Utilities
      'utility': 'Utilities', 'comcast': 'Utilities', 'umc inc': 'Utilities',
      'electric': 'Utilities', 'water': 'Utilities', 'gas': 'Utilities',
      'internet': 'Utilities', 'pge': 'Utilities', 'pg&e': 'Utilities', 'con edison': 'Utilities',
      'spectrum': 'Utilities', 'verizon fios': 'Utilities', 'trash': 'Utilities',
      'recycling': 'Utilities',

      // Transport
      'uber': 'Transport', 'lyft': 'Transport', 'transit': 'Transport',
      'parking': 'Transport', 'gas station': 'Transport', 'shell': 'Transport',
      'chevron': 'Transport', 'gasoline': 'Transport', 'fuel': 'Transport',
      'metro': 'Transport', 'subway': 'Transport', 'taxi': 'Transport',
      'parking fee': 'Transport', 'toll': 'Transport',

      // Entertainment
      'netflix': 'Entertainment', 'spotify': 'Entertainment', 'hulu': 'Entertainment',
      'disney': 'Entertainment', 'movie': 'Entertainment', 'theatre': 'Entertainment',
      'restaurant': 'Entertainment', 'bar': 'Entertainment', 'cafe': 'Entertainment',
      'ticketmaster': 'Entertainment', 'eventbrite': 'Entertainment', 'amc': 'Entertainment',
      'regal': 'Entertainment', 'starbucks': 'Entertainment', 'coffee shop': 'Entertainment',
      'dining': 'Entertainment',

      // Healthcare
      'pharmacy': 'Healthcare', 'cvs': 'Healthcare', 'walgreens': 'Healthcare',
      'doctor': 'Healthcare', 'dentist': 'Healthcare', 'dental': 'Healthcare', 
      'hospital': 'Healthcare', 'urgent care': 'Healthcare', 'health insurance': 'Healthcare',

      // Shopping
      'amazon': 'Shopping', 'target': 'Shopping', 'walmart': 'Shopping',
      'best buy': 'Shopping', 'macys': 'Shopping', 'online shopping': 'Shopping',
      'retail': 'Shopping',

      // Education
      'tuition': 'Education', 'student loan': 'Education', 'coursera': 'Education',
      'udemy': 'Education', 'books': 'Education', 'bookstore': 'Education', 'campus': 'Education',

      // Home Improvement
      'home depot': 'Home Improvement', 'lowes': 'Home Improvement', "lowe's": 'Home Improvement',
      'ace hardware': 'Home Improvement', 'hardware': 'Home Improvement',
      
      // Personal Care
      'salon': 'Personal Care', 'barber': 'Personal Care', 'barbershop': 'Personal Care',
      'haircut': 'Personal Care', 'spa': 'Personal Care',

      // Insurance (General, if not healthcare)
      'state farm': 'Insurance', 'geico': 'Insurance', 'progressive': 'Insurance',
      'allstate': 'Insurance', 'car insurance': 'Insurance',
      'home insurance': 'Insurance', // Note: 'health insurance' is under Healthcare

      // Childcare
      'daycare': 'Childcare', 'preschool': 'Childcare', 'babysitter': 'Childcare',

      // Gifts & Donations
      'gift': 'Gifts & Donations', 'donation': 'Gifts & Donations', 'charity': 'Gifts & Donations',
      'church': 'Gifts & Donations', // Could also be its own category if payments are regular
    };

    for (const [key, category] of Object.entries(categoryMappings)) {
      // Use word boundaries for more precise matching
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerDesc)) {
        return category;
      }
    }
    
    return 'Other Expenses';
  }

  /**
   * Classifies a transaction into specific categories based on description and amount.
   * @param description The transaction description.
   * @param amount The transaction amount.
   * @returns The specific category of the transaction.
   */
  private categorizeTransaction(description: string, amount: number): string {
    const type = this.classifyTransaction(description, amount);
    if (type === 'income') {
      return 'Income';
    } else if (type === 'expense') {
      return this.determineExpenseCategory(description);
    }
    return 'Uncategorized';
  }

  /**
   * Validates and corrects the transaction date within the statement period.
   * @param transactionDate The parsed transaction date.
   * @param currentDate The current date to compare against.
   * @param statementPeriod Optional statement period for additional validation.
   * @returns The validated and possibly corrected transaction date.
   */
  private validateAndCorrectDate(
    transactionDateInput: Date, // The date parsed from OCR, potentially with a default/current year
    currentDate: Date, // Typically the date of processing
    statementPeriod?: { startDate: Date; endDate: Date },
    // documentDate?: Date // Consider how to best integrate this if needed, e.g. by pre-setting year in processPDF
  ): Date {
    logger.info(`Validating and correcting date. Input Date: ${transactionDateInput.toISOString()}, Current Date: ${currentDate.toISOString()}, Statement Period: ${statementPeriod ? `${statementPeriod.startDate.toISOString()} - ${statementPeriod.endDate.toISOString()}` : 'N/A'}`);
    const originalTransactionDateISO = transactionDateInput.toISOString(); // For logging future date adjustments
    const correctedDate = new Date(transactionDateInput); // Work with a copy
    const originalParsedYear = correctedDate.getFullYear();
    const currentProcessingYear = currentDate.getFullYear();

    if (statementPeriod && statementPeriod.startDate && statementPeriod.endDate) {
      logger.info(`Original Parsed Year: ${originalParsedYear}, Current Processing Year: ${currentProcessingYear}`);
      const startYear = statementPeriod.startDate.getFullYear();
      const endYear = statementPeriod.endDate.getFullYear();
      const transactionMonth = correctedDate.getMonth(); // 0-11

      let inferredYear = originalParsedYear;

      // If the parsed date's year is the current processing year,
      // it's a strong candidate for year inference, especially if it was parsed from MM/DD.
      if (originalParsedYear === currentProcessingYear || originalParsedYear === currentProcessingYear -1 || originalParsedYear === currentProcessingYear + 1) { // Check if year is around current year
        if (startYear === endYear) {
          inferredYear = startYear;
        } else { // Statement spans two years (e.g., Dec 2023 - Jan 2024)
          // If transaction month is in the endYear's part of the statement
          if (transactionMonth <= statementPeriod.endDate.getMonth()) { // e.g. Jan (0) <= Jan (0)
            inferredYear = endYear;
          } else { // Transaction month is in the startYear's part of the statement
            inferredYear = startYear;
          }
        }
        
        if (inferredYear !== originalParsedYear) {
            logger.warn(`Adjusting transaction year from ${originalParsedYear} to ${inferredYear} based on statement period (${statementPeriod.startDate.toISOString()} - ${statementPeriod.endDate.toISOString()}) for input date ${transactionDateInput.toISOString()}.`);
            correctedDate.setFullYear(inferredYear);
            logger.info(`Date after year adjustment based on statement period: ${correctedDate.toISOString()}`);
        }
      }
      
      // Final check: if after year correction, the date is still wildly out of period (e.g. wrong month for single-year period), log it.
      // This avoids aggressive month/day changes but flags potential issues.
      // We define "wildly out" as not falling between start of startPeriod.month and end of endPeriod.month, considering the inferred year.
      const tempStartDate = new Date(correctedDate.getFullYear(), statementPeriod.startDate.getMonth(), 1);
      const tempEndDate = new Date(correctedDate.getFullYear(), statementPeriod.endDate.getMonth() + 1, 0); // End of month

      if (correctedDate < tempStartDate || correctedDate > tempEndDate) {
         // Further check: if statement is Dec-Jan, and date is Dec, year should be startYear. If Jan, year should be endYear.
         if (startYear !== endYear) {
            if (transactionMonth === statementPeriod.startDate.getMonth() && correctedDate.getFullYear() !== startYear) {
                logger.warn(`Correcting year to ${startYear} for month ${transactionMonth + 1} (transaction month matches statement start month) based on multi-year statement period (${statementPeriod.startDate.toISOString()} - ${statementPeriod.endDate.toISOString()}). Original date: ${originalTransactionDateISO}`);
                correctedDate.setFullYear(startYear);
                logger.info(`Date after multi-year (start month) adjustment: ${correctedDate.toISOString()}`);
            } else if (transactionMonth === statementPeriod.endDate.getMonth() && correctedDate.getFullYear() !== endYear) {
                logger.warn(`Correcting year to ${endYear} for month ${transactionMonth + 1} (transaction month matches statement end month) based on multi-year statement period (${statementPeriod.startDate.toISOString()} - ${statementPeriod.endDate.toISOString()}). Original date: ${originalTransactionDateISO}`);
                correctedDate.setFullYear(endYear);
                logger.info(`Date after multi-year (end month) adjustment: ${correctedDate.toISOString()}`);
            }
         }
      }
      // This specific warning about being outside the period after year correction is now handled by the final check at the end of the function.
      // However, we keep the general structure in case other logic is added here later.

    } else { // No statement period, fallback to current date comparison
      if (correctedDate.getFullYear() === currentProcessingYear && correctedDate > currentDate) {
        // If year is current, but date is in future, assume previous year
        logger.warn(`Transaction date ${originalTransactionDateISO} is in the future. Assuming previous year ${currentProcessingYear - 1}. Current date: ${currentDate.toISOString()}.`);
        correctedDate.setFullYear(currentProcessingYear - 1);
        logger.info(`Date after future date adjustment: ${correctedDate.toISOString()}`);
      }
    }

    if (statementPeriod && statementPeriod.startDate && statementPeriod.endDate && (correctedDate < statementPeriod.startDate || correctedDate > statementPeriod.endDate)) {
      logger.warn(`Final corrected date ${correctedDate.toISOString()} is outside the statement period: [${statementPeriod.startDate.toISOString()} - ${statementPeriod.endDate.toISOString()}]`);
    }

    logger.info(`Returning validated/corrected date: ${correctedDate.toISOString()}`);
    return correctedDate;
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
      const arrayBuffer = await file.arrayBuffer();
      const documentDate = this.parseDateFromFilename(file.name);
      const document: PDFDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        content: arrayBuffer,
        uploadDate: new Date(),
        processed: false,
        status: 'processing',
        contentHash: await this.calculateFileHash(arrayBuffer),
        documentDate: documentDate || undefined,
      };

      // If we found a date in the filename, use it to set the statement period
      if (documentDate) {
        // Set statement period to cover the month of the document date
        const startDate = new Date(documentDate.getFullYear(), documentDate.getMonth(), 1);
        const endDate = new Date(documentDate.getFullYear(), documentDate.getMonth() + 1, 0);
        document.statementPeriod = { startDate, endDate };
        logger.info('Set statement period from filename date:', { startDate, endDate });
      }

      // Check for duplicate file
      const duplicate = await this.checkForDuplicateFile(document.contentHash);
      if (duplicate) {
        logger.info('Duplicate file detected:', duplicate.name);
        return [];
      }

      await this.storeDocument(document);
      logger.info('Document stored successfully');

      // Load PDF document
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const extractedData: ExtractedData[] = [];

      // Initialize Tesseract worker with optimized settings
      const worker = await createWorker();
      (worker as any).logger = (m: { status: string; progress: number }) => {
        logger.info(`Tesseract.js: ${m.status} ${Math.round(m.progress * 100)}%`);
      };

      // Start the Tesseract worker with proper typing
      await (worker as any).load();
      await (worker as any).loadLanguage('eng');
      await (worker as any).initialize('eng');
      await (worker as any).setParameters({
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,/- ',
      });

      // Use document date from filename or detect statement period from content
      let statementPeriod = document.statementPeriod || null;

      // Process each page
      const totalPages = pdfDoc.numPages;
      for (let i = 1; i <= totalPages; i++) {
        logger.info(`Processing page ${i} of ${totalPages}`);
        onProgress?.(i, totalPages);

        const page = await pdfDoc.getPage(i);
        const imageData = await this.pdfToImage(page);

        // Convert ImageData to a format Tesseract can process
        const canvas = window.document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get canvas context');

        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);

        // Perform OCR on the image with enhanced configuration
        const {
          data: { text },
        } = await (worker as any).recognize(canvas);
        logger.info('OCR extracted text:', text);

        // Extract statement period if not already detected
        if (!statementPeriod) {
          statementPeriod = await this.detectStatementPeriod(text);
          if (statementPeriod) {
            logger.info('Detected statement period:', statementPeriod);
          }
        }

        // Enhanced patterns for credit card bills with looser matching
        const patterns = {
          balance: /New\s*Balance\s*\$?\s*([0-9,.]+)/i,
          dueDate: /(?:Payment\s*Due\s*Date|Due\s*Date)\s*(\d{2}\/\d{2}\/\d{4})/i,
          accountNumber: /(?:Account\s*Ending|ending\s*in)\s*([\d-]+)/i,
          paymentAmount: /(?:AutoPay\s*Amount|Payment\s*Amount)\s*\$?\s*([0-9,.]+)/i,
          transactions: /(?:Transaction Date|Date|TRANSACTION DETAIL)/i,
          transactionLine: /(\d{2}\/\d{2})\s+([^$]+?)\s+([\-]?[0-9,.]+\.\d{2})\s+[0-9,.]+\.\d{2}/i,
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
                  const date = this.parseDate(value);
                  billInfo.dueDate = date;
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
              type: 'expense',
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
            const date = this.parseDate(dateStr);
            if (!date) {
              logger.warn(`Invalid date format for transaction: ${dateStr}`);
              continue;
            }

            let transactionDate = date;
            transactionDate = this.validateAndCorrectDate(
              transactionDate,
              new Date(),
              statementPeriod || undefined
            );

            const cleanDesc = this.cleanDescription(rawDesc);
            const type = this.classifyTransaction(cleanDesc, amount);
            const category = this.categorizeTransaction(cleanDesc, amount);

            if (!isNaN(amount) && cleanDesc) {
              // Validate amount
              const MAX_REASONABLE_AMOUNT = 50000;
              if (amount > MAX_REASONABLE_AMOUNT || amount < -MAX_REASONABLE_AMOUNT) {
                logger.warn(`Transaction amount ${amount} is outside the reasonable range. Skipping transaction: ${cleanDesc}`);
                continue; // Skip this transaction
              }

              // **[Improvement]**: Handle cases where description includes payment amount
              // e.g., "Payment To Chase Card Ending IN 1867 -624.25"
              const paymentMatch = cleanDesc.match(/payment to|pmt to|purchase/i);
              const actualAmount = paymentMatch ? -Math.abs(amount) : (type === 'expense' ? -Math.abs(amount) : Math.abs(amount));

              extractedData.push({
                date: transactionDate,
                amount: actualAmount,
                description: cleanDesc,
                type: type,
                category: category,
                isMonthSummary: false,
                accountNumber: billInfo.accountNumber,
              });
              logger.info('Added transaction:', {
                date: transactionDate,
                amount: actualAmount,
                description: cleanDesc,
                type,
                category,
              });
            }
          } catch (error) {
            logger.error('Error parsing transaction:', error);
          }
        }

        logger.info('Extracted transactions from page:', extractedData);
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
        await this.updateDocumentStatus(
          documentId,
          'error',
          error instanceof Error ? error.message : 'Unknown error'
        );
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
   * Deletes multiple PDF documents by their IDs.
   * @param ids Array of document IDs to delete.
   * @returns Promise that resolves when all documents are deleted.
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      const db = await dbService.getDB();
      const transaction = db.transaction('pdfs', 'readwrite');
      const store = transaction.objectStore('pdfs');
      
      await Promise.all(ids.map(id => store.delete(id)));
      await transaction.done;
      
      logger.info('Successfully deleted multiple PDF documents:', ids);
    } catch (error) {
      logger.error('Error deleting multiple PDF documents:', error);
      throw error;
    }
  }

  /**
   * Clears all stored PDFs and their associated transactions.
   */
  async clearAllPDFs(): Promise<void> {
    try {
      await dbService.clearPDFs();
      await dbService.clearTransactions();
      logger.info('Successfully cleared all PDFs and transactions');
    } catch (error) {
      logger.error('Error clearing PDFs and transactions:', error);
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
