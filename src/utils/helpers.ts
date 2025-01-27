import { logger } from '../services/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const formatCurrency = (amount: number): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  } catch (error) {
    logger.error('Error formatting currency', error);
    return `$${amount.toFixed(2)}`;
  }
};

export const validateTransaction = (transaction: {
  amount: number;
  category: string;
  description: string;
  type: 'income' | 'expense';
}): ValidationResult => {
  const errors: string[] = [];

  if (!transaction.amount || transaction.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!transaction.category?.trim()) {
    errors.push('Category is required');
  }

  if (!transaction.description?.trim()) {
    errors.push('Description is required');
  }

  if (!['income', 'expense'].includes(transaction.type)) {
    errors.push('Invalid transaction type');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const calculateTotalsByCategory = (
  transactions: Array<{
    amount: number;
    category: string;
    type: 'income' | 'expense';
  }>,
): Record<string, { total: number; type: 'income' | 'expense' }> => {
  return transactions.reduce(
    (acc, transaction) => {
      if (!acc[transaction.category]) {
        acc[transaction.category] = { total: 0, type: transaction.type };
      }
      acc[transaction.category].total += transaction.amount;
      return acc;
    },
    {} as Record<string, { total: number; type: 'income' | 'expense' }>,
  );
};

export const generateMonthlyReport = (
  transactions: Array<{
    amount: number;
    date: Date;
    type: 'income' | 'expense';
  }>,
) => {
  const report = {
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    monthlyBreakdown: {} as Record<
      string,
      {
        income: number;
        expenses: number;
        savings: number;
      }
    >,
  };

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!report.monthlyBreakdown[monthKey]) {
      report.monthlyBreakdown[monthKey] = {
        income: 0,
        expenses: 0,
        savings: 0,
      };
    }

    if (transaction.type === 'income') {
      report.totalIncome += transaction.amount;
      report.monthlyBreakdown[monthKey].income += transaction.amount;
    } else {
      report.totalExpenses += transaction.amount;
      report.monthlyBreakdown[monthKey].expenses += transaction.amount;
    }

    report.monthlyBreakdown[monthKey].savings =
      report.monthlyBreakdown[monthKey].income - report.monthlyBreakdown[monthKey].expenses;
  });

  report.netSavings = report.totalIncome - report.totalExpenses;
  return report;
};

export function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
