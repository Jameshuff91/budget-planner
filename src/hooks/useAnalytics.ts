import { useMemo, useState, useEffect } from 'react';
import { useDBContext } from '../context/DatabaseContext';
import { logger } from '../services/logger';

interface SpendingTrendData {
  name: string;
  spending: number;
}

interface SpendingOverviewData {
  name: string;
  year: number;
  spending: number;
  savings: number;
}

interface CategoryData {
  name: string;
  value: number;
  target?: number;
}

interface TrendData {
  current: number;
  previous: number;
  percentageChange: number;
}

interface MonthlyTrends {
  spending: TrendData;
  savings: TrendData;
  income: TrendData;
  categorySpending: Record<string, TrendData>;
}

// Default values for the dashboard
export const DEFAULT_VALUES = {
  spendingTrends: [
    { name: 'Jan', spending: 0 },
    { name: 'Feb', spending: 0 },
    { name: 'Mar', spending: 0 },
    { name: 'Apr', spending: 0 },
    { name: 'May', spending: 0 },
    { name: 'Jun', spending: 0 },
    { name: 'Jul', spending: 0 },
    { name: 'Aug', spending: 0 },
    { name: 'Sep', spending: 0 },
    { name: 'Oct', spending: 0 },
    { name: 'Nov', spending: 0 },
    { name: 'Dec', spending: 0 },
  ],
  spendingOverview: [{ name: 'Current', year: new Date().getFullYear(), spending: 0, savings: 0 }],
  categoryData: [
    { name: 'Housing', value: 0, target: 2000 },
    { name: 'Transportation', value: 0, target: 500 },
    { name: 'Food', value: 0, target: 600 },
    { name: 'Utilities', value: 0, target: 300 },
    { name: 'Entertainment', value: 0, target: 200 },
    { name: 'Other', value: 0, target: 400 },
  ],
  monthlyTrends: {
    spending: { current: 0, previous: 0, percentageChange: 0 },
    savings: { current: 0, previous: 0, percentageChange: 0 },
    income: { current: 0, previous: 0, percentageChange: 0 },
    categorySpending: {},
  },
};

export const useAnalytics = () => {
  const { transactions, categories } = useDBContext();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Listen for month selection events
  useEffect(() => {
    const handleMonthSelected = (event: CustomEvent) => {
      const selectedDate = new Date(event.detail.date); // Parse ISO string to Date
      setSelectedMonth(selectedDate);
    };

    window.addEventListener('monthSelected', handleMonthSelected as EventListener);
    return () => {
      window.removeEventListener('monthSelected', handleMonthSelected as EventListener);
    };
  }, []);

  const spendingTrend = useMemo((): SpendingTrendData[] => {
    try {
      const monthlySpending = new Map<string, number>();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      // Get current date and calculate date range
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // 12 months ago

      // Initialize all months with 0
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
        monthlySpending.set(monthKey, 0);
      }

      // Process transactions within date range
      transactions.forEach((transaction) => {
        const date = new Date(transaction.date);
        // Only process transactions within last 12 months
        if (date >= startDate && date <= today) {
          const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
          // Include both income and expense transactions
          const currentAmount = monthlySpending.get(monthKey) || 0;
          // For expenses, add the amount directly (they should be positive values)
          // For income, we don't need to track it in spending trend
          if (transaction.type === 'expense') {
            monthlySpending.set(monthKey, currentAmount + Math.abs(transaction.amount));
          }
        }
      });

      // Debug log to check monthly data
      logger.info('Monthly spending data:', Object.fromEntries(monthlySpending));

      // Convert to array and sort by date
      return Array.from(monthlySpending.entries())
        .map(([name, spending]) => ({
          name,
          spending: Math.abs(spending) // Ensure positive values
        }))
        .sort((a, b) => {
          const [monthA, yearA] = a.name.split(' ');
          const [monthB, yearB] = b.name.split(' ');
          const dateA = new Date(parseInt(yearA), months.indexOf(monthA));
          const dateB = new Date(parseInt(yearB), months.indexOf(monthB));
          return dateA.getTime() - dateB.getTime();
        });
    } catch (error) {
      logger.error('Error calculating spending trend:', error);
      return DEFAULT_VALUES.spendingTrends;
    }
  }, [transactions]);

  const spendingOverview = useMemo((): SpendingOverviewData[] => {
    try {
      const monthlyData = new Map<string, { spending: number; income: number }>();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      // Find the date range from transactions
      let minDate = new Date();
      let maxDate = new Date(0); // Start with earliest possible date

      transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        if (date < minDate) minDate = date;
        if (date > maxDate) maxDate = date;
      });

      // Ensure we have at least the last 12 months if there are no transactions
      const today = new Date();
      if (maxDate < today) maxDate = today;
      if (minDate > new Date(today.getFullYear() - 1, today.getMonth(), 1)) {
        minDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      }

      // Initialize all months between min and max date
      let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      while (currentDate <= maxDate) {
        const monthKey = `${currentDate.getFullYear()}-${months[currentDate.getMonth()]}`;
        monthlyData.set(monthKey, { spending: 0, income: 0 });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Process all transactions
      transactions.forEach((transaction) => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${months[date.getMonth()]}`;
        
        // Only process if the month exists in our range
        if (monthlyData.has(monthKey)) {
          const current = monthlyData.get(monthKey)!;
          if (transaction.type === 'expense') {
            current.spending += Math.abs(transaction.amount);
          } else if (transaction.type === 'income') {
            current.income += Math.abs(transaction.amount);
          }
          monthlyData.set(monthKey, current);
        }
      });

      // Convert to array and sort by date
      const result = Array.from(monthlyData.entries())
        .map(([key, data]) => {
          const [year, month] = key.split('-');
          const spending = Math.abs(data.spending);
          const income = Math.abs(data.income);
          
          // Calculate savings by looking for investment transactions
          const investmentSavings = transactions
            .filter(t => {
              const tDate = new Date(t.date);
              return tDate.getFullYear() === parseInt(year) &&
                     months[tDate.getMonth()] === month &&
                     t.description.toLowerCase().includes('vanguard');
            })
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

          return {
            name: month,
            year: parseInt(year),
            spending: spending,
            savings: income - spending + investmentSavings // Add investment amounts to savings
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.year, months.indexOf(a.name));
          const dateB = new Date(b.year, months.indexOf(b.name));
          return dateA.getTime() - dateB.getTime();
        });

      logger.info('Spending overview result:', result);
      return result;
    } catch (error) {
      logger.error('Error calculating spending overview:', error);
      return DEFAULT_VALUES.spendingOverview;
    }
  }, [transactions]);

  const categorySpending = useMemo((): CategoryData[] => {
    try {
      const categoryTotals = new Map<string, number>();
      
      logger.info('Calculating category spending for:', selectedMonth);

      // Filter transactions for the selected month
      const filteredTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const selectedDate = new Date(selectedMonth); // Create new Date to ensure clean comparison
        
        // Set both dates to the first of their respective months for comparison
        transactionDate.setDate(1);
        transactionDate.setHours(0, 0, 0, 0);
        selectedDate.setDate(1);
        selectedDate.setHours(0, 0, 0, 0);
        
        return transactionDate.getTime() === selectedDate.getTime();
      });

      logger.info('Filtered transactions:', filteredTransactions);

      filteredTransactions.forEach((transaction) => {
        if (transaction.type === 'expense') {
          const current = categoryTotals.get(transaction.category) || 0;
          categoryTotals.set(transaction.category, current + transaction.amount);
        }
      });

      const result = Array.from(categoryTotals.entries()).map(([name, value]) => {
        const category = categories.find((c) => c.name === name);
        return {
          name,
          value,
          target: category?.budget,
        };
      });

      // If there are no transactions for the selected month, return empty categories with zero values
      if (result.length === 0) {
        return categories.map(category => ({
          name: category.name,
          value: 0,
          target: category.budget,
        }));
      }

      logger.info('Category spending result:', result);
      return result;
    } catch (error) {
      logger.error('Error calculating category spending:', error);
      return DEFAULT_VALUES.categoryData;
    }
  }, [transactions, categories, selectedMonth]);

  const detailedCategorySpending = useMemo(() => {
    try {
      const details: Record<string, any[]> = {};
      
      // Filter transactions for the selected month
      const filteredTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        const selectedDate = new Date(selectedMonth);
        
        // Set both dates to the first of their respective months for comparison
        transactionDate.setDate(1);
        transactionDate.setHours(0, 0, 0, 0);
        selectedDate.setDate(1);
        selectedDate.setHours(0, 0, 0, 0);
        
        return transactionDate.getTime() === selectedDate.getTime();
      });

      filteredTransactions.forEach((transaction) => {
        if (transaction.type === 'expense') {
          if (!details[transaction.category]) {
            details[transaction.category] = [];
          }
          details[transaction.category].push({
            name: transaction.description,
            value: transaction.amount,
          });
        }
      });

      return details;
    } catch (error) {
      logger.error('Error calculating detailed category spending:', error);
      return {};
    }
  }, [transactions, selectedMonth]);

  const monthlyTrends = useMemo((): MonthlyTrends => {
    try {
      const now = new Date();
      const months = [
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
      const currentMonth = now.getMonth();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const currentYear = now.getFullYear();
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Calculate monthly totals for all transactions
      const monthlyTotals = new Map<string, { spending: number; income: number }>();

      transactions.forEach((t) => {
        const date = new Date(t.date);
        const monthKey = months[date.getMonth()];
        const yearMonthKey = `${date.getFullYear()}-${monthKey}`;
        const current = monthlyTotals.get(yearMonthKey) || { spending: 0, income: 0 };

        if (t.type === 'expense') {
          current.spending += Math.abs(t.amount);
        } else {
          current.income += Math.abs(t.amount);
        }

        monthlyTotals.set(yearMonthKey, current);
      });

      // Get current month data
      const currentMonthKey = months[currentMonth];
      const currentKey = `${currentYear}-${currentMonthKey}`;
      const currentData = monthlyTotals.get(currentKey) || { spending: 0, income: 0 };
      const currentSpending = Math.abs(currentData.spending);
      const currentIncome = Math.abs(currentData.income);
      // Calculate current month savings including investments
      const currentInvestments = transactions
        .filter(t =>
          new Date(t.date).getMonth() === currentMonth &&
          new Date(t.date).getFullYear() === currentYear &&
          t.description.toLowerCase().includes('vanguard')
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const currentSavings = currentIncome - currentSpending + currentInvestments;

      // Get previous month data
      const previousMonthKey = months[previousMonth];
      const previousKey = `${previousYear}-${previousMonthKey}`;
      const previousData = monthlyTotals.get(previousKey) || { spending: 0, income: 0 };
      const previousSpending = Math.abs(previousData.spending);
      const previousIncome = Math.abs(previousData.income);
      const previousInvestments = transactions
        .filter(t =>
          new Date(t.date).getMonth() === previousMonth &&
          new Date(t.date).getFullYear() === previousYear &&
          t.description.toLowerCase().includes('vanguard')
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const previousSavings = previousIncome - previousSpending + previousInvestments;

      // Calculate percentage changes
      const calculatePercentageChange = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
      };

      // Calculate category spending trends
      const categoryTrends: Record<string, TrendData> = {};
      categories.forEach((category) => {
        const currentCategorySpending = transactions
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.category === category.name &&
              new Date(t.date).getMonth() === currentMonth &&
              new Date(t.date).getFullYear() === currentYear,
          )
          .reduce((sum, t) => sum + t.amount, 0);

        const previousCategorySpending = transactions
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.category === category.name &&
              new Date(t.date).getMonth() === previousMonth &&
              new Date(t.date).getFullYear() === previousYear,
          )
          .reduce((sum, t) => sum + t.amount, 0);

        categoryTrends[category.name] = {
          current: currentCategorySpending,
          previous: previousCategorySpending,
          percentageChange: calculatePercentageChange(
            currentCategorySpending,
            previousCategorySpending,
          ),
        };
      });

      return {
        spending: {
          current: currentSpending,
          previous: previousSpending,
          percentageChange: calculatePercentageChange(currentSpending, previousSpending),
        },
        savings: {
          current: currentSavings,
          previous: previousSavings,
          percentageChange: calculatePercentageChange(currentSavings, previousSavings),
        },
        income: {
          current: currentIncome,
          previous: previousIncome,
          percentageChange: calculatePercentageChange(currentIncome, previousIncome),
        },
        categorySpending: categoryTrends,
      };
    } catch (error) {
      logger.error('Error calculating monthly trends:', error);
      return DEFAULT_VALUES.monthlyTrends;
    }
  }, [transactions, categories]);

  return {
    spendingTrend,
    spendingOverview,
    categorySpending,
    detailedCategorySpending,
    monthlyTrends,
  };
};
