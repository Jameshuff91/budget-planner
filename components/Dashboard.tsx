'use client';

import { DollarSign, TrendingUp, PiggyBank } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { useDatabase } from '../src/hooks/useDatabase';

import BudgetGoal from './BudgetGoal';
import SpendingByCategory from './SpendingByCategory';
import SpendingOverview from './SpendingOverview';
import SpendingTrend from './SpendingTrend';

// Default values for empty state
const DEFAULT_INCOME = 0;
const DEFAULT_SPENDING = 0;
const DEFAULT_SAVINGS = 0;

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { transactions, loading, error } = useDatabase();
  
  // Get current date information
  const currentDate = new Date(); // Use actual current date
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const previousMonth = (currentMonth - 1 + 12) % 12;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

  const financialSummary = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        income: DEFAULT_INCOME,
        spending: DEFAULT_SPENDING,
        savings: DEFAULT_SAVINGS,
        spendingPercentage: '0.00',
        savingsPercentage: '0.00',
        monthlyData: new Map()
      };
    }

    // Filter transactions for selected year only
    const selectedYearTransactions = transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate.getFullYear() === selectedYear;
    });

    // Group transactions by month for selected year only
    const monthlyData = selectedYearTransactions.reduce((acc, transaction) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!acc.has(monthKey)) {
        acc.set(monthKey, { income: 0, spending: 0 });
      }
      
      const monthData = acc.get(monthKey)!;
      if (transaction.type === 'income') {
        monthData.income += transaction.amount;
      } else {
        monthData.spending += transaction.amount;
      }
      
      return acc;
    }, new Map<string, { income: number; spending: number }>());

    // Calculate totals
    let totalIncome = 0;
    let totalSpending = 0;

    monthlyData.forEach(({ income, spending }) => {
      totalIncome += income;
      totalSpending += spending;
    });

    // Ensure spending is displayed as positive value
    const displaySpending = Math.abs(totalSpending);
    const totalSavings = totalIncome - displaySpending;
    const nonZeroIncome = totalIncome || 0.01; // Prevent division by zero

    return {
      income: totalIncome,
      spending: displaySpending,
      savings: totalSavings,
      spendingPercentage: ((displaySpending / nonZeroIncome) * 100).toFixed(2),
      savingsPercentage: ((totalSavings / nonZeroIncome) * 100).toFixed(2),
      monthlyData
    };
  }, [transactions, selectedYear]);

  // Get available years from transactions
  const availableYears = useMemo(() => {
    if (!transactions || transactions.length === 0) return [new Date().getFullYear()];
    
    const years = new Set<number>();
    transactions.forEach(transaction => {
      const year = new Date(transaction.date).getFullYear();
      years.add(year);
    });
    
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  }, [transactions]);

  if (error) {
    return <div className='text-red-500'>Error loading data: {error}</div>;
  }

  if (loading) {
    return <div className='text-gray-500'>Loading...</div>;
  }

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h2 className='text-3xl font-bold text-gray-800'>Financial Dashboard</h2>
        <div className='flex items-center gap-3'>
          <label htmlFor="year-select" className='text-sm font-medium text-gray-600'>Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className='px-3 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card className='bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-lg font-medium'>Total Annual Income</CardTitle>
            <DollarSign className='h-6 w-6 opacity-75' />
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>${financialSummary.income.toLocaleString()}</div>
            <p className='text-sm opacity-75'>Combined disposable income</p>
          </CardContent>
        </Card>
        <Card className='bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-lg font-medium'>Annual Spending</CardTitle>
            <TrendingUp className='h-6 w-6 opacity-75' />
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>${financialSummary.spending.toLocaleString()}</div>
            <p className='text-sm opacity-75'>{financialSummary.spendingPercentage}% of income</p>
          </CardContent>
        </Card>
        <Card className='bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-lg font-medium'>Annual Savings</CardTitle>
            <PiggyBank className='h-6 w-6 opacity-75' />
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>${financialSummary.savings.toLocaleString()}</div>
            <p className='text-sm opacity-75'>{financialSummary.savingsPercentage}% of income</p>
          </CardContent>
        </Card>
      </div>

      <Card className='shadow-md'>
        <CardHeader>
          <div className='flex justify-between items-center'>
            <CardTitle>Monthly Overview</CardTitle>
            <div className='text-sm text-gray-500'>Current Month: {monthNames[currentMonth]}</div>
          </div>
        </CardHeader>
        <CardContent className='pl-2'>
          <SpendingOverview selectedYear={selectedYear} />
        </CardContent>
      </Card>

      <Tabs defaultValue='overview' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='categories'>Categories</TabsTrigger>
          <TabsTrigger value='trends'>Trends</TabsTrigger>
        </TabsList>
        <TabsContent value='overview' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-7'>
            <Card className='col-span-7'>
              <CardHeader>
                <CardTitle>Budget Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <BudgetGoal />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value='categories'>
          <SpendingByCategory selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value='trends'>
          <SpendingTrend selectedYear={selectedYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
