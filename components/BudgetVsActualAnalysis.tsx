'use client';

import { Card } from '@components/ui/card';
import { Progress } from '@components/ui/progress';
import { useDBContext } from '@context/DatabaseContext';
import { calculateBudgetVariance, BudgetVariance } from '@utils/budgetAnalysis';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface BudgetVsActualAnalysisProps {
  startDate: Date;
  endDate: Date;
}

export default function BudgetVsActualAnalysis({ startDate, endDate }: BudgetVsActualAnalysisProps) {
  const { transactions, categories } = useDBContext();
  const [variances, setVariances] = useState<BudgetVariance[]>([]);

  useEffect(() => {
    if (transactions.length > 0 && categories.length > 0) {
      const calculatedVariances = calculateBudgetVariance(
        transactions,
        categories,
        startDate,
        endDate
      );
      setVariances(calculatedVariances);
    }
  }, [transactions, categories, startDate, endDate]);

  if (variances.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Budget vs Actual</h3>
        <p className="text-muted-foreground">
          Set budgets for your expense categories to see budget vs actual analysis.
        </p>
      </Card>
    );
  }

  const chartData = variances.map((v) => ({
    category: v.categoryName,
    budget: v.budget,
    actual: v.actual,
    variance: Math.abs(v.variance),
  }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Budget vs Actual Comparison</h3>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="budget" fill="#3b82f6" name="Budget" />
            <Bar dataKey="actual" fill="#8b5cf6" name="Actual">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={variances[index].isOverBudget ? '#ef4444' : '#10b981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
        <div className="space-y-6">
          {variances.map((variance) => {
            const percentUsed = (variance.actual / variance.budget) * 100;
            const isWarning = percentUsed >= 80 && percentUsed < 100;
            const isDanger = percentUsed >= 100;

            return (
              <div key={variance.categoryId} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{variance.categoryName}</span>
                  <span className={`text-sm ${isDanger ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
                    ${variance.actual.toFixed(2)} / ${variance.budget.toFixed(2)}
                  </span>
                </div>

                <Progress
                  value={Math.min(percentUsed, 100)}
                  className={`h-2 ${isDanger ? 'bg-red-100' : isWarning ? 'bg-yellow-100' : 'bg-green-100'}`}
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{percentUsed.toFixed(1)}% used</span>
                  {variance.isOverBudget ? (
                    <span className="text-red-600 font-semibold">
                      Over by ${Math.abs(variance.variance).toFixed(2)} ({Math.abs(variance.variancePercentage).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-green-600">
                      ${variance.variance.toFixed(2)} remaining
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Budget</div>
            <div className="text-2xl font-bold">
              ${variances.reduce((sum, v) => sum + v.budget, 0).toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Spent</div>
            <div className="text-2xl font-bold">
              ${variances.reduce((sum, v) => sum + v.actual, 0).toFixed(2)}
            </div>
          </div>

          <div className={`p-4 rounded-lg ${
            variances.some(v => v.isOverBudget) ? 'bg-red-50' : 'bg-green-50'
          }`}>
            <div className="text-sm text-muted-foreground">Variance</div>
            <div className={`text-2xl font-bold ${
              variances.some(v => v.isOverBudget) ? 'text-red-600' : 'text-green-600'
            }`}>
              ${variances.reduce((sum, v) => sum + v.variance, 0).toFixed(2)}
            </div>
          </div>
        </div>

        {variances.filter(v => v.isOverBudget).length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800">
              ⚠️ You are over budget in {variances.filter(v => v.isOverBudget).length} {variances.filter(v => v.isOverBudget).length === 1 ? 'category' : 'categories'}
            </p>
            <p className="text-xs text-red-600 mt-1">
              Consider adjusting your spending or increasing your budget for these categories.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
