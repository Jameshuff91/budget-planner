import { useMemo, useState, useEffect } from 'react';
import { useDBContext } from '../context/DatabaseContext';
import { logger } from '../services/logger';

interface SpendingTrendData {
  name: string;
  spending: number;
}

interface SpendingOverviewData {
  month: string; 
  year: number;
  totalSpending: number; 
  totalIncome: number; 
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
  netSavings: TrendData; 
  income: TrendData;
  categorySpending: Record<string, TrendData>;
}

interface MerchantSpendingData {
  name: string; // Merchant name
  value: number; // Total amount spent at this merchant
  transactionCount: number; // Number of transactions for this merchant
}

interface Transaction { // Ensuring Transaction type is available for RecurringTransactionCandidate
  id: string;
  amount: number;
  category: string;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  isMonthSummary?: boolean;
  accountNumber?: string;
}

interface RecurringTransactionCandidate {
  id: string; 
  merchantName: string; 
  amount: number;
  frequency: 'monthly' | 'weekly' | 'quarterly' | 'annually' | 'other' | 'inconsistent';
  transactionIds: string[]; 
  transactions: Transaction[]; 
  lastDate: Date;
  avgDaysBetween: number | null;
  nextEstimatedDate?: Date;
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
  spendingOverview: [{ month: 'Current', year: new Date().getFullYear(), totalSpending: 0, totalIncome: 0 }], // Already matches new structure
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
    netSavings: { current: 0, previous: 0, percentageChange: 0 }, 
    income: { current: 0, previous: 0, percentageChange: 0 },
    categorySpending: {},
  },
  merchantSpending: [], 
  potentialRecurringTransactions: [], // Added
};

// Helper function for normalizing merchant names specifically for recurring transaction detection
const normalizeMerchantNameForRecurring = (description: string): string => {
  let name = description.toUpperCase();
  // More aggressive prefix removal for recurrence detection
  const prefixes = [
    /^DEBIT CARD PURCHASE\s*-\s*/i, /^POS DEBIT\s*-\s*/i, /^ACH DEBIT\s*-\s*/i,
    /^SQ\s*\*?\s*/i, /^PAYPAL\s*\*?\s*/i, /^AMZNMKTPLACE\s*/i, /^AMAZON\.COM\s*\*?\s*/i,
    /^TST\*\s*/i, /^CHECKCARD\s*\d*\s*/i, /^PURCHASE AUTHORIZED ON\s*\d{2}\/\d{2}\s*/i,
    /^PENDING\s*-\s*/i, /^BKCD PUR\s*/i, /^ONLINE PAYMENT TO\s*/i,
    /^RECURRING PAYMENT TO\s*/i, /^BILL PAYMENT TO\s*/i, /^\d{4}X{4}\d{4}\s*/,
    // Common services that often have variable parts after the name
    /^NETFLIX\.COM/i, /^SPOTIFY/i, /^HBO/i, /^HULU/i, /^APPLE\.COM\/BILL/i,
    /^GOOGLE\s*\*?(?:PLAY|STORAGE|YOUTUBE)/i,
  ];
  prefixes.forEach(pattern => {
    name = name.replace(pattern, '');
  });

  // Remove dates, ref numbers, etc.
  name = name.replace(/\s*\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*$/, ''); 
  name = name.replace(/\s*REF#\s*[\w\d-]+/gi, '');
  name = name.replace(/\s*TRACE#\s*[\w\d-]+/gi, '');
  name = name.replace(/\s*CHECK\s*\d+/gi, '');
  name = name.replace(/\s*BILL\s*ID\s*\w+/gi, '');
  name = name.replace(/\s*ACCOUNT\s*\w+/gi, '');
  
  // General cleanup: to lowercase, remove non-alphanumeric (keep spaces), standardize spaces
  name = name.toLowerCase();
  name = name.replace(/[^a-z0-9\s]/g, ''); // Remove non-alphanumeric, non-space
  name = name.replace(/\s+/g, ' ').trim(); // Standardize spaces and trim

  // Take first few words if too long, e.g. after a generic service name
  const words = name.split(' ');
  if (words.length > 3) {
    name = words.slice(0, 3).join(' ');
  }
  
  return name || "unknown_merchant"; // Fallback if name becomes empty
};


export const useAnalytics = (timeRange?: { startDate?: Date; endDate?: Date }) => {
  const { transactions, categories } = useDBContext();
  // Removed selectedMonth state and useEffect for monthSelected event

  const today = new Date();
  const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
  defaultStartDate.setHours(0, 0, 0, 0);
  const defaultEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  defaultEndDate.setHours(23, 59, 59, 999);

  const { startDate = defaultStartDate, endDate = defaultEndDate } = timeRange || {};

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
      const monthlyData = new Map<string, { totalSpending: number; totalIncome: number }>();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      // Determine the date range for the overview
      // Default to the last 12 full months including the current month.
      let rangeStartDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      let rangeEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month

      if (transactions.length > 0) {
        let firstTxDate = new Date(transactions[0].date);
        transactions.forEach(transaction => {
          const date = new Date(transaction.date);
          if (date < firstTxDate) firstTxDate = date;
        });
        // If the earliest transaction is more recent than our default 12-month start,
        // adjust the rangeStartDate to the month of the first transaction.
        if (firstTxDate > rangeStartDate) {
          rangeStartDate = new Date(firstTxDate.getFullYear(), firstTxDate.getMonth(), 1);
        }
      }

      // Initialize all months within the determined range
      let currentDateIter = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), 1);
      while (currentDateIter <= rangeEndDate) {
        const monthKey = `${currentDateIter.getFullYear()}-${months[currentDateIter.getMonth()]}`;
        monthlyData.set(monthKey, { totalSpending: 0, totalIncome: 0 });
        currentDateIter.setMonth(currentDateIter.getMonth() + 1);
      }
      
      // Process all transactions
      transactions.forEach((transaction) => {
        const date = new Date(transaction.date);
        // Ensure the transaction date is within our considered range before processing
        if (date >= rangeStartDate && date <= rangeEndDate) {
          const monthKey = `${date.getFullYear()}-${months[date.getMonth()]}`;
          
          if (monthlyData.has(monthKey)) { // Should always be true due to pre-initialization
            const current = monthlyData.get(monthKey)!;
            if (transaction.type === 'expense') {
              current.totalSpending += Math.abs(transaction.amount);
            } else if (transaction.type === 'income') {
              // This sums all 'income' type transactions. Vanguard specific logic is removed here.
              current.totalIncome += Math.abs(transaction.amount);
            }
            monthlyData.set(monthKey, current);
          }
        }
      });

      // Convert to array and sort by date
      const result = Array.from(monthlyData.entries())
        .map(([key, data]) => {
          const [year, monthName] = key.split('-');
          return {
            month: monthName,
            year: parseInt(year),
            totalSpending: Math.abs(data.totalSpending),
            totalIncome: Math.abs(data.totalIncome), // This is now raw total income
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.year, months.indexOf(a.month));
          const dateB = new Date(b.year, months.indexOf(b.month));
          return dateA.getTime() - dateB.getTime();
        });

      logger.info('Refactored Spending overview result (totalIncome, totalSpending):', result);
      return result;
    } catch (error) {
      logger.error('Error calculating spending overview:', error);
      return DEFAULT_VALUES.spendingOverview;
    }
  }, [transactions]);

  const categorySpending = useMemo((): CategoryData[] => {
    try {
      const categoryTotals = new Map<string, number>();

      // Use startDate and endDate from hook parameters (or defaults)
      logger.info(`Calculating category spending for period: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      const filteredTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        // Ensure transactionDate is within the provided or defaulted startDate and endDate
        return transactionDate >= startDate && transactionDate <= endDate;
      });

      logger.info('Filtered transactions for category spending:', filteredTransactions);

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
  }, [transactions, categories, startDate, endDate]); 

  const detailedCategorySpending = useMemo(() => {
    try {
      const details: Record<string, any[]> = {};

      // Use startDate and endDate from hook parameters (or defaults)
      logger.info(`Calculating detailed category spending for period: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      const filteredTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        // Ensure transactionDate is within the provided or defaulted startDate and endDate
        return transactionDate >= startDate && transactionDate <= endDate;
      });
      
      logger.info('Filtered transactions for detailed category spending:', filteredTransactions);

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
  }, [transactions, startDate, endDate]);

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
        netSavings: { // This calculation remains for net savings (income - spending + investments)
          current: currentSavings, 
          previous: previousSavings, 
          percentageChange: calculatePercentageChange(currentSavings, previousSavings),
        },
        income: { // This represents total raw income from monthlyTotals
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

  const merchantSpending = useMemo((): MerchantSpendingData[] => {
    try {
      const merchantTotals = new Map<string, { value: number; transactionCount: number }>();

      // Use startDate and endDate from hook parameters (or defaults)
      logger.info(`Calculating merchant spending for period: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      const filteredTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate && transaction.type === 'expense';
      });

      filteredTransactions.forEach((transaction) => {
        const merchantName = transaction.description;
        const current = merchantTotals.get(merchantName) || { value: 0, transactionCount: 0 };
        current.value += Math.abs(transaction.amount);
        current.transactionCount += 1;
        merchantTotals.set(merchantName, current);
      });

      const result = Array.from(merchantTotals.entries())
        .map(([name, data]) => ({
          name,
          value: data.value,
          transactionCount: data.transactionCount,
        }))
        .sort((a, b) => b.value - a.value); // Sort by spending amount descending

      logger.info('Merchant spending result:', result);
      return result;
    } catch (error) {
      logger.error('Error calculating merchant spending:', error);
      return DEFAULT_VALUES.merchantSpending;
    }
  }, [transactions, startDate, endDate]);

  const potentialRecurringTransactions = useMemo((): RecurringTransactionCandidate[] => {
    logger.info('Calculating potential recurring transactions...');
    const candidates: RecurringTransactionCandidate[] = [];
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    if (expenseTransactions.length < 3) { // Need at least 3 for a pattern
      logger.info('Not enough expense transactions to detect recurring patterns.');
      return [];
    }

    const groupedByMerchant = new Map<string, Transaction[]>();

    expenseTransactions.forEach(t => {
      const normalizedName = normalizeMerchantNameForRecurring(t.description);
      // logger.debug(`Original: "${t.description}", Normalized for recurring: "${normalizedName}"`);
      const group = groupedByMerchant.get(normalizedName) || [];
      group.push(t as Transaction); // Cast to ensure type compatibility
      groupedByMerchant.set(normalizedName, group);
    });

    groupedByMerchant.forEach((merchantTransactions, merchantName) => {
      const groupedByAmount = new Map<number, Transaction[]>();
      merchantTransactions.forEach(t => {
        const group = groupedByAmount.get(t.amount) || [];
        group.push(t);
        groupedByAmount.set(t.amount, group);
      });

      groupedByAmount.forEach((transactionsInSeries, amount) => {
        if (transactionsInSeries.length >= 3) {
          const sortedSeries = [...transactionsInSeries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const intervals: number[] = [];
          for (let i = 1; i < sortedSeries.length; i++) {
            const diffTime = Math.abs(new Date(sortedSeries[i].date).getTime() - new Date(sortedSeries[i-1].date).getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            intervals.push(diffDays);
          }

          if (intervals.length < 2) return; // Need at least 2 intervals (3 transactions for a series)

          const avgDaysBetween = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
          const stdDev = Math.sqrt(intervals.map(x => Math.pow(x - avgDaysBetween, 2)).reduce((a, b) => a + b, 0) / intervals.length);

          let frequency: RecurringTransactionCandidate['frequency'] = 'inconsistent';
          // Heuristic: std dev less than 15% of avg, or less than ~3.5 days for monthly-ish patterns
          // and for very short intervals (weekly), allow slightly larger relative stddev but small absolute.
          let isConsistent = false;
          if (avgDaysBetween >= 6 && avgDaysBetween <= 9 && stdDev < 2.5) { // weekly-ish
             isConsistent = true;
          } else if (stdDev < Math.max(avgDaysBetween * 0.15, 3.5)) {
             isConsistent = true;
          }


          if (isConsistent) {
            if (avgDaysBetween >= 27 && avgDaysBetween <= 33) frequency = 'monthly';
            else if (avgDaysBetween >= 6 && avgDaysBetween <= 9) frequency = 'weekly'; // slightly wider for weekly
            else if (avgDaysBetween >= 85 && avgDaysBetween <= 95) frequency = 'quarterly';
            else if (avgDaysBetween >= 350 && avgDaysBetween <= 380) frequency = 'annually';
            else if (intervals.length >=2 && stdDev < 2) { // Consistent but not standard, very low stddev
              frequency = 'other'; 
              logger.info(`Found 'other' consistent frequency for ${merchantName} - Amount: ${amount}, AvgDays: ${avgDaysBetween}, StdDev: ${stdDev}`);
            }
          }
          
          // For this first pass, only add candidates with a clearly identified common frequency.
          if (frequency === 'monthly' || frequency === 'weekly' || frequency === 'quarterly' || frequency === 'annually') { 
            const lastTransaction = sortedSeries[sortedSeries.length - 1];
            const lastDate = new Date(lastTransaction.date);
            let nextEstimatedDate: Date | undefined = undefined;

            if (avgDaysBetween > 0) { // Ensure avgDaysBetween is positive before adding
                nextEstimatedDate = new Date(lastDate);
                nextEstimatedDate.setDate(lastDate.getDate() + Math.round(avgDaysBetween));
            }
            
            // Create a more stable ID based on merchant, amount, and frequency
            const candidateId = `${merchantName}-${amount}-${frequency}`.replace(/\s+/g, '-').toLowerCase();

            candidates.push({
              id: candidateId, 
              merchantName,
              amount,
              frequency,
              transactionIds: sortedSeries.map(t => t.id),
              transactions: sortedSeries, // Store the actual transaction objects
              lastDate,
              avgDaysBetween,
              nextEstimatedDate,
            });
          }
        }
      });
    });
    
    // Sort candidates by merchant name, then amount
    candidates.sort((a, b) => {
      if (a.merchantName < b.merchantName) return -1;
      if (a.merchantName > b.merchantName) return 1;
      return a.amount - b.amount;
    });

    logger.info(`Potential recurring transactions identified: ${candidates.length}`, candidates);
    return candidates;
  }, [transactions]); // Depends only on transactions as it analyzes the whole dataset

  return {
    spendingTrend,
    spendingOverview,
    categorySpending,
    detailedCategorySpending,
    monthlyTrends,
    merchantSpending,
    potentialRecurringTransactions, 
  };
};
