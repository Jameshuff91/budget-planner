/**
 * User-friendly error messages and error handling utilities
 */

export class UserError extends Error {
  constructor(
    public userMessage: string,
    public technicalMessage?: string,
    public action?: string,
  ) {
    super(userMessage);
    this.name = 'UserError';
  }
}

export const ErrorMessages = {
  // Database errors
  DB_INIT_FAILED: {
    message: 'Unable to save data locally. Please check your browser settings allow storage.',
    action: 'Try using a different browser or clearing your browser data.',
  },
  DB_OPERATION_FAILED: {
    message: 'Unable to save your changes. Please refresh and try again.',
    action: 'If the problem persists, try clearing your browser cache.',
  },
  CATEGORY_NOT_FOUND: {
    message: 'The selected category no longer exists. Please refresh and try again.',
    action: 'Your categories may have been updated. Refresh to see the latest.',
  },

  // PDF processing errors
  PDF_INIT_FAILED: {
    message: 'Unable to load PDF reader. Please refresh the page and try again.',
    action: 'Make sure JavaScript is enabled in your browser.',
  },
  PDF_NOT_FOUND: {
    message: "The file you're looking for has been removed or is no longer available.",
    action: 'Try uploading the file again.',
  },
  PDF_PARSE_FAILED: {
    message: 'Unable to read this PDF file. It may be corrupted or password-protected.',
    action: "Try opening the file in a PDF reader first to verify it's valid.",
  },
  PDF_OCR_FAILED: {
    message: 'Unable to read text from this PDF page. The image quality may be too low.',
    action: 'Try scanning the document at a higher resolution or use a CSV file instead.',
  },

  // CSV import errors
  CSV_DATE_FORMAT: {
    message: 'Date format not recognized. Please use MM/DD/YYYY format.',
    action: 'Example: 12/31/2024',
  },
  CSV_INVALID_AMOUNT: {
    message: 'Amount is not a valid number. Please check for typos or extra characters.',
    action: 'Remove any currency symbols or commas from amounts.',
  },
  CSV_PARSE_FAILED: {
    message: 'Unable to read the CSV file. Please check the file format.',
    action: 'Make sure the file is a valid CSV with columns for date, description, and amount.',
  },

  // Bank connection errors
  PLAID_INIT_FAILED: {
    message: 'Unable to connect to your bank. Please check your internet connection.',
    action: 'Try again in a few moments or check if your bank is experiencing issues.',
  },
  PLAID_ACCOUNTS_FAILED: {
    message: 'Unable to retrieve your bank accounts. Please reconnect your bank.',
    action: 'You may need to re-authenticate with your bank.',
  },
  PLAID_SYNC_FAILED: {
    message: 'Unable to sync transactions. Your bank may be temporarily unavailable.',
    action: 'Try again later or contact your bank if the issue persists.',
  },

  // Smart categorization errors
  LLM_UNAVAILABLE: {
    message: 'Smart categorization is temporarily unavailable.',
    action: 'Your transactions will be categorized using standard rules.',
  },
  LLM_API_KEY_INVALID: {
    message: 'Invalid API key. Please check your OpenAI API key in settings.',
    action: 'Get a valid API key from platform.openai.com',
  },

  // Generic errors
  NETWORK_ERROR: {
    message: 'Network connection error. Please check your internet connection.',
    action: "Make sure you're connected to the internet and try again.",
  },
  UNKNOWN_ERROR: {
    message: 'Something went wrong. Please try again.',
    action: 'If the problem persists, try refreshing the page.',
  },
} as const;

/**
 * Convert technical errors to user-friendly messages
 */
export function toUserError(error: unknown, context?: string): UserError {
  // Already a user error
  if (error instanceof UserError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Database errors
  if (lowerMessage.includes('indexeddb') || lowerMessage.includes('database')) {
    return new UserError(
      ErrorMessages.DB_OPERATION_FAILED.message,
      errorMessage,
      ErrorMessages.DB_OPERATION_FAILED.action,
    );
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return new UserError(
      ErrorMessages.NETWORK_ERROR.message,
      errorMessage,
      ErrorMessages.NETWORK_ERROR.action,
    );
  }

  // PDF errors
  if (context === 'pdf') {
    if (lowerMessage.includes('not found')) {
      return new UserError(
        ErrorMessages.PDF_NOT_FOUND.message,
        errorMessage,
        ErrorMessages.PDF_NOT_FOUND.action,
      );
    }
    return new UserError(
      ErrorMessages.PDF_PARSE_FAILED.message,
      errorMessage,
      ErrorMessages.PDF_PARSE_FAILED.action,
    );
  }

  // CSV errors
  if (context === 'csv') {
    if (lowerMessage.includes('date')) {
      return new UserError(
        ErrorMessages.CSV_DATE_FORMAT.message,
        errorMessage,
        ErrorMessages.CSV_DATE_FORMAT.action,
      );
    }
    if (lowerMessage.includes('amount')) {
      return new UserError(
        ErrorMessages.CSV_INVALID_AMOUNT.message,
        errorMessage,
        ErrorMessages.CSV_INVALID_AMOUNT.action,
      );
    }
    return new UserError(
      ErrorMessages.CSV_PARSE_FAILED.message,
      errorMessage,
      ErrorMessages.CSV_PARSE_FAILED.action,
    );
  }

  // Default
  return new UserError(
    ErrorMessages.UNKNOWN_ERROR.message,
    errorMessage,
    ErrorMessages.UNKNOWN_ERROR.action,
  );
}

/**
 * Show user-friendly error in toast
 */
export function showUserError(
  error: unknown,
  toast: (args: {
    title: string;
    description: string;
    variant?: 'destructive' | 'default';
  }) => void,
  context?: string,
) {
  const userError = toUserError(error, context);

  toast({
    title: 'Error',
    description: userError.action
      ? `${userError.userMessage} ${userError.action}`
      : userError.userMessage,
    variant: 'destructive',
  });

  // Log technical details for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Technical error:', userError.technicalMessage || error);
  }
}
