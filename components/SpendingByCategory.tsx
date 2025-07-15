'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area';
import { useToast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';
import { ChartSkeleton } from './skeletons/ChartSkeleton';
import {
  shallowCompareProps,
  getOptimizedAnimationProps,
  getOptimizedColor,
  memoizeChartProps,
} from '@utils/chartOptimization';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

interface SpendingByCategoryProps {
  selectedYear?: number;
}

// Memoized components for performance
const MemoizedTrendIndicator = React.memo<{ value: number }>(({ value }) => {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span className={`text-sm ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  );
});
MemoizedTrendIndicator.displayName = 'MemoizedTrendIndicator';

const MemoizedCategoryDetail = React.memo<{
  category: any;
  totalSpending: number;
  trend: any;
  budgetInput: string;
  selectedCategory: string | null;
  onBudgetChange: (categoryName: string, value: string) => void;
  onBudgetSave: (categoryName: string) => void;
  onCategoryClick: (categoryName: string) => void;
  getDetailedSpending: (categoryName: string) => any[];
}>(
  ({
    category,
    totalSpending,
    trend,
    budgetInput,
    selectedCategory,
    onBudgetChange,
    onBudgetSave,
    onCategoryClick,
    getDetailedSpending,
  }) => {
    const handleClick = useCallback(() => {
      onCategoryClick(category.name);
    }, [category.name, onCategoryClick]);

    const handleBudgetChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onBudgetChange(category.name, e.target.value);
      },
      [category.name, onBudgetChange],
    );

    const handleBudgetBlur = useCallback(() => {
      onBudgetSave(category.name);
    }, [category.name, onBudgetSave]);

    // Memoize budget calculation
    const budgetInfo = useMemo(() => {
      const spending = category.value;
      const budget = category.target || 0;
      let percentageConsumed = 0;
      let percentageText = '0% of budget used';
      let progressBarColor = 'bg-blue-600';

      if (budget > 0) {
        percentageConsumed = (spending / budget) * 100;
        percentageText = `${Math.abs(percentageConsumed).toFixed(1)}% of budget used`;
        if (percentageConsumed > 100) {
          progressBarColor = 'bg-red-500';
        } else if (percentageConsumed > 75) {
          progressBarColor = 'bg-yellow-500';
        }
      } else if (spending > 0) {
        percentageText = 'Over budget (no budget set)';
        percentageConsumed = 101;
        progressBarColor = 'bg-red-500';
      } else if (budget === 0 && spending === 0) {
        percentageText = 'No spending, no budget';
        percentageConsumed = 0;
      }

      return { percentageConsumed, percentageText, progressBarColor };
    }, [category.value, category.target]);

    return (
      <div
        className={`p-3 rounded border border-gray-100 mb-2 hover:bg-gray-50 transition-colors cursor-pointer ${
          selectedCategory === category.name ? 'bg-gray-100' : 'bg-white'
        }`}
        onClick={handleClick}
      >
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-semibold text-gray-900'>{category.name}</p>
            <p className='text-sm font-medium text-muted-foreground'>
              {formatCurrency(category.value)} (
              {totalSpending > 0 ? ((category.value / totalSpending) * 100).toFixed(1) : '0.0'}
              %)
            </p>
            {trend && <MemoizedTrendIndicator value={trend.percentageChange} />}
          </div>
          <div className='space-y-1' onClick={(e) => e.stopPropagation()}>
            <Label htmlFor={`budget-${category.name}`} className='font-medium'>
              Budget
            </Label>
            <Input
              id={`budget-${category.name}`}
              type='number'
              value={budgetInput}
              onChange={handleBudgetChange}
              onBlur={handleBudgetBlur}
              className='w-[120px] font-medium'
            />
          </div>
        </div>
        <div className='mt-2'>
          <p className='text-xs text-gray-600 mb-1'>{budgetInfo.percentageText}</p>
          <div className='w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700'>
            <div
              className={`${budgetInfo.progressBarColor} h-2.5 rounded-full`}
              style={{ width: `${Math.min(Math.abs(budgetInfo.percentageConsumed), 100)}%` }}
            />
          </div>
        </div>
        {selectedCategory === category.name && (
          <div className='mt-3 pt-2 border-t border-gray-200 space-y-1'>
            <h4 className='text-sm font-semibold'>Details:</h4>
            {getDetailedSpending(category.name).map((item, index) => (
              <div key={index} className='text-xs flex justify-between text-gray-700'>
                <span>{item.name}</span>
                <span>{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.category.name === nextProps.category.name &&
      prevProps.category.value === nextProps.category.value &&
      prevProps.category.target === nextProps.category.target &&
      prevProps.totalSpending === nextProps.totalSpending &&
      prevProps.budgetInput === nextProps.budgetInput &&
      prevProps.selectedCategory === nextProps.selectedCategory &&
      JSON.stringify(prevProps.trend) === JSON.stringify(nextProps.trend)
    );
  },
);
MemoizedCategoryDetail.displayName = 'MemoizedCategoryDetail';

const SpendingByCategory = ({ selectedYear }: SpendingByCategoryProps) => {
  const [currentTimeRange, setCurrentTimeRange] = useState<{ startDate: Date; endDate: Date }>(
    () => {
      const today = new Date();
      const year = selectedYear || today.getFullYear();
      const currentYear = today.getFullYear();

      if (selectedYear && selectedYear !== currentYear) {
        // For historical years, default to full year
        const startDate = new Date(year, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
      } else {
        // For current year, default to current month
        const startDate = new Date(year, today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
      }
    },
  );

  // Call useAnalytics with stable timeRange
  const analyticsData = useAnalytics(currentTimeRange);

  const { categorySpending, detailedCategorySpending, monthlyTrends } = analyticsData;
  const { updateCategoryBudget, categories: allCategories, loading } = useDBContext();
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  // Memoize filtered chart data
  const chartData = useMemo(() => {
    const filtered = categorySpending.filter((cat) => cat.value > 0);
    return filtered;
  }, [categorySpending]);

  // Memoize total spending calculation
  const totalSpending = useMemo(() => {
    return categorySpending.reduce((sum, item) => sum + item.value, 0);
  }, [categorySpending]);

  // Memoize animation props
  const animationProps = useMemo(() => {
    return getOptimizedAnimationProps(chartData.length);
  }, [chartData.length]);

  // Define functions before using them in effects
  const handleSetCurrentMonth = useCallback(() => {
    const today = new Date();
    const year = selectedYear || today.getFullYear();
    const startDate = new Date(year, today.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, today.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    setCurrentTimeRange({ startDate, endDate });
  }, [selectedYear]);

  const handleSetLast3Months = useCallback(() => {
    const today = new Date();
    const year = selectedYear || today.getFullYear();
    const endDate = new Date(year, today.getMonth() + 1, 0); // End of current month
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(year, today.getMonth() - 2, 1); // Start of month 2 months ago
    startDate.setHours(0, 0, 0, 0);
    setCurrentTimeRange({ startDate, endDate });
  }, [selectedYear]);

  const handleSetYearToDate = useCallback(() => {
    const year = selectedYear || new Date().getFullYear();
    const startDate = new Date(year, 0, 1); // First day of selected year
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, 11, 31); // End of selected year
    endDate.setHours(23, 59, 59, 999);
    setCurrentTimeRange({ startDate, endDate });
  }, [selectedYear]);

  // Now add the useEffects after all function definitions
  useEffect(() => {
    const initialBudgets: Record<string, string> = {};
    categorySpending.forEach((cat) => {
      initialBudgets[cat.name] = (cat.target || '').toString();
    });
    setBudgetInputs(initialBudgets);
  }, [categorySpending]);

  // Update time range when selectedYear changes
  useEffect(() => {
    if (selectedYear) {
      const currentYear = new Date().getFullYear();
      if (selectedYear === currentYear) {
        handleSetCurrentMonth(); // For current year, show current month
      } else {
        handleSetYearToDate(); // For historical years, show full year
      }
    }
  }, [selectedYear, handleSetCurrentMonth, handleSetYearToDate]);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleBudgetInputChange = useCallback((categoryName: string, value: string) => {
    setBudgetInputs((prev) => ({
      ...prev,
      [categoryName]: value,
    }));
  }, []);

  const handleSaveBudget = useCallback(
    async (categoryName: string) => {
      const budgetValueStr = budgetInputs[categoryName];
      if (budgetValueStr === undefined) return; // Should not happen if input is used

      let numValue: number;
      if (budgetValueStr.trim() === '') {
        numValue = 0; // Treat empty string as 0 budget
      } else {
        numValue = parseFloat(budgetValueStr);
        if (isNaN(numValue)) {
          toast({
            title: 'Invalid Input',
            description: 'Budget value must be a number.',
            variant: 'destructive',
          });
          // Optionally revert input to original value
          const originalCategory = categorySpending.find((cat) => cat.name === categoryName);
          setBudgetInputs((prev) => ({
            ...prev,
            [categoryName]: (originalCategory?.target || '').toString(),
          }));
          return;
        }
      }

      if (numValue < 0) {
        toast({
          title: 'Invalid Input',
          description: 'Budget value cannot be negative.',
          variant: 'destructive',
        });
        const originalCategory = categorySpending.find((cat) => cat.name === categoryName);
        setBudgetInputs((prev) => ({
          ...prev,
          [categoryName]: (originalCategory?.target || '').toString(),
        }));
        return;
      }

      const categoryToUpdate = allCategories.find((cat) => cat.name === categoryName);
      if (!categoryToUpdate) {
        toast({
          title: 'Error',
          description: `Category ${categoryName} not found.`,
          variant: 'destructive',
        });
        return;
      }
      const categoryId = categoryToUpdate.id;

      try {
        await updateCategoryBudget(categoryId, numValue);
        toast({
          title: 'Budget Updated',
          description: `Budget for ${categoryName} set to ${formatCurrency(numValue)}.`,
        });
        // Data will refresh via context, which updates categorySpending, then useEffect updates budgetInputs.
      } catch (error: any) {
        toast({
          title: 'Error Updating Budget',
          description: error.message || 'Could not update budget.',
          variant: 'destructive',
        });
      }
    },
    [budgetInputs, allCategories, updateCategoryBudget, toast, categorySpending],
  );

  const getDetailedSpending = useCallback(
    (category: string) => {
      return detailedCategorySpending[category] || [];
    },
    [detailedCategorySpending],
  );

  const handleCategoryClick = useCallback((categoryName: string) => {
    setSelectedCategory((prev) => (prev === categoryName ? null : categoryName));
  }, []);

  const handlePieClick = useCallback(
    (data: any) => {
      handleCategoryClick(data.name);
    },
    [handleCategoryClick],
  );

  // Memoized tooltip and chart props
  const tooltipProps = useMemo(
    () =>
      memoizeChartProps(
        {
          formatter: (value: number) => formatCurrency(value),
          labelStyle: { color: '#000' },
          contentStyle: {
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
          },
        },
        [],
      ),
    [],
  );

  const pieChartProps = useMemo(
    () =>
      memoizeChartProps(
        {
          cx: '50%',
          cy: '50%',
          innerRadius: 60,
          outerRadius: 80,
          paddingAngle: 5,
          dataKey: 'value',
          onClick: handlePieClick,
          ...animationProps,
        },
        [handlePieClick, animationProps],
      ),
    [handlePieClick, animationProps],
  );

  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center'>
          <CardTitle>Spending by Category</CardTitle>
          <div className='mt-2 sm:mt-0 space-x-2'>
            <Button variant='outline' size='sm' onClick={handleSetCurrentMonth}>
              Current Month
            </Button>
            <Button variant='outline' size='sm' onClick={handleSetLast3Months}>
              Last 3 Months
            </Button>
            <Button variant='outline' size='sm' onClick={handleSetYearToDate}>
              Year to Date
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='h-[300px] p-4 bg-gray-50 rounded-lg border border-gray-100'>
            {chartData.length > 0 ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={chartData} {...pieChartProps}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={getOptimizedColor(entry.name, COLORS)}
                      />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipProps} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex items-center justify-center h-full text-gray-500'>
                <div className='text-center'>
                  <p className='text-lg font-medium'>No spending data</p>
                  <p className='text-sm'>No expenses found for the selected time period</p>
                </div>
              </div>
            )}
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <h3 className='text-lg font-semibold'>Category Details</h3>
              <ScrollArea className='h-[250px] pr-4'>
                {categorySpending.map((category) => {
                  const trend = monthlyTrends.categorySpending[category.name];
                  const budgetInput =
                    budgetInputs[category.name] !== undefined
                      ? budgetInputs[category.name]
                      : (category.target || '').toString();

                  return (
                    <MemoizedCategoryDetail
                      key={category.name}
                      category={category}
                      totalSpending={totalSpending}
                      trend={trend}
                      budgetInput={budgetInput}
                      selectedCategory={selectedCategory}
                      onBudgetChange={handleBudgetInputChange}
                      onBudgetSave={handleSaveBudget}
                      onCategoryClick={handleCategoryClick}
                      getDetailedSpending={getDetailedSpending}
                    />
                  );
                })}
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Export with React.memo for performance optimization
export default React.memo(SpendingByCategory, (prevProps, nextProps) => {
  return shallowCompareProps(prevProps, nextProps);
});
