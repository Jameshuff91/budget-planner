'use client';

import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { useDatabase } from '@hooks/useDatabase';
import { formatCurrency } from '@utils/helpers';

import { IncomeExpensesForecastSkeleton } from './skeletons/IncomeExpensesForecastSkeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface ForecastData {
  month: string;
  income: number;
  expenses: number;
  netIncome: number;
  projectedIncome?: number;
  projectedExpenses?: number;
  projectedNetIncome?: number;
}

interface Props {
  selectedYear?: number;
}

export default function IncomeExpensesForecast({ selectedYear }: Props) {
  const { transactions, loading } = useDatabase();
  const [forecastMonths, setForecastMonths] = useState(3);
  const [showForecast, setShowForecast] = useState(true);

  const { historicalData, forecastData, trends } = useMemo(() => {
    if (!transactions.length) return { historicalData: [], forecastData: [], trends: {} };

    const currentDate = new Date();
    const year = selectedYear || currentDate.getFullYear();
    const startDate = new Date(year - 1, 0, 1); // Start from previous year for better trend analysis
    const endDate = new Date(year, 11, 31);

    // Group transactions by month
    const monthlyData = new Map<string, { income: number; expenses: number }>();

    transactions
      .filter((t) => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      })
      .forEach((t) => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { income: 0, expenses: 0 });
        }

        const data = monthlyData.get(monthKey)!;
        if (t.amount > 0) {
          data.income += t.amount;
        } else {
          data.expenses += Math.abs(t.amount);
        }
      });

    // Convert to array and sort
    const sortedData = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        netIncome: data.income - data.expenses,
      }));

    // Calculate trends using linear regression
    const calculateTrend = (values: number[]) => {
      const n = values.length;
      if (n < 2) return { slope: 0, intercept: 0 };

      const sumX = (n * (n + 1)) / 2;
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = values.reduce((sum, y, x) => sum + (x + 1) * y, 0);
      const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      return { slope, intercept };
    };

    // Get recent months for trend calculation (last 6 months)
    const recentMonths = sortedData.slice(-6);
    const incomeTrend = calculateTrend(recentMonths.map((d) => d.income));
    const expensesTrend = calculateTrend(recentMonths.map((d) => d.expenses));

    // Generate forecast
    const lastMonth = sortedData[sortedData.length - 1];
    const lastDate = new Date(lastMonth.month + '-01');
    const forecast: ForecastData[] = [];

    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
      const monthKey = `${forecastDate.getFullYear()}-${String(
        forecastDate.getMonth() + 1,
      ).padStart(2, '0')}`;

      // Apply seasonal adjustments based on historical data
      const historicalMonth = sortedData.find((d) =>
        d.month.endsWith(`-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`),
      );
      const seasonalFactor = historicalMonth
        ? {
            income: historicalMonth.income / (recentMonths.reduce((a, b) => a + b.income, 0) / 6),
            expenses:
              historicalMonth.expenses / (recentMonths.reduce((a, b) => a + b.expenses, 0) / 6),
          }
        : { income: 1, expenses: 1 };

      const projectedIncome = Math.max(
        0,
        (incomeTrend.intercept + incomeTrend.slope * (recentMonths.length + i)) *
          seasonalFactor.income,
      );
      const projectedExpenses = Math.max(
        0,
        (expensesTrend.intercept + expensesTrend.slope * (recentMonths.length + i)) *
          seasonalFactor.expenses,
      );

      forecast.push({
        month: monthKey,
        income: 0,
        expenses: 0,
        netIncome: 0,
        projectedIncome,
        projectedExpenses,
        projectedNetIncome: projectedIncome - projectedExpenses,
      });
    }

    // Combine historical and forecast data
    const combinedData = [...sortedData, ...forecast];

    return {
      historicalData: sortedData,
      forecastData: combinedData,
      trends: {
        income: incomeTrend,
        expenses: expensesTrend,
        incomeGrowth: (incomeTrend.slope / (recentMonths[0]?.income || 1)) * 100,
        expensesGrowth: (expensesTrend.slope / (recentMonths[0]?.expenses || 1)) * 100,
      },
    };
  }, [transactions, selectedYear, forecastMonths]);

  if (loading) {
    return <IncomeExpensesForecastSkeleton />;
  }

  if (historicalData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses Forecast</CardTitle>
          <CardDescription>
            Predict future income and expenses based on historical trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              No transaction data available for forecasting. Add some transactions to see
              projections.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <DollarSign className='h-5 w-5' />
          Income vs Expenses Forecast
        </CardTitle>
        <CardDescription>
          Historical trends and future projections based on your spending patterns
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex gap-2'>
            <Button
              variant={forecastMonths === 3 ? 'default' : 'outline'}
              size='sm'
              onClick={() => setForecastMonths(3)}
            >
              3 Months
            </Button>
            <Button
              variant={forecastMonths === 6 ? 'default' : 'outline'}
              size='sm'
              onClick={() => setForecastMonths(6)}
            >
              6 Months
            </Button>
            <Button
              variant={forecastMonths === 12 ? 'default' : 'outline'}
              size='sm'
              onClick={() => setForecastMonths(12)}
            >
              12 Months
            </Button>
          </div>
          <Button variant='outline' size='sm' onClick={() => setShowForecast(!showForecast)}>
            {showForecast ? 'Hide' : 'Show'} Forecast
          </Button>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Income Trend</p>
            <div className='flex items-center gap-2'>
              {trends.incomeGrowth && trends.incomeGrowth > 0 ? (
                <TrendingUp className='h-4 w-4 text-green-500' />
              ) : (
                <TrendingDown className='h-4 w-4 text-red-500' />
              )}
              <span
                className={
                  trends.incomeGrowth && trends.incomeGrowth > 0 ? 'text-green-600' : 'text-red-600'
                }
              >
                {trends.incomeGrowth && trends.incomeGrowth > 0 ? '+' : ''}
                {trends.incomeGrowth?.toFixed(1) || '0.0'}% monthly
              </span>
            </div>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Expenses Trend</p>
            <div className='flex items-center gap-2'>
              {trends.expensesGrowth && trends.expensesGrowth > 0 ? (
                <TrendingUp className='h-4 w-4 text-red-500' />
              ) : (
                <TrendingDown className='h-4 w-4 text-green-500' />
              )}
              <span
                className={
                  trends.expensesGrowth && trends.expensesGrowth > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }
              >
                {trends.expensesGrowth && trends.expensesGrowth > 0 ? '+' : ''}
                {trends.expensesGrowth?.toFixed(1) || '0.0'}% monthly
              </span>
            </div>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Average Net Income</p>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>
                {formatCurrency(
                  historicalData.reduce((sum, d) => sum + d.netIncome, 0) / historicalData.length,
                )}
              </span>
              <span className='text-sm text-muted-foreground'>per month</span>
            </div>
          </div>
        </div>

        <div className='h-96'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart
              data={showForecast ? forecastData : historicalData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='month' tickFormatter={formatMonth} />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={formatMonth}
              />
              <Legend />
              <ReferenceLine y={0} stroke='#666' />

              {/* Historical data */}
              <Line
                type='monotone'
                dataKey='income'
                stroke='#10b981'
                strokeWidth={2}
                dot={{ r: 4 }}
                name='Income'
              />
              <Line
                type='monotone'
                dataKey='expenses'
                stroke='#ef4444'
                strokeWidth={2}
                dot={{ r: 4 }}
                name='Expenses'
              />
              <Line
                type='monotone'
                dataKey='netIncome'
                stroke='#3b82f6'
                strokeWidth={2}
                dot={{ r: 4 }}
                name='Net Income'
              />

              {/* Forecast data */}
              {showForecast && (
                <>
                  <Line
                    type='monotone'
                    dataKey='projectedIncome'
                    stroke='#10b981'
                    strokeWidth={2}
                    strokeDasharray='5 5'
                    dot={{ r: 4 }}
                    name='Projected Income'
                  />
                  <Line
                    type='monotone'
                    dataKey='projectedExpenses'
                    stroke='#ef4444'
                    strokeWidth={2}
                    strokeDasharray='5 5'
                    dot={{ r: 4 }}
                    name='Projected Expenses'
                  />
                  <Line
                    type='monotone'
                    dataKey='projectedNetIncome'
                    stroke='#3b82f6'
                    strokeWidth={2}
                    strokeDasharray='5 5'
                    dot={{ r: 4 }}
                    name='Projected Net Income'
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {showForecast && (
          <Alert>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              Forecasts are based on historical trends and seasonal patterns. Actual results may
              vary based on your spending behavior and unexpected expenses.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
