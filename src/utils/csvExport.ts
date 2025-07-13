import { Transaction } from '@/src/types';

/**
 * Convert transactions to CSV format
 */
export function transactionsToCSV(transactions: Transaction[]): string {
  // Define CSV headers
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];

  // Convert transactions to CSV rows
  const rows = transactions.map((transaction) => {
    const date = new Date(transaction.date).toLocaleDateString('en-US');
    const description = `"${transaction.description.replace(/"/g, '""')}"`;
    const category = transaction.category;
    const type = transaction.type;
    const amount = transaction.amount.toFixed(2);

    return [date, description, category, type, amount].join(',');
  });

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download data as a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create a Blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary link element
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  // Add to DOM, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export transactions to CSV file
 */
export function exportTransactionsToCSV(transactions: Transaction[], filename?: string): void {
  const csvContent = transactionsToCSV(transactions);
  const defaultFilename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename || defaultFilename);
}

/**
 * Generate a summary CSV with category totals
 */
export function generateCategorySummaryCSV(transactions: Transaction[]): string {
  // Group transactions by category
  const categoryTotals = transactions.reduce(
    (acc, transaction) => {
      const category = transaction.category;
      if (!acc[category]) {
        acc[category] = { income: 0, expenses: 0, count: 0 };
      }

      acc[category].count++;
      if (transaction.type === 'income') {
        acc[category].income += transaction.amount;
      } else {
        acc[category].expenses += Math.abs(transaction.amount);
      }

      return acc;
    },
    {} as Record<string, { income: number; expenses: number; count: number }>,
  );

  // Convert to CSV format
  const headers = ['Category', 'Total Income', 'Total Expenses', 'Net', 'Transaction Count'];
  const rows = Object.entries(categoryTotals).map(([category, data]) => {
    const net = data.income - data.expenses;
    return [
      category,
      data.income.toFixed(2),
      data.expenses.toFixed(2),
      net.toFixed(2),
      data.count.toString(),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export category summary to CSV file
 */
export function exportCategorySummaryToCSV(transactions: Transaction[], filename?: string): void {
  const csvContent = generateCategorySummaryCSV(transactions);
  const defaultFilename = `category_summary_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csvContent, filename || defaultFilename);
}
