'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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

import { useDBContext } from '@context/DatabaseContext';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAnalytics } from '../src/hooks/useAnalytics';
import {
  shallowCompareProps,
  getOptimizedAnimationProps,
  createPerformanceMarker,
  optimizeChartData,
} from '../src/utils/chartOptimization';
import { formatCurrency } from '../src/utils/helpers';

import { ChartSkeleton } from './skeletons/ChartSkeleton';

type SpendingTrendData = {
  name: string; // Month name e.g., "Jan"
  year: number;
  Spending: number; // Changed from spending
  Income: number; // Changed from savings
  spendingTrend?: number;
  incomeTrend?: number; // Changed from savingsTrend
};

// Helper function to calculate linear regression
const calculateTrendLine = (
  data: { x: number; y: number }[],
): { slope: number; intercept: number } => {
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

// Month abbreviations
const monthsAbbrev = [
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

interface SpendingTrendProps {
  selectedYear?: number;
}

const SpendingTrend = ({ selectedYear }: SpendingTrendProps) => {
  const [trendData, setTrendData] = useState<SpendingTrendData[]>([]);

  // Get analytics data
  const { spendingOverview } = useAnalytics();
  const { loading } = useDBContext();

  // Memoize the trend data calculation for performance
  const processedTrendData = useMemo(() => {
    if (!spendingOverview || spendingOverview.length === 0) {
      return [];
    }

    const marker = createPerformanceMarker('trend-data-processing');

    // Filter data for selected year if provided
    const filteredData = selectedYear
      ? spendingOverview.filter((item) => item.year === selectedYear)
      : spendingOverview;

    // Transform spendingOverview data for the chart
    const chartData: SpendingTrendData[] = filteredData.map((item) => ({
      name: item.month,
      year: item.year,
      Spending: item.totalSpending,
      Income: item.totalIncome,
    }));

    // Calculate trend lines
    const spendingPoints = chartData.map((item, index) => ({ x: index, y: item.Spending }));
    const incomePoints = chartData.map((item, index) => ({ x: index, y: item.Income }));

    const spendingTrendLine = calculateTrendLine(spendingPoints);
    const incomeTrendLine = calculateTrendLine(incomePoints);

    // Add trend line values and forecast for next 3 months
    const dataWithTrends = [...chartData];

    // Add forecast points
    if (chartData.length > 0) {
      for (let i = 0; i < 3; i++) {
        const lastItem = chartData[chartData.length - 1];
        const lastMonthIndex = new Date(
          lastItem.year,
          monthsAbbrev.indexOf(lastItem.name),
        ).getMonth();

        const nextForecastMonthDate = new Date(lastItem.year, lastMonthIndex + i + 1, 1);
        const forecastMonthName = monthsAbbrev[nextForecastMonthDate.getMonth()];
        const forecastYear = nextForecastMonthDate.getFullYear();

        const x = chartData.length + i;
        dataWithTrends.push({
          name: forecastMonthName,
          year: forecastYear,
          Spending: 0,
          Income: 0,
          spendingTrend: spendingTrendLine.slope * x + spendingTrendLine.intercept,
          incomeTrend: incomeTrendLine.slope * x + incomeTrendLine.intercept,
        });
      }
    }

    // Add trend values to historical data
    dataWithTrends.forEach((item, index) => {
      if (index < chartData.length) {
        item.spendingTrend = spendingTrendLine.slope * index + spendingTrendLine.intercept;
        item.incomeTrend = incomeTrendLine.slope * index + incomeTrendLine.intercept;
      }
    });

    marker.end();
    return optimizeChartData(dataWithTrends, 100); // Limit data points for performance
  }, [spendingOverview, selectedYear]);

  useEffect(() => {
    setTrendData(processedTrendData);
  }, [processedTrendData]);

  // Memoize chart animation props
  const animationProps = useMemo(() => {
    return getOptimizedAnimationProps(trendData.length);
  }, [trendData.length]);

  // Memoized chart props and formatters
  const tooltipFormatter = useCallback((value: number) => formatCurrency(value), []);
  const labelFormatter = useCallback(
    (label: string, items: Array<{ payload?: SpendingTrendData }>) => {
      const item = items[0]?.payload;
      return `${label} ${item?.year || ''}`;
    },
    [],
  );

  const tickFormatter = useCallback((value: number) => `${formatCurrency(value)}`, []);
  const xAxisTickFormatter = useCallback(
    (value: string, index: number) => {
      const item = trendData[index];
      const prevItem = index > 0 ? trendData[index - 1] : null;

      // Show year if it's the first item or if the year changed
      if (index === 0 || (prevItem && prevItem.year !== item?.year)) {
        return `${value} ${item?.year || ''}`;
      }
      return value;
    },
    [trendData],
  );

  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <Card className='bg-white shadow-lg rounded-lg overflow-hidden'>
      <CardHeader className='bg-gradient-to-r from-green-500 to-green-600 text-white p-6'>
        <CardTitle className='text-2xl font-bold'>Spending Trend & Forecast</CardTitle>
      </CardHeader>
      <CardContent className='p-6'>
        <div className='h-[400px] mt-4'>
          {trendData.length > 0 ? (
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: 60, bottom: 30 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' vertical={false} />
                <XAxis
                  dataKey='name'
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor='end'
                  height={60}
                  tickFormatter={xAxisTickFormatter}
                />
                <YAxis
                  stroke='#888888'
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={tickFormatter}
                  width={60}
                />
                <Tooltip formatter={tooltipFormatter} labelFormatter={labelFormatter} />
                <Legend />
                <Line
                  type='monotone'
                  dataKey='Spending'
                  name='Spending'
                  stroke='#ef4444'
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 6, fill: '#ef4444' }}
                  {...animationProps}
                />
                <Line
                  type='monotone'
                  dataKey='Income'
                  name='Income'
                  stroke='#16a34a'
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  {...animationProps}
                />
                <Line
                  type='monotone'
                  dataKey='spendingTrend'
                  name='Spending Forecast'
                  stroke='#ef4444'
                  strokeDasharray='5 5'
                  strokeWidth={2}
                  dot={false}
                  {...animationProps}
                />
                <Line
                  type='monotone'
                  dataKey='incomeTrend'
                  name='Income Forecast'
                  stroke='#16a34a'
                  strokeDasharray='5 5'
                  strokeWidth={2}
                  dot={false}
                  {...animationProps}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className='flex items-center justify-center h-full bg-gray-50 rounded-lg'>
              <div className='text-center p-6'>
                <p className='text-lg font-medium text-gray-700 mb-2'>No trend data available</p>
                <p className='text-sm text-gray-500 mb-4'>
                  Upload bank statements to see spending trends and forecasts
                </p>
                <div className='space-y-2 text-xs text-gray-400'>
                  <p>• Trends require at least 2 months of data</p>
                  <p>• Forecasts are calculated using linear regression</p>
                  <p>• Check the Diagnostics tab if charts aren&apos;t displaying</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Export with React.memo for performance optimization
export default React.memo(SpendingTrend, (prevProps, nextProps) => {
  return shallowCompareProps(prevProps, nextProps);
});
