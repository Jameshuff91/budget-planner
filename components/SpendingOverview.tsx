'use client';

import React, { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAnalytics } from '../src/hooks/useAnalytics';
import { formatCurrency } from '../src/utils/helpers';

import { ExpenseDetailsModal } from './ExpenseDetailsModal';

export default function SpendingOverview() {
  const { spendingOverview, monthlyTrends } = useAnalytics();
  const [selectedMonth, setSelectedMonth] = useState<(typeof spendingOverview)[0] | null>(null);
  const trends = monthlyTrends;

  // Get current date and month names dynamically
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const previousMonth = (currentMonth - 1 + 12) % 12;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

  const handleBarClick = (data: any) => {
    setSelectedMonth(data.payload);
  };

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
                <p className='text-2xl font-bold'>{formatCurrency(trends.savings.current)}</p>
                <TrendIndicator value={trends.savings.percentageChange} />
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
                <p className='text-2xl font-bold'>{formatCurrency(trends.savings.previous)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className='h-[300px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart 
              data={spendingOverview}
              margin={{ top: 10, right: 10, left: 60, bottom: 30 }}
            >
              <XAxis
                dataKey='name'
                stroke='#888888'
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value, index) => {
                  const item = spendingOverview[index];
                  const prevItem = index > 0 ? spendingOverview[index - 1] : null;
                  
                  // Show year if it's the first item or if the year changed
                  if (index === 0 || (prevItem && prevItem.year !== item?.year)) {
                    return `${value} ${item?.year || ''}`;
                  }
                  return value;
                }}
                angle={-45}
                textAnchor="end"
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
                        <p className='text-sm text-gray-600'>{payload[0].payload.name} {payload[0].payload.year}</p>
                        <p className='font-semibold text-red-600'>
                          Spending: {formatCurrency(payload[0].payload.spending)}
                        </p>
                        <p className='font-semibold text-green-600'>
                          Savings: {formatCurrency(payload[0].payload.savings)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <CartesianGrid strokeDasharray="3 3" className="grid grid-gray-100" />
              <Bar 
                dataKey='spending' 
                fill='#ef4444' 
                radius={[4, 4, 0, 0]} 
                onClick={handleBarClick}
                className='cursor-pointer'
              />
              <Bar
                dataKey='savings'
                name='Savings'
                fill='#16a34a'
                radius={[4, 4, 0, 0]}
                onClick={handleBarClick}
                className='cursor-pointer'
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      {selectedMonth && (
        <ExpenseDetailsModal
          month={selectedMonth.name}
          year={selectedMonth.year}
          spending={selectedMonth.spending}
          savings={selectedMonth.savings}
          onClose={() => setSelectedMonth(null)}
        />
      )}
    </Card>
  );
}
