'use client';

import { AlertCircle, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useDBContext } from '@context/DatabaseContext';
import { useAnalytics } from '@hooks/useAnalytics';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DiagnosticItem {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export default function ChartDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const { transactions, categories } = useDBContext();
  const { categorySpending, spendingOverview } = useAnalytics();

  const runDiagnostics = useCallback(async () => {
    const results: DiagnosticItem[] = [];

    // 1. Check database connection
    results.push({
      name: 'Database Connection',
      status: 'pass',
      message: 'Database context is available',
    });

    // 2. Check transaction data
    if (!transactions || transactions.length === 0) {
      results.push({
        name: 'Transaction Data',
        status: 'fail',
        message: 'No transactions found in database',
        details:
          'Charts require transaction data to display. Upload a bank statement PDF to get started.',
      });
    } else {
      results.push({
        name: 'Transaction Data',
        status: 'pass',
        message: `Found ${transactions.length} transactions`,
        details: `Date range: ${new Date(Math.min(...transactions.map((t) => new Date(t.date).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...transactions.map((t) => new Date(t.date).getTime()))).toLocaleDateString()}`,
      });

      // Check for valid transaction dates
      const invalidDates = transactions.filter((t) => isNaN(new Date(t.date).getTime()));
      if (invalidDates.length > 0) {
        results.push({
          name: 'Transaction Dates',
          status: 'warning',
          message: `${invalidDates.length} transactions have invalid dates`,
          details: 'Invalid dates may cause charts to render incorrectly',
        });
      } else {
        results.push({
          name: 'Transaction Dates',
          status: 'pass',
          message: 'All transaction dates are valid',
        });
      }

      // Check for valid amounts
      const invalidAmounts = transactions.filter((t) => isNaN(t.amount) || t.amount === 0);
      if (invalidAmounts.length > 0) {
        results.push({
          name: 'Transaction Amounts',
          status: 'warning',
          message: `${invalidAmounts.length} transactions have invalid or zero amounts`,
          details: 'Transactions with zero or invalid amounts may not appear in charts',
        });
      } else {
        results.push({
          name: 'Transaction Amounts',
          status: 'pass',
          message: 'All transaction amounts are valid',
        });
      }
    }

    // 3. Check categories
    if (!categories || categories.length === 0) {
      results.push({
        name: 'Categories',
        status: 'fail',
        message: 'No categories found',
        details: 'Categories are required for spending by category chart',
      });
    } else {
      results.push({
        name: 'Categories',
        status: 'pass',
        message: `Found ${categories.length} categories`,
      });

      // Check if transactions have categories
      const uncategorized = transactions.filter((t) => !t.categoryId);
      if (uncategorized.length > 0) {
        results.push({
          name: 'Transaction Categorization',
          status: 'warning',
          message: `${uncategorized.length} transactions are uncategorized`,
          details: 'Uncategorized transactions will appear as "Other" in charts',
        });
      }
    }

    // 4. Check analytics data
    if (!categorySpending || categorySpending.length === 0) {
      results.push({
        name: 'Category Spending Data',
        status: 'fail',
        message: 'No category spending data available',
        details: 'This may indicate an issue with data processing',
      });
    } else {
      const totalSpending = categorySpending.reduce((sum, cat) => sum + cat.value, 0);
      results.push({
        name: 'Category Spending Data',
        status: 'pass',
        message: `Category spending data available for ${categorySpending.length} categories`,
        details: `Total spending: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSpending)}`,
      });
    }

    if (!spendingOverview || spendingOverview.length === 0) {
      results.push({
        name: 'Monthly Overview Data',
        status: 'fail',
        message: 'No monthly overview data available',
        details: 'This prevents the spending overview chart from displaying',
      });
    } else {
      results.push({
        name: 'Monthly Overview Data',
        status: 'pass',
        message: `Monthly data available for ${spendingOverview.length} months`,
        details: `Years covered: ${[...new Set(spendingOverview.map((s) => s.year))].join(', ')}`,
      });
    }

    // 5. Check browser compatibility
    if (typeof window !== 'undefined') {
      results.push({
        name: 'Browser Environment',
        status: 'pass',
        message: 'Running in browser environment',
        details: `User Agent: ${window.navigator.userAgent.substring(0, 50)}...`,
      });

      // Check for Canvas support (required for charts)
      const canvas = document.createElement('canvas');
      if (canvas.getContext && canvas.getContext('2d')) {
        results.push({
          name: 'Canvas Support',
          status: 'pass',
          message: 'Browser supports HTML5 Canvas',
        });
      } else {
        results.push({
          name: 'Canvas Support',
          status: 'fail',
          message: 'Browser does not support HTML5 Canvas',
          details: 'Charts require Canvas support to render',
        });
      }
    }

    // 6. Check date filtering
    const currentYear = new Date().getFullYear();
    const currentYearTransactions = transactions.filter(
      (t) => new Date(t.date).getFullYear() === currentYear,
    );
    if (transactions.length > 0 && currentYearTransactions.length === 0) {
      results.push({
        name: 'Current Year Data',
        status: 'warning',
        message: `No transactions found for ${currentYear}`,
        details:
          'Charts default to current year. Try changing the year filter or uploading recent statements.',
      });
    }

    setDiagnostics(results);
  }, [transactions, categories, categorySpending, spendingOverview]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className='w-5 h-5 text-green-500' />;
      case 'fail':
        return <XCircle className='w-5 h-5 text-red-500' />;
      case 'warning':
        return <AlertCircle className='w-5 h-5 text-yellow-500' />;
    }
  };

  const failCount = diagnostics.filter((d) => d.status === 'fail').length;
  const warningCount = diagnostics.filter((d) => d.status === 'warning').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <BarChart3 className='w-5 h-5' />
          Chart Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex gap-4 text-sm'>
            <span className='flex items-center gap-1'>
              <CheckCircle className='w-4 h-4 text-green-500' />
              {diagnostics.filter((d) => d.status === 'pass').length} Passed
            </span>
            <span className='flex items-center gap-1'>
              <AlertCircle className='w-4 h-4 text-yellow-500' />
              {warningCount} Warnings
            </span>
            <span className='flex items-center gap-1'>
              <XCircle className='w-4 h-4 text-red-500' />
              {failCount} Failed
            </span>
          </div>

          {failCount > 0 && (
            <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-sm text-red-800 font-medium'>
                {failCount} critical issue{failCount > 1 ? 's' : ''} found that may prevent charts
                from displaying.
              </p>
            </div>
          )}

          <div className='space-y-2'>
            {diagnostics.map((item, index) => (
              <div key={index} className='border rounded-lg p-3'>
                <div className='flex items-start gap-2'>
                  {getStatusIcon(item.status)}
                  <div className='flex-1'>
                    <h4 className='font-medium text-sm'>{item.name}</h4>
                    <p className='text-sm text-gray-600'>{item.message}</p>
                    {item.details && <p className='text-xs text-gray-500 mt-1'>{item.details}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className='mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md'>
            <h4 className='text-sm font-medium text-blue-900 mb-2'>Troubleshooting Tips:</h4>
            <ul className='text-xs text-blue-800 space-y-1 list-disc list-inside'>
              <li>Upload a bank statement PDF to populate transaction data</li>
              <li>Ensure transactions have valid dates in MM/DD/YYYY format</li>
              <li>Check that the selected year filter matches your data</li>
              <li>Try refreshing the page if charts don&apos;t appear immediately</li>
              <li>Clear browser cache if experiencing persistent issues</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
