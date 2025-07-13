'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';

interface YearOverYearComparisonProps {
  selectedYear: number;
}

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export default function YearOverYearComparison({ selectedYear }: YearOverYearComparisonProps) {
  const { monthlySpendingData } = useAnalytics();

  const comparisonData = useMemo(() => {
    const currentYearData = monthlySpendingData.filter((d) => d.year === selectedYear);
    const previousYearData = monthlySpendingData.filter((d) => d.year === selectedYear - 1);

    return monthNames.map((month, index) => {
      const currentMonth = currentYearData.find((d) => d.month === index);
      const previousMonth = previousYearData.find((d) => d.month === index);

      return {
        month,
        [selectedYear]: currentMonth?.totalSpending || 0,
        [`${selectedYear - 1}`]: previousMonth?.totalSpending || 0,
        currentIncome: currentMonth?.totalIncome || 0,
        previousIncome: previousMonth?.totalIncome || 0,
      };
    });
  }, [monthlySpendingData, selectedYear]);

  const yearOverYearStats = useMemo(() => {
    const currentYearTotal = comparisonData.reduce((sum, d) => sum + d[selectedYear], 0);
    const previousYearTotal = comparisonData.reduce((sum, d) => sum + d[`${selectedYear - 1}`], 0);
    const currentIncomeTotal = comparisonData.reduce((sum, d) => sum + d.currentIncome, 0);
    const previousIncomeTotal = comparisonData.reduce((sum, d) => sum + d.previousIncome, 0);

    const spendingChange =
      previousYearTotal > 0
        ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
        : 0;

    const incomeChange =
      previousIncomeTotal > 0
        ? ((currentIncomeTotal - previousIncomeTotal) / previousIncomeTotal) * 100
        : 0;

    return {
      currentYearTotal,
      previousYearTotal,
      spendingChange,
      currentIncomeTotal,
      previousIncomeTotal,
      incomeChange,
    };
  }, [comparisonData, selectedYear]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className='bg-white p-3 border rounded-lg shadow-lg'>
        <p className='font-semibold'>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 5) return <TrendingUp className='h-4 w-4 text-red-500' />;
    if (value < -5) return <TrendingDown className='h-4 w-4 text-green-500' />;
    return <Minus className='h-4 w-4 text-gray-500' />;
  };

  return (
    <div className='space-y-4'>
      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-medium'>Spending Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-muted-foreground'>{selectedYear - 1}:</span>
                <span className='font-semibold'>
                  {formatCurrency(yearOverYearStats.previousYearTotal)}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-muted-foreground'>{selectedYear}:</span>
                <span className='font-semibold'>
                  {formatCurrency(yearOverYearStats.currentYearTotal)}
                </span>
              </div>
              <div className='flex justify-between items-center pt-2 border-t'>
                <span className='text-sm font-medium'>Change:</span>
                <div className='flex items-center gap-1'>
                  <TrendIcon value={yearOverYearStats.spendingChange} />
                  <span
                    className={`font-semibold ${
                      yearOverYearStats.spendingChange > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {Math.abs(yearOverYearStats.spendingChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-medium'>Income Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-muted-foreground'>{selectedYear - 1}:</span>
                <span className='font-semibold'>
                  {formatCurrency(yearOverYearStats.previousIncomeTotal)}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-muted-foreground'>{selectedYear}:</span>
                <span className='font-semibold'>
                  {formatCurrency(yearOverYearStats.currentIncomeTotal)}
                </span>
              </div>
              <div className='flex justify-between items-center pt-2 border-t'>
                <span className='text-sm font-medium'>Change:</span>
                <div className='flex items-center gap-1'>
                  <TrendIcon value={-yearOverYearStats.incomeChange} />
                  <span
                    className={`font-semibold ${
                      yearOverYearStats.incomeChange > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {Math.abs(yearOverYearStats.incomeChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Spending Trend</CardTitle>
          <CardDescription>
            Monthly spending comparison between {selectedYear - 1} and {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width='100%' height={350}>
            <LineChart data={comparisonData}>
              <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
              <XAxis dataKey='month' tick={{ fontSize: 12 }} tickLine={{ stroke: '#e0e0e0' }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e0e0e0' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke='#666' strokeDasharray='3 3' />
              <Line
                type='monotone'
                dataKey={`${selectedYear - 1}`}
                stroke='#94a3b8'
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={`${selectedYear - 1} Spending`}
              />
              <Line
                type='monotone'
                dataKey={selectedYear.toString()}
                stroke='#3b82f6'
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={`${selectedYear} Spending`}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Variance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Variance Analysis</CardTitle>
          <CardDescription>
            Month-by-month spending changes from {selectedYear - 1} to {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {comparisonData.map((data, index) => {
              const variance = data[selectedYear] - data[`${selectedYear - 1}`];
              const percentChange =
                data[`${selectedYear - 1}`] > 0
                  ? (variance / data[`${selectedYear - 1}`]) * 100
                  : 0;

              return (
                <div
                  key={index}
                  className='flex items-center justify-between py-2 border-b last:border-0'
                >
                  <span className='font-medium'>{data.month}</span>
                  <div className='flex items-center gap-4'>
                    <span className='text-sm text-muted-foreground'>
                      {formatCurrency(data[`${selectedYear - 1}`])} →{' '}
                      {formatCurrency(data[selectedYear])}
                    </span>
                    <div className='flex items-center gap-1 min-w-[100px] justify-end'>
                      <TrendIcon value={percentChange} />
                      <span
                        className={`text-sm font-medium ${
                          variance > 0
                            ? 'text-red-600'
                            : variance < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {variance !== 0
                          ? `${variance > 0 ? '+' : ''}${formatCurrency(variance)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
