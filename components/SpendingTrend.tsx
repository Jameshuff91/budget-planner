'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAnalytics } from '../src/hooks/useAnalytics';
import { formatCurrency } from '../src/utils/helpers';
import { useDBContext } from '@context/DatabaseContext';

type SpendingTrendData = {
  name: string;
  year: number;
  spending: number;
  savings: number;
  spendingTrend?: number;
  savingsTrend?: number;
};

// Helper function to calculate linear regression
const calculateTrendLine = (data: { x: number; y: number }[]): { slope: number; intercept: number } => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += data[i].x;
    sumY += data[i].y;
    sumXY += data[i].x * data[i].y;
    sumXX += data[i].x * data[i].x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

export default function SpendingTrend() {
  const [trendData, setTrendData] = useState<SpendingTrendData[]>([]);
  const { transactions } = useDBContext();

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      // Group transactions by month and calculate totals
      const monthlyTotals = transactions.reduce((acc, transaction) => {
        const date = new Date(transaction.date);
        const monthKey = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        
        if (!acc[monthKey]) {
          acc[monthKey] = { spending: 0, savings: 0, year };
        }
        
        if (transaction.type === 'expense') {
          acc[monthKey].spending += transaction.amount;
        } else if (transaction.type === 'income') {
          acc[monthKey].savings += transaction.amount;
        }
        
        return acc;
      }, {} as Record<string, { spending: number; savings: number; year: number }>);

      // Convert to array and sort by date
      const sortedData = Object.entries(monthlyTotals)
        .map(([name, data]) => ({
          name,
          year: data.year,
          spending: data.spending,
          savings: data.savings
        }))
        .sort((a, b) => {
          const yearDiff = a.year - b.year;
          if (yearDiff !== 0) return yearDiff;
          // Create a map of month abbreviations to their numeric values
          const monthMap: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const monthA = monthMap[a.name] ?? 0;
          const monthB = monthMap[b.name] ?? 0;
          return monthA - monthB;
        });

      // Calculate trend lines
      const spendingData = sortedData.map((item, index) => ({ x: index, y: item.spending }));
      const savingsData = sortedData.map((item, index) => ({ x: index, y: item.savings }));

      const spendingTrend = calculateTrendLine(spendingData);
      const savingsTrend = calculateTrendLine(savingsData);

      // Add trend line values and forecast for next 3 months
      const dataWithTrends = [...sortedData];
      
      // Add forecast points
      for (let i = 0; i < 3; i++) {
        // Get the last month's index and calculate next month
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const reverseMonthMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const lastMonth = monthMap[sortedData[sortedData.length - 1].name];
        const nextMonthIndex = (lastMonth + i + 1) % 12;
        const forecastMonth = reverseMonthMap[nextMonthIndex];
        
        const x = sortedData.length + i;
        dataWithTrends.push({
          name: forecastMonth,
          year: sortedData[sortedData.length - 1].year +
            (lastMonth + i + 1 >= 12 ? Math.floor((lastMonth + i + 1) / 12) : 0),
          spending: 0,
          savings: 0,
          spendingTrend: spendingTrend.slope * x + spendingTrend.intercept,
          savingsTrend: savingsTrend.slope * x + savingsTrend.intercept
        } as SpendingTrendData);
      }

      // Add trend values to historical data
      dataWithTrends.forEach((item: SpendingTrendData, index) => {
        item.spendingTrend = spendingTrend.slope * index + spendingTrend.intercept;
        item.savingsTrend = savingsTrend.slope * index + savingsTrend.intercept;
      });

      setTrendData(dataWithTrends);
    }
  }, [transactions]);

  return (
    <Card className='bg-white shadow-lg rounded-lg overflow-hidden'>
      <CardHeader className='bg-gradient-to-r from-green-500 to-green-600 text-white p-6'>
        <CardTitle className='text-2xl font-bold'>Spending Trend & Forecast</CardTitle>
      </CardHeader>
      <CardContent className='p-6'>
        <div className='h-[400px] mt-4'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 10, left: 60, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' vertical={false} />
              <XAxis
                dataKey='name'
                stroke='#888888'
                fontSize={12}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
                tickFormatter={(value, index) => {
                  const item = trendData[index];
                  const prevItem = index > 0 ? trendData[index - 1] : null;
                  
                  // Show year if it's the first item or if the year changed
                  if (index === 0 || (prevItem && prevItem.year !== item?.year)) {
                    return `${value} ${item?.year || ''}`;
                  }
                  return value;
                }}
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
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label, items) => {
                  const item = items[0]?.payload;
                  return `${label} ${item?.year || ''}`;
                }}
              />
              <Legend />
              <Line
                type='monotone'
                dataKey='spending'
                name='Spending'
                stroke='#ef4444'
                strokeWidth={2}
                dot={{ r: 4, fill: '#ef4444' }}
                activeDot={{ r: 6, fill: '#ef4444' }}
              />
              <Line
                type='monotone'
                dataKey='savings'
                name='Savings'
                stroke='#16a34a'
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type='monotone'
                dataKey='spendingTrend'
                name='Spending Forecast'
                stroke='#ef4444'
                strokeDasharray='5 5'
                strokeWidth={2}
                dot={false}
              />
              <Line
                type='monotone'
                dataKey='savingsTrend'
                name='Savings Forecast'
                stroke='#16a34a'
                strokeDasharray='5 5'
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
