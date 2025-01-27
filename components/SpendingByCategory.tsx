'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';

import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area';
import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];

export default function SpendingByCategory() {
  const { categorySpending, detailedCategorySpending, monthlyTrends } = useAnalytics();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, number>>({});
  const trends = monthlyTrends;

  const handleBudgetChange = (category: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBudgetInputs((prev) => ({
      ...prev,
      [category]: numValue,
    }));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='h-[300px] p-4 bg-gray-50 rounded-lg border border-gray-100'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={categorySpending}
                  cx='50%'
                  cy='50%'
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey='value'
                  onClick={(data) => setSelectedCategory(data.name)}
                >
                  {categorySpending.map((entry, index) => (
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
                            {((category.value / totalSpending) * 100).toFixed(1)}%)
                          </p>
                          {trend && <TrendIndicator value={trend.percentageChange} />}
                        </div>
                        <div className='space-y-1'>
                          <Label htmlFor={`budget-${category.name}`} className='font-medium'>Budget</Label>
                          <Input
                            id={`budget-${category.name}`}
                            type='number'
                            value={budgetInputs[category.name] || ''}
                            onChange={(e) => handleBudgetChange(category.name, e.target.value)}
                            className='w-[120px] font-medium'
                          />
                        </div>
                      </div>
                      {selectedCategory === category.name && (
                        <div className='mt-2 space-y-1'>
                          {getDetailedSpending(category.name).map((item, index) => (
                            <div key={index} className='text-sm flex justify-between'>
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
