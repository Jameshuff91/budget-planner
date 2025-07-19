'use client';

import { format, subMonths, startOfMonth } from 'date-fns';
import { Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

import { Button } from '@components/ui/button';
import { useDBContext } from '@context/DatabaseContext';
import { toast } from '@components/ui/use-toast';

import { Transaction } from '../src/types';
import { formatCurrency } from '../src/utils/helpers';

export default function MonthSelector() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [monthlyData, setMonthlyData] = useState<{
    [key: string]: {
      income: number;
      expenses: number;
      summaryTransactions: Transaction[];
      individualTransactions: Transaction[];
    };
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const { getTransactionsByMonth, transactions, deleteTransaction } = useDBContext();

  // Generate months based on available transaction data
  const months = useMemo(() => {
    // Get all transactions to determine date range

    if (!transactions || transactions.length === 0) {
      // Fallback to last 12 months if no transactions
      return Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(new Date(), i);
        return startOfMonth(date);
      }).reverse();
    }

    // Find the earliest and latest transaction dates
    const dates = transactions.map((t) => new Date(t.date));
    const earliestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latestDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Generate months from earliest to latest (plus current month if needed)
    const startMonth = startOfMonth(earliestDate);
    const endMonth = startOfMonth(new Date()); // Include current month
    const finalEndMonth = latestDate > endMonth ? startOfMonth(latestDate) : endMonth;

    const monthsArray: Date[] = [];
    let currentMonth = startMonth;

    while (currentMonth <= finalEndMonth) {
      monthsArray.push(new Date(currentMonth));
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    }

    return monthsArray.reverse(); // Most recent first
  }, [transactions]);

  useEffect(() => {
    const loadMonthlyData = async () => {
      try {
        setIsLoading(true);
        const monthlyStats: {
          [key: string]: {
            income: number;
            expenses: number;
            summaryTransactions: Transaction[];
            individualTransactions: Transaction[];
          };
        } = {};

        for (const month of months) {
          const transactions = await getTransactionsByMonth(month);
          const monthKey = format(month, 'MMM yyyy');

          const summaryTransactions = transactions.filter((t) => t.isMonthSummary);
          const individualTransactions = transactions.filter((t) => !t.isMonthSummary);

          monthlyStats[monthKey] = {
            income: transactions.reduce(
              (sum, t) => (t.type === 'income' ? sum + t.amount : sum),
              0,
            ),
            expenses: transactions.reduce(
              (sum, t) => (t.type === 'expense' ? sum + t.amount : sum),
              0,
            ),
            summaryTransactions,
            individualTransactions,
          };
        }

        setMonthlyData(monthlyStats);

        // Emit spending trend data
        const spendingTrendData = Object.entries(monthlyStats).map(([name, data]) => ({
          name,
          spending: data.expenses,
        }));

        const spendingTrendEvent = new CustomEvent('spendingTrendUpdated', {
          detail: spendingTrendData,
        });
        window.dispatchEvent(spendingTrendEvent);
      } catch (error) {
        console.error('Error loading monthly data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMonthlyData();
  }, [months, getTransactionsByMonth]);

  const handleMonthSelect = (date: Date) => {
    setSelectedMonth(date);
    // Emit event with both the date and the transactions data
    const monthKey = format(date, 'MMM yyyy');
    const monthData = monthlyData[monthKey];
    const event = new CustomEvent('monthSelected', {
      detail: {
        date: date.toISOString(), // Convert to ISO string for reliable serialization
        summaryTransactions: monthData?.summaryTransactions || [],
        individualTransactions: monthData?.individualTransactions || [],
      },
    });
    window.dispatchEvent(event);
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleDelete = async (transactionId: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(transactionId);
        toast({
          title: 'Success',
          description: 'Transaction deleted successfully',
        });
        // Reload monthly data to reflect the deletion
        const monthlyStats: {
          [key: string]: {
            income: number;
            expenses: number;
            summaryTransactions: Transaction[];
            individualTransactions: Transaction[];
          };
        } = { ...monthlyData };
        
        for (const month of months) {
          const transactions = await getTransactionsByMonth(month);
          const monthKey = format(month, 'MMM yyyy');
          
          const summaryTransactions = transactions.filter((t) => t.isMonthSummary);
          const individualTransactions = transactions.filter((t) => !t.isMonthSummary);
          
          monthlyStats[monthKey] = {
            income: transactions.reduce(
              (sum, t) => (t.type === 'income' ? sum + t.amount : sum),
              0,
            ),
            expenses: transactions.reduce(
              (sum, t) => (t.type === 'expense' ? sum + t.amount : sum),
              0,
            ),
            summaryTransactions,
            individualTransactions,
          };
        }
        
        setMonthlyData(monthlyStats);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to delete transaction',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className='w-full mb-6 flex items-center justify-center py-4'>
        <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
      </div>
    );
  }

  return (
    <div className='w-full space-y-6'>
      <div className='flex flex-wrap gap-2'>
        {months.map((month) => {
          const monthKey = format(month, 'MMM yyyy');
          const data = monthlyData[monthKey];
          const isSelected = format(selectedMonth, 'MMM yyyy') === monthKey;
          const hasData = data && (data.income > 0 || data.expenses > 0);

          return (
            <Button
              key={monthKey}
              variant={isSelected ? 'default' : 'outline'}
              size='sm'
              className={`relative ${hasData ? 'border-blue-500' : ''} hover:border-blue-700 transition-colors`}
              onClick={() => handleMonthSelect(month)}
              title={
                hasData
                  ? `Income: $${data.income.toFixed(2)}\nExpenses: $${data.expenses.toFixed(2)}`
                  : 'No data'
              }
            >
              <span>{format(month, 'MMM yyyy')}</span>
              {hasData && (
                <span className='absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full' />
              )}
            </Button>
          );
        })}
      </div>

      {/* Display transactions for selected month */}
      {selectedMonth && (
        <div className='mt-6 space-y-6'>
          {/* Summary Section */}
          {monthlyData[format(selectedMonth, 'MMM yyyy')]?.summaryTransactions.length > 0 && (
            <div className='border rounded-lg p-4'>
              <button
                onClick={() => toggleSection('summary')}
                className='w-full flex justify-between items-center mb-2'
              >
                <h3 className='text-lg font-semibold'>Monthly Summary</h3>
                {expandedSections['summary'] ? (
                  <ChevronUp className='w-5 h-5' />
                ) : (
                  <ChevronDown className='w-5 h-5' />
                )}
              </button>
              {expandedSections['summary'] && (
                <div className='space-y-3'>
                  {monthlyData[format(selectedMonth, 'MMM yyyy')]?.summaryTransactions.map(
                    (transaction, index) => (
                      <div key={index} className='p-3 rounded-md bg-gray-50'>
                        <div className='flex justify-between items-start'>
                          <div className='flex-1'>
                            <p className='font-medium'>{transaction.description}</p>
                            <p className='text-sm text-gray-500'>
                              {format(new Date(transaction.date), 'MMM d, yyyy')}
                              {transaction.accountNumber &&
                                ` • Account: ${transaction.accountNumber}`}
                            </p>
                          </div>
                          <div className='flex items-center gap-2'>
                            <p
                              className={`font-semibold ${transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}
                            >
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatCurrency(transaction.amount)}
                            </p>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDelete(transaction.id)}
                              className='text-red-600 hover:text-red-700 hover:bg-red-50'
                              title='Delete transaction'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          {/* Individual Transactions Section */}
          {monthlyData[format(selectedMonth, 'MMM yyyy')]?.individualTransactions.length > 0 && (
            <div className='border rounded-lg p-4'>
              <button
                onClick={() => toggleSection('transactions')}
                className='w-full flex justify-between items-center mb-2'
              >
                <h3 className='text-lg font-semibold'>Individual Transactions</h3>
                {expandedSections['transactions'] ? (
                  <ChevronUp className='w-5 h-5' />
                ) : (
                  <ChevronDown className='w-5 h-5' />
                )}
              </button>
              {expandedSections['transactions'] && (
                <div className='space-y-3'>
                  {monthlyData[format(selectedMonth, 'MMM yyyy')]?.individualTransactions.map(
                    (transaction, index) => (
                      <div key={index} className='p-3 rounded-md bg-gray-50'>
                        <div className='flex justify-between items-start'>
                          <div className='flex-1'>
                            <p className='font-medium'>{transaction.description}</p>
                            <p className='text-sm text-gray-500'>
                              {format(new Date(transaction.date), 'MMM d, yyyy')}
                              {transaction.accountNumber &&
                                ` • Account: ${transaction.accountNumber}`}
                            </p>
                          </div>
                          <div className='flex items-center gap-2'>
                            <p
                              className={`font-semibold ${transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}
                            >
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatCurrency(transaction.amount)}
                            </p>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleDelete(transaction.id)}
                              className='text-red-600 hover:text-red-700 hover:bg-red-50'
                              title='Delete transaction'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
