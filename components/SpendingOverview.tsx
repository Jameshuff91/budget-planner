'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAnalytics } from '../src/hooks/useAnalytics';
import { formatCurrency } from '../src/utils/helpers';

import { ExpenseDetailsModal } from './ExpenseDetailsModal';

interface SpendingOverviewProps {
  selectedYear?: number;
}

export default function SpendingOverview({
  selectedYear: propSelectedYear,
}: SpendingOverviewProps) {
  const { spendingOverview, monthlyTrends } = useAnalytics();
  const [selectedMonth, setSelectedMonth] = useState<(typeof spendingOverview)[0] | null>(null);
  const [internalSelectedYear, setInternalSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );

  // Use prop if provided, otherwise use internal state
  const selectedYear = propSelectedYear ?? internalSelectedYear;
  const trends = monthlyTrends;

  // Get current date and month names dynamically
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const previousMonth = (currentMonth - 1 + 12) % 12;
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Filter data for selected year
  const yearData = useMemo(() => {
    return spendingOverview.filter((item) => item.year === selectedYear);
  }, [spendingOverview, selectedYear]);

  const handleBarClick = (data: any) => {
    setSelectedMonth(data.payload);
  };

  const handleYearChange = (direction: 'next' | 'prev') => {
    setInternalSelectedYear((prev) => (direction === 'next' ? prev + 1 : prev - 1));
  };

  // Get available years from the data
  const availableYears = useMemo(() => {
    const years = new Set(spendingOverview.map((item) => item.year));
    return Array.from(years).sort();
  }, [spendingOverview]);

  const canNavigateNext = useMemo(() => {
    return selectedYear < Math.max(...availableYears);
  }, [selectedYear, availableYears]);

  const canNavigatePrev = useMemo(() => {
    return selectedYear > Math.min(...availableYears);
  }, [selectedYear, availableYears]);

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span className={`text-sm ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle></CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100'>
          <div className='space-y-2'>
            <h3 className='text-lg font-semibold'>Current Month: {monthNames[currentMonth]}</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Spending</p>
                <p className='text-2xl font-bold'>{formatCurrency(trends.spending.current)}</p>
                <TrendIndicator value={trends.spending.percentageChange} />
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Savings</p>
                <p className='text-2xl font-bold'>{formatCurrency(trends.netSavings.current)}</p>
                <TrendIndicator value={trends.netSavings.percentageChange} />
              </div>
            </div>
          </div>
          <div className='space-y-2'>
            <h3 className='text-lg font-semibold'>Previous Month: {monthNames[previousMonth]}</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Spending</p>
                <p className='text-2xl font-bold'>{formatCurrency(trends.spending.previous)}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Savings</p>
                <p className='text-2xl font-bold'>{formatCurrency(trends.netSavings.previous)}</p>
              </div>
            </div>
          </div>
        </div>
        {!propSelectedYear && (
          <div className='flex justify-between items-center mb-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleYearChange('prev')}
              disabled={!canNavigatePrev}
            >
              <ChevronLeft className='h-4 w-4 mr-1' />
              Previous Year
            </Button>
            <div className='text-lg font-semibold'>{selectedYear}</div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => handleYearChange('next')}
              disabled={!canNavigateNext}
            >
              Next Year
              <ChevronRight className='h-4 w-4 ml-1' />
            </Button>
          </div>
        )}
        <div className='h-[300px] w-full'>
          {yearData.length > 0 ? (
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={yearData} margin={{ top: 10, right: 10, left: 60, bottom: 30 }}>
                <XAxis
                  dataKey='name'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor='end'
                  height={60}
                />
                <YAxis
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${formatCurrency(value)}`}
                  width={60}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className='bg-white p-4 rounded-lg shadow-lg border'>
                          <p className='text-sm text-gray-600'>
                            {payload[0].payload.name} {payload[0].payload.year}
                          </p>
                          <p className='font-semibold text-red-600'>
                            Spending: {formatCurrency(payload[0].payload.totalSpending)}
                          </p>
                          <p className='font-semibold text-green-600'>
                            Income: {formatCurrency(payload[0].payload.totalIncome)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <CartesianGrid strokeDasharray='3 3' className='grid grid-gray-100' />
                <Bar
                  dataKey='totalSpending'
                  name='Spending'
                  fill='#ef4444'
                  radius={[4, 4, 0, 0]}
                  onClick={handleBarClick}
                  className='cursor-pointer'
                />
                <Bar
                  dataKey='totalIncome'
                  name='Income'
                  fill='#16a34a'
                  radius={[4, 4, 0, 0]}
                  onClick={handleBarClick}
                  className='cursor-pointer'
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='flex items-center justify-center h-full bg-gray-50 rounded-lg'>
              <div className='text-center p-6'>
                <p className='text-lg font-medium text-gray-700 mb-2'>No data for {selectedYear}</p>
                <p className='text-sm text-gray-500 mb-4'>
                  Upload bank statements from {selectedYear} to see monthly overview
                </p>
                <div className='space-y-2 text-xs text-gray-400'>
                  <p>• Use the year navigation to view other years</p>
                  <p>• Click on bars to see detailed expenses</p>
                  <p>• Check the Diagnostics tab for troubleshooting</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {selectedMonth && (
        <ExpenseDetailsModal
          month={selectedMonth.month}
          year={selectedMonth.year}
          spending={selectedMonth.totalSpending}
          savings={selectedMonth.totalIncome - selectedMonth.totalSpending}
          onClose={() => setSelectedMonth(null)}
        />
      )}
    </Card>
  );
}
