'use client';

import React, { useMemo } from 'react';
import { Gauge, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { useDBContext } from '@context/DatabaseContext';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { formatCurrency } from '@utils/helpers';

interface SpendingVelocityProps {
  selectedYear: number;
}

export default function SpendingVelocity({ selectedYear }: SpendingVelocityProps) {
  const { transactions } = useDBContext();

  const velocityData = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();

    // Get data for current month and previous months
    const monthlyData = [];

    for (let i = 0; i < 12; i++) {
      const month = new Date(selectedYear, i, 1);
      const monthEnd = new Date(selectedYear, i + 1, 0);

      const monthTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return (
          tDate.getFullYear() === selectedYear && tDate.getMonth() === i && t.type === 'expense'
        );
      });

      // Calculate daily spending for each day of the month
      const dailySpending: number[] = [];
      const daysInMonth = monthEnd.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const daySpending = monthTransactions
          .filter((t: any) => new Date(t.date).getDate() === day)
          .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        dailySpending.push(daySpending);
      }

      // Calculate cumulative spending
      let cumulative = 0;
      const cumulativeSpending = dailySpending.map((daily) => {
        cumulative += daily;
        return cumulative;
      });

      const totalSpending = cumulative;
      const avgDailySpending = totalSpending / daysInMonth;

      // For current month, calculate velocity based on days passed
      const daysElapsed = i === currentMonth ? currentDay : daysInMonth;
      const currentSpending =
        i === currentMonth ? cumulativeSpending[currentDay - 1] || 0 : totalSpending;

      const projectedTotal =
        i === currentMonth ? (currentSpending / daysElapsed) * daysInMonth : totalSpending;

      const velocity =
        i === currentMonth && daysElapsed > 0 ? currentSpending / daysElapsed : avgDailySpending;

      monthlyData.push({
        month: month.toLocaleDateString('default', { month: 'short' }),
        monthIndex: i,
        totalSpending,
        currentSpending,
        projectedTotal,
        avgDailySpending,
        velocity,
        daysElapsed,
        daysInMonth,
        dailySpending,
        cumulativeSpending,
      });
    }

    return monthlyData;
  }, [transactions, selectedYear]);

  const currentMonthData =
    velocityData.find((d) => d.monthIndex === new Date().getMonth()) || velocityData[0];

  const velocityTrend = useMemo(() => {
    if (!currentMonthData || currentMonthData.daysElapsed < 7) return 'insufficient';

    const currentVelocity = currentMonthData.velocity;
    const lastMonthData = velocityData[currentMonthData.monthIndex - 1];

    if (!lastMonthData) return 'stable';

    const velocityChange =
      ((currentVelocity - lastMonthData.avgDailySpending) / lastMonthData.avgDailySpending) * 100;

    if (velocityChange > 10) return 'increasing';
    if (velocityChange < -10) return 'decreasing';
    return 'stable';
  }, [velocityData, currentMonthData]);

  const dailyChartData = useMemo(() => {
    if (!currentMonthData) return [];

    return currentMonthData.cumulativeSpending.map((spending, index) => ({
      day: index + 1,
      actual: spending,
      projected: currentMonthData.velocity * (index + 1),
    }));
  }, [currentMonthData]);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: any;
    label?: any;
  }) => {
    if (!active || !payload) return null;

    return (
      <div className='bg-white p-3 border rounded-lg shadow-lg'>
        <p className='font-semibold'>Day {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const getVelocityColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  const getVelocityIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className='h-5 w-5 text-red-500' />;
      case 'decreasing':
        return <TrendingDown className='h-5 w-5 text-green-500' />;
      case 'insufficient':
        return <AlertTriangle className='h-5 w-5 text-yellow-500' />;
      default:
        return <Activity className='h-5 w-5 text-blue-500' />;
    }
  };

  return (
    <div className='space-y-4'>
      {/* Velocity Overview Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-medium flex items-center gap-2'>
              <Gauge className='h-4 w-4' />
              Current Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-1'>
              <p className={`text-2xl font-bold ${getVelocityColor(velocityTrend)}`}>
                {formatCurrency(currentMonthData?.velocity || 0)}/day
              </p>
              <div className='flex items-center gap-2'>
                {getVelocityIcon(velocityTrend)}
                <span className='text-sm text-muted-foreground'>
                  {velocityTrend === 'increasing'
                    ? 'Spending faster'
                    : velocityTrend === 'decreasing'
                      ? 'Spending slower'
                      : velocityTrend === 'insufficient'
                        ? 'Not enough data'
                        : 'Stable spending'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-medium'>Month Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-1'>
              <p className='text-2xl font-bold'>
                {formatCurrency(currentMonthData?.projectedTotal || 0)}
              </p>
              <p className='text-sm text-muted-foreground'>
                Based on {currentMonthData?.daysElapsed || 0} days
              </p>
              {currentMonthData &&
                currentMonthData.projectedTotal > currentMonthData.totalSpending * 1.1 && (
                  <div className='flex items-center gap-1 text-xs text-orange-600'>
                    <AlertTriangle className='h-3 w-3' />
                    <span>Projected to exceed last month</span>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base font-medium'>Days Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-1'>
              <p className='text-2xl font-bold'>
                {currentMonthData ? currentMonthData.daysInMonth - currentMonthData.daysElapsed : 0}
              </p>
              <p className='text-sm text-muted-foreground'>
                Budget remaining:{' '}
                {formatCurrency(
                  Math.max(
                    0,
                    (currentMonthData?.totalSpending || 0) -
                      (currentMonthData?.currentSpending || 0),
                  ),
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Spending Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Progress</CardTitle>
          <CardDescription>
            Actual vs projected spending for {currentMonthData?.month}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width='100%' height={300}>
            <AreaChart data={dailyChartData}>
              <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
              <XAxis dataKey='day' tick={{ fontSize: 12 }} tickLine={{ stroke: '#e0e0e0' }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e0e0e0' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type='monotone'
                dataKey='projected'
                stroke='#94a3b8'
                fill='#e2e8f0'
                strokeWidth={2}
                name='Projected'
              />
              <Area
                type='monotone'
                dataKey='actual'
                stroke='#3b82f6'
                fill='#93c5fd'
                strokeWidth={2}
                name='Actual'
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Velocity Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Velocity Trends</CardTitle>
          <CardDescription>Average daily spending by month for {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {velocityData.slice(0, new Date().getMonth() + 1).map((month) => {
              const isCurrentMonth = month.monthIndex === new Date().getMonth();
              return (
                <div
                  key={month.monthIndex}
                  className='flex items-center justify-between py-2 border-b last:border-0'
                >
                  <div className='flex items-center gap-3'>
                    <span className={`font-medium ${isCurrentMonth ? 'text-blue-600' : ''}`}>
                      {month.month}
                    </span>
                    {isCurrentMonth && (
                      <span className='text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded'>
                        Current
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='text-right'>
                      <p className='font-semibold'>{formatCurrency(month.velocity)}/day</p>
                      <p className='text-xs text-muted-foreground'>
                        Total: {formatCurrency(month.totalSpending)}
                      </p>
                    </div>
                    <div className='w-24'>
                      <div className='bg-gray-200 rounded-full h-2'>
                        <div
                          className='bg-blue-500 h-2 rounded-full transition-all'
                          style={{
                            width: `${Math.min(100, (month.velocity / Math.max(...velocityData.map((v) => v.velocity))) * 100)}%`,
                          }}
                        />
                      </div>
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
