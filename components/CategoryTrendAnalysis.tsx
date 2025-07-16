'use client';

import React, { useState, useMemo, useCallback } from 'react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Checkbox } from '@components/ui/checkbox';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area';
import { Button } from '@components/ui/button';
import { useDBContext } from '@context/DatabaseContext';
import { formatCurrency } from '@utils/helpers';
import { ChartSkeleton } from './skeletons/ChartSkeleton';
import {
  shallowCompareProps,
  getOptimizedAnimationProps,
  memoizeChartProps,
  createPerformanceMarker,
} from '@utils/chartOptimization';

// Define color palette for categories
const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#3b82f6',
  Transportation: '#10b981',
  Food: '#f59e0b',
  Utilities: '#8b5cf6',
  Entertainment: '#ef4444',
  Healthcare: '#06b6d4',
  Shopping: '#ec4899',
  Education: '#84cc16',
  Other: '#6b7280',
};

interface CategoryTrendData {
  month: string;
  [category: string]: string | number; // month is string, category values are numbers
}

interface CategoryTrendAnalysisProps {
  selectedYear?: number;
}

const CategoryTrendAnalysis = ({ selectedYear }: CategoryTrendAnalysisProps) => {
  const { transactions, categories, loading } = useDBContext();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Calculate the date range for analysis
  const dateRange = useMemo(() => {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // For selected year, show all months of that year
    if (selectedYear && selectedYear !== today.getFullYear()) {
      const startDate = new Date(selectedYear, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      const yearEndDate = new Date(selectedYear, 11, 31);
      yearEndDate.setHours(23, 59, 59, 999);
      return { startDate, endDate: yearEndDate };
    }
    
    // Otherwise show last 12 months
    const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
  }, [selectedYear]);

  // Process transaction data to get monthly category spending
  const categoryTrendData = useMemo(() => {
    const marker = createPerformanceMarker('category-trend-calculation');
    
    try {
      const monthlyData = new Map<string, Map<string, number>>();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Initialize months in range
      const currentDate = new Date(dateRange.startDate);
      while (currentDate <= dateRange.endDate) {
        const monthKey = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        monthlyData.set(monthKey, new Map<string, number>());
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      // Process transactions
      transactions.forEach((transaction) => {
        if (transaction.type === 'expense') {
          const transactionDate = new Date(transaction.date);
          if (transactionDate >= dateRange.startDate && transactionDate <= dateRange.endDate) {
            const monthKey = `${months[transactionDate.getMonth()]} ${transactionDate.getFullYear()}`;
            const monthData = monthlyData.get(monthKey);
            
            if (monthData) {
              const currentAmount = monthData.get(transaction.category) || 0;
              monthData.set(transaction.category, currentAmount + Math.abs(transaction.amount));
            }
          }
        }
      });
      
      // Convert to array format for chart
      const chartData: CategoryTrendData[] = [];
      monthlyData.forEach((categoryMap, month) => {
        const dataPoint: CategoryTrendData = { month };
        categoryMap.forEach((amount, category) => {
          dataPoint[category] = amount;
        });
        chartData.push(dataPoint);
      });
      
      marker.end();
      return chartData;
    } catch (error) {
      console.error('Error calculating category trends:', error);
      return [];
    }
  }, [transactions, dateRange]);

  // Get unique categories with spending
  const availableCategories = useMemo(() => {
    const categoriesWithSpending = new Set<string>();
    categoryTrendData.forEach((monthData) => {
      Object.keys(monthData).forEach((key) => {
        if (key !== 'month' && monthData[key] > 0) {
          categoriesWithSpending.add(key);
        }
      });
    });
    return Array.from(categoriesWithSpending).sort();
  }, [categoryTrendData]);

  // Initialize selected categories on first load
  useMemo(() => {
    if (selectedCategories.length === 0 && availableCategories.length > 0) {
      // Select top 3 categories by total spending
      const categoryTotals = availableCategories.map((category) => {
        const total = categoryTrendData.reduce((sum, month) => {
          return sum + (typeof month[category] === 'number' ? month[category] : 0);
        }, 0);
        return { category, total };
      });
      
      categoryTotals.sort((a, b) => b.total - a.total);
      const top3 = categoryTotals.slice(0, 3).map((item) => item.category);
      setSelectedCategories(top3);
    }
  }, [availableCategories, categoryTrendData, selectedCategories.length]);

  // Handle category selection
  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      } else {
        return [...prev, category];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (showAllCategories) {
      setSelectedCategories([]);
      setShowAllCategories(false);
    } else {
      setSelectedCategories(availableCategories);
      setShowAllCategories(true);
    }
  }, [availableCategories, showAllCategories]);

  const handleSelectTop5 = useCallback(() => {
    const categoryTotals = availableCategories.map((category) => {
      const total = categoryTrendData.reduce((sum, month) => {
        return sum + (typeof month[category] === 'number' ? month[category] : 0);
      }, 0);
      return { category, total };
    });
    
    categoryTotals.sort((a, b) => b.total - a.total);
    const top5 = categoryTotals.slice(0, 5).map((item) => item.category);
    setSelectedCategories(top5);
    setShowAllCategories(false);
  }, [availableCategories, categoryTrendData]);

  // Memoize chart props
  const animationProps = useMemo(() => {
    return getOptimizedAnimationProps(categoryTrendData.length);
  }, [categoryTrendData.length]);

  const tooltipFormatter = useCallback((value: number) => formatCurrency(value), []);
  const tickFormatter = useCallback((value: number) => formatCurrency(value), []);

  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Spending Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Category Selection */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Select Categories</h3>
                <div className="space-x-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectTop5}
                  >
                    Top 5
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {showAllCategories ? 'Clear All' : 'Select All'}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {availableCategories.map((category) => {
                    const isSelected = selectedCategories.includes(category);
                    const categoryTotal = categoryTrendData.reduce((sum, month) => {
                      return sum + (typeof month[category] === 'number' ? month[category] : 0);
                    }, 0);
                    
                    return (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={isSelected}
                          onCheckedChange={() => handleCategoryToggle(category)}
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="flex-1 cursor-pointer flex justify-between items-center"
                        >
                          <span style={{ color: isSelected ? CATEGORY_COLORS[category] || '#6b7280' : undefined }}>
                            {category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(categoryTotal)}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-3">
            <div className="h-[400px]">
              {selectedCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={categoryTrendData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={tickFormatter}
                      fontSize={12}
                    />
                    <Tooltip formatter={tooltipFormatter} />
                    <Legend />
                    {selectedCategories.map((category) => (
                      <Line
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stroke={CATEGORY_COLORS[category] || '#6b7280'}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        {...animationProps}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-lg font-medium">No categories selected</p>
                    <p className="text-sm">Select categories to view their spending trends</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Export with React.memo for performance optimization
export default React.memo(CategoryTrendAnalysis, (prevProps, nextProps) => {
  return shallowCompareProps(prevProps, nextProps);
});