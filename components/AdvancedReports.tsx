'use client';

import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { useDBContext } from '@context/DatabaseContext';
import { Transaction } from '../src/types';
import { useEffect, useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AdvancedReports() {
  const { transactions, categories } = useDBContext();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().getFullYear(), 0, 1), // Start of current year
    end: new Date(),
  });

  const [taxDeductibleExpenses, setTaxDeductibleExpenses] = useState<Transaction[]>([]);
  const [reportData, setReportData] = useState<{
    totalIncome: number;
    totalExpenses: number;
    taxDeductible: number;
    byCategory: Record<string, { total: number; count: number; isTaxDeductible: boolean }>;
  }>({
    totalIncome: 0,
    totalExpenses: 0,
    taxDeductible: 0,
    byCategory: {},
  });

  useEffect(() => {
    if (transactions.length > 0) {
      // Filter transactions by date range
      const filteredTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
      });

      // Calculate totals
      const totalIncome = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      // Get tax-deductible categories
      const taxDeductibleCategories = categories.filter((c) => c.isTaxDeductible);
      const taxDeductibleCategoryNames = taxDeductibleCategories.map((c) => c.name);

      // Find tax-deductible expenses
      const taxDeductible = filteredTransactions.filter(
        (t) => t.type === 'expense' && taxDeductibleCategoryNames.includes(t.category),
      );

      const taxDeductibleTotal = taxDeductible.reduce((sum, t) => sum + t.amount, 0);

      // Group by category
      const byCategory: Record<string, { total: number; count: number; isTaxDeductible: boolean }> =
        {};

      filteredTransactions.forEach((t) => {
        if (!byCategory[t.category]) {
          byCategory[t.category] = {
            total: 0,
            count: 0,
            isTaxDeductible: taxDeductibleCategoryNames.includes(t.category),
          };
        }
        byCategory[t.category].total += t.amount;
        byCategory[t.category].count += 1;
      });

      setTaxDeductibleExpenses(taxDeductible);
      setReportData({
        totalIncome,
        totalExpenses,
        taxDeductible: taxDeductibleTotal,
        byCategory,
      });
    }
  }, [transactions, categories, dateRange]);

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type', 'Tax Deductible'];
    const rows = transactions
      .filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
      })
      .map((t) => {
        const category = categories.find((c) => c.name === t.category);
        return [
          t.date,
          t.category,
          t.description,
          t.amount.toFixed(2),
          t.type,
          category?.isTaxDeductible ? 'Yes' : 'No',
        ].join(',');
      });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTaxReport = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    const rows = taxDeductibleExpenses.map((t) => {
      return [t.date, t.category, t.description, t.amount.toFixed(2)].join(',');
    });

    const csv = [
      `Tax-Deductible Expenses Report`,
      `Period: ${format(dateRange.start, 'MMM dd, yyyy')} - ${format(dateRange.end, 'MMM dd, yyyy')}`,
      `Total Tax-Deductible Expenses: $${reportData.taxDeductible.toFixed(2)}`,
      '',
      headers.join(','),
      ...rows,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Advanced Reports</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export Full Report
            </Button>
            {reportData.taxDeductible > 0 && (
              <Button variant="outline" size="sm" onClick={exportTaxReport}>
                <FileText className="w-4 h-4 mr-2" />
                Export Tax Report
              </Button>
            )}
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Report Period
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <input
                type="date"
                value={format(dateRange.start, 'yyyy-MM-dd')}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: new Date(e.target.value) })
                }
                className="w-full p-2 border rounded mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <input
                type="date"
                value={format(dateRange.end, 'yyyy-MM-dd')}
                onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                className="w-full p-2 border rounded mt-1"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDateRange({
                  start: new Date(new Date().getFullYear(), 0, 1),
                  end: new Date(),
                })
              }
            >
              This Year
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDateRange({
                  start: new Date(new Date().getFullYear() - 1, 0, 1),
                  end: new Date(new Date().getFullYear() - 1, 11, 31),
                })
              }
            >
              Last Year
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const now = new Date();
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                setDateRange({ start: threeMonthsAgo, end: now });
              }}
            >
              Last 3 Months
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Total Income</div>
            <div className="text-2xl font-bold text-green-600">
              ${reportData.totalIncome.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-red-600">
              ${reportData.totalExpenses.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Net Income</div>
            <div
              className={`text-2xl font-bold ${
                reportData.totalIncome - reportData.totalExpenses >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              ${(reportData.totalIncome - reportData.totalExpenses).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Tax-Deductible Expenses */}
        {reportData.taxDeductible > 0 && (
          <Card className="p-4 bg-yellow-50 border-yellow-200 mb-6">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-yellow-600" />
              Tax-Deductible Expenses
            </h4>
            <div className="text-2xl font-bold text-yellow-600">
              ${reportData.taxDeductible.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {taxDeductibleExpenses.length} transactions marked as tax-deductible
            </p>
          </Card>
        )}

        {/* Category Breakdown */}
        <div>
          <h4 className="font-semibold mb-3">Category Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">Transactions</th>
                  <th className="text-right py-2">Total Amount</th>
                  <th className="text-center py-2">Tax Deductible</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.byCategory)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([category, data]) => (
                    <tr key={category} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{category}</td>
                      <td className="text-right py-3">{data.count}</td>
                      <td className="text-right py-3 font-semibold">
                        ${data.total.toFixed(2)}
                      </td>
                      <td className="text-center py-3">
                        {data.isTaxDeductible && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            Yes
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
