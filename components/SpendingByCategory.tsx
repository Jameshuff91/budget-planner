'use client';

import { useState, useEffect } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area';
import { useToast } from '@components/ui/use-toast'; // Added
import { useDBContext } from '@context/DatabaseContext'; // Added
import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';
import { ChartSkeleton } from './skeletons/ChartSkeleton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

interface SpendingByCategoryProps {
  selectedYear?: number;
}

export default function SpendingByCategory({ selectedYear }: SpendingByCategoryProps) {
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

  const { categorySpending, detailedCategorySpending, monthlyTrends } =
    useAnalytics(currentTimeRange);
  const { updateCategoryBudget, categories: allCategories, loading } = useDBContext(); // Added
  const { toast } = useToast(); // Added

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({}); // Changed to string
  const trends = monthlyTrends;

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
  }, [selectedYear]);

  const handleSetCurrentMonth = () => {
    const today = new Date();
    const year = selectedYear || today.getFullYear();
    const startDate = new Date(year, today.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, today.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    setCurrentTimeRange({ startDate, endDate });
  };

  const handleSetLast3Months = () => {
    const today = new Date();
    const year = selectedYear || today.getFullYear();
    const endDate = new Date(year, today.getMonth() + 1, 0); // End of current month
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(year, today.getMonth() - 2, 1); // Start of month 2 months ago
    startDate.setHours(0, 0, 0, 0);
    setCurrentTimeRange({ startDate, endDate });
  };

  const handleSetYearToDate = () => {
    const year = selectedYear || new Date().getFullYear();
    const startDate = new Date(year, 0, 1); // First day of selected year
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, 11, 31); // End of selected year
    endDate.setHours(23, 59, 59, 999);
    setCurrentTimeRange({ startDate, endDate });
  };

  const handleBudgetInputChange = (categoryName: string, value: string) => {
    setBudgetInputs((prev) => ({
      ...prev,
      [categoryName]: value,
    }));
  };

  const handleSaveBudget = async (categoryName: string) => {
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
  };

  const getDetailedSpending = (category: string) => {
    return detailedCategorySpending[category] || [];
  };

  const totalSpending = categorySpending.reduce((sum, item) => sum + item.value, 0);

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span className={`text-sm ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

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
            {categorySpending.length > 0 && categorySpending.some((cat) => cat.value > 0) ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={categorySpending.filter((cat) => cat.value > 0)}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey='value'
                    onClick={(data) => setSelectedCategory(data.name)}
                  >
                    {categorySpending
                      .filter((cat) => cat.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                  />
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
                  const trend = trends.categorySpending[category.name];
                  return (
                    <div
                      key={category.name}
                      className={`p-3 rounded border border-gray-100 mb-2 hover:bg-gray-50 transition-colors ${
                        selectedCategory === category.name ? 'bg-gray-100' : 'bg-white'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <div>
                          <p className='font-semibold text-gray-900'>{category.name}</p>
                          <p className='text-sm font-medium text-muted-foreground'>
                            {formatCurrency(category.value)} (
                            {totalSpending > 0
                              ? ((category.value / totalSpending) * 100).toFixed(1)
                              : '0.0'}
                            %)
                          </p>
                          {trend && <TrendIndicator value={trend.percentageChange} />}
                        </div>
                        <div className='space-y-1'>
                          <Label htmlFor={`budget-${category.name}`} className='font-medium'>
                            Budget
                          </Label>
                          <Input
                            id={`budget-${category.name}`}
                            type='number'
                            value={
                              budgetInputs[category.name] !== undefined
                                ? budgetInputs[category.name]
                                : (category.target || '').toString()
                            }
                            onChange={(e) => handleBudgetInputChange(category.name, e.target.value)}
                            onBlur={() => handleSaveBudget(category.name)}
                            className='w-[120px] font-medium'
                          />
                        </div>
                      </div>
                      {(() => {
                        // Calculate and render budget info
                        const spending = category.value;
                        const budget = category.target || 0;
                        let percentageConsumed = 0;
                        let percentageText = '0% of budget used';
                        let progressBarColor = 'bg-blue-600'; // Default color

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
                          percentageConsumed = 101; // To indicate over budget visually
                          progressBarColor = 'bg-red-500';
                        } else if (budget === 0 && spending === 0) {
                          percentageText = 'No spending, no budget';
                          percentageConsumed = 0;
                        }

                        return (
                          <div className='mt-2'>
                            <p className='text-xs text-gray-600 mb-1'>{percentageText}</p>
                            <div className='w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700'>
                              <div
                                className={`${progressBarColor} h-2.5 rounded-full`}
                                style={{ width: `${Math.min(Math.abs(percentageConsumed), 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })()}
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
                })}
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
