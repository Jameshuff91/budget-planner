import { Category, Transaction } from '../types';

export interface BudgetVariance {
  categoryId: string;
  categoryName: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercentage: number;
  isOverBudget: boolean;
}

export interface SpendingPattern {
  category: string;
  averageAmount: number;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomalies: Transaction[];
}

export interface FinancialHealthScore {
  overall: number;
  savingsRate: number;
  budgetAdherence: number;
  expenseStability: number;
  insights: string[];
}

export interface SavingsOpportunity {
  category: string;
  potentialSavings: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Calculate budget variance for a given period
 */
export function calculateBudgetVariance(
  transactions: Transaction[],
  categories: Category[],
  startDate: Date,
  endDate: Date,
): BudgetVariance[] {
  const variances: BudgetVariance[] = [];

  // Filter transactions for the date range
  const filteredTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date);
    return transactionDate >= startDate && transactionDate <= endDate && t.type === 'expense';
  });

  // Calculate actual spending per category
  const actualSpending = filteredTransactions.reduce(
    (acc, t) => {
      const key = t.category;
      acc[key] = (acc[key] || 0) + t.amount;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Build variance reports for categories with budgets
  categories.forEach((category) => {
    if (category.budget && category.budget > 0 && category.type === 'expense') {
      const actual = actualSpending[category.name] || 0;
      const variance = category.budget - actual;
      const variancePercentage = (variance / category.budget) * 100;

      variances.push({
        categoryId: category.id,
        categoryName: category.name,
        budget: category.budget,
        actual,
        variance,
        variancePercentage,
        isOverBudget: variance < 0,
      });
    }
  });

  return variances.sort((a, b) => a.variance - b.variance);
}

/**
 * Detect unusual spending patterns
 */
export function detectSpendingPatterns(
  transactions: Transaction[],
  lookbackMonths: number = 3,
): SpendingPattern[] {
  const now = new Date();
  const lookbackDate = new Date(now);
  lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);

  const expenseTransactions = transactions.filter(
    (t) => t.type === 'expense' && new Date(t.date) >= lookbackDate,
  );

  // Group by category
  const byCategory = expenseTransactions.reduce(
    (acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = [];
      }
      acc[t.category].push(t);
      return acc;
    },
    {} as Record<string, Transaction[]>,
  );

  const patterns: SpendingPattern[] = [];

  Object.entries(byCategory).forEach(([category, categoryTransactions]) => {
    const amounts = categoryTransactions.map((t) => t.amount);
    const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / amounts.length,
    );

    // Detect anomalies (transactions more than 2 std deviations from mean)
    const anomalies = categoryTransactions.filter((t) => Math.abs(t.amount - average) > 2 * stdDev);

    // Determine trend (simple linear regression)
    const trend = determineTrend(categoryTransactions);

    patterns.push({
      category,
      averageAmount: average,
      frequency: categoryTransactions.length,
      trend,
      anomalies,
    });
  });

  return patterns;
}

/**
 * Simple trend detection based on first half vs second half comparison
 */
function determineTrend(transactions: Transaction[]): 'increasing' | 'decreasing' | 'stable' {
  if (transactions.length < 4) return 'stable';

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const midpoint = Math.floor(sorted.length / 2);

  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, t) => sum + t.amount, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, t) => sum + t.amount, 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePercent > 10) return 'increasing';
  if (changePercent < -10) return 'decreasing';
  return 'stable';
}

/**
 * Calculate financial health score
 */
export function calculateFinancialHealthScore(
  transactions: Transaction[],
  categories: Category[],
  periodMonths: number = 1,
): FinancialHealthScore {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - periodMonths);

  const periodTransactions = transactions.filter((t) => new Date(t.date) >= startDate);

  const totalIncome = periodTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = periodTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const insights: string[] = [];

  // 1. Savings Rate Score (0-40 points)
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  let savingsScore = 0;
  if (savingsRate >= 20) savingsScore = 40;
  else if (savingsRate >= 10) savingsScore = 30;
  else if (savingsRate >= 5) savingsScore = 20;
  else if (savingsRate >= 0) savingsScore = 10;
  else savingsScore = 0;

  if (savingsRate < 10) {
    insights.push(`Low savings rate (${savingsRate.toFixed(1)}%). Aim for at least 10-20%.`);
  } else if (savingsRate >= 20) {
    insights.push(`Excellent savings rate of ${savingsRate.toFixed(1)}%! Keep it up.`);
  }

  // 2. Budget Adherence Score (0-30 points)
  const variances = calculateBudgetVariance(periodTransactions, categories, startDate, now);
  const budgetedCategories = variances.length;
  const overBudgetCategories = variances.filter((v) => v.isOverBudget).length;

  let budgetScore = 0;
  if (budgetedCategories > 0) {
    const adherenceRate = 1 - overBudgetCategories / budgetedCategories;
    budgetScore = adherenceRate * 30;

    if (overBudgetCategories > budgetedCategories / 2) {
      insights.push(
        `Over budget in ${overBudgetCategories} of ${budgetedCategories} categories. Review your spending.`,
      );
    }
  } else {
    budgetScore = 15; // Default score if no budgets set
    insights.push('Set budgets for your expense categories to better track spending.');
  }

  // 3. Expense Stability Score (0-30 points)
  const patterns = detectSpendingPatterns(transactions, periodMonths);
  const increasingCategories = patterns.filter((p) => p.trend === 'increasing').length;
  const totalCategories = patterns.length;

  let stabilityScore = 30;
  if (totalCategories > 0) {
    const instabilityRate = increasingCategories / totalCategories;
    stabilityScore = Math.max(0, 30 - instabilityRate * 30);

    if (instabilityRate > 0.3) {
      insights.push(`Spending is increasing in ${increasingCategories} categories. Monitor closely.`);
    }
  }

  const overallScore = savingsScore + budgetScore + stabilityScore;

  if (overallScore >= 80) {
    insights.push('Your financial health is excellent! Continue these good habits.');
  } else if (overallScore >= 60) {
    insights.push('Your financial health is good, but there is room for improvement.');
  } else if (overallScore >= 40) {
    insights.push('Your financial health needs attention. Consider adjusting your budget.');
  } else {
    insights.push('Your financial health requires immediate attention. Seek to reduce expenses.');
  }

  return {
    overall: Math.round(overallScore),
    savingsRate: Math.round(savingsRate * 10) / 10,
    budgetAdherence: Math.round(budgetScore),
    expenseStability: Math.round(stabilityScore),
    insights,
  };
}

/**
 * Identify savings opportunities
 */
export function identifySavingsOpportunities(
  transactions: Transaction[],
  lookbackMonths: number = 3,
): SavingsOpportunity[] {
  const opportunities: SavingsOpportunity[] = [];
  const patterns = detectSpendingPatterns(transactions, lookbackMonths);

  patterns.forEach((pattern) => {
    // High frequency spending
    if (pattern.frequency > 20 && pattern.averageAmount > 10) {
      const monthlyCost = pattern.averageAmount * (pattern.frequency / lookbackMonths);
      const potentialSavings = monthlyCost * 0.2; // Estimate 20% savings potential

      opportunities.push({
        category: pattern.category,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
        reason: `High frequency spending (${pattern.frequency} transactions). Consider bulk buying or alternatives.`,
        priority: monthlyCost > 500 ? 'high' : monthlyCost > 200 ? 'medium' : 'low',
      });
    }

    // Increasing trend
    if (pattern.trend === 'increasing') {
      opportunities.push({
        category: pattern.category,
        potentialSavings: Math.round(pattern.averageAmount * 0.15 * 100) / 100,
        reason: 'Spending in this category is increasing. Review and set limits.',
        priority: pattern.averageAmount > 200 ? 'high' : 'medium',
      });
    }

    // Anomalies detected
    if (pattern.anomalies.length > 0) {
      const anomalyTotal = pattern.anomalies.reduce((sum, t) => sum + t.amount, 0);
      opportunities.push({
        category: pattern.category,
        potentialSavings: Math.round(anomalyTotal * 0.3 * 100) / 100,
        reason: `${pattern.anomalies.length} unusual large transactions detected. Investigate for one-time expenses.`,
        priority: 'medium',
      });
    }
  });

  return opportunities.sort((a, b) => {
    const priorityScore = { high: 3, medium: 2, low: 1 };
    return priorityScore[b.priority] - priorityScore[a.priority] || b.potentialSavings - a.potentialSavings;
  });
}

/**
 * Get year-over-year comparison
 */
export interface YearOverYearComparison {
  category: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercentage: number;
}

export function getYearOverYearComparison(
  transactions: Transaction[],
  currentYear: number,
): YearOverYearComparison[] {
  const currentYearTransactions = transactions.filter(
    (t) => new Date(t.date).getFullYear() === currentYear && t.type === 'expense',
  );

  const previousYearTransactions = transactions.filter(
    (t) => new Date(t.date).getFullYear() === currentYear - 1 && t.type === 'expense',
  );

  const currentByCategory = groupByCategory(currentYearTransactions);
  const previousByCategory = groupByCategory(previousYearTransactions);

  const allCategories = new Set([
    ...Object.keys(currentByCategory),
    ...Object.keys(previousByCategory),
  ]);

  const comparisons: YearOverYearComparison[] = [];

  allCategories.forEach((category) => {
    const current = currentByCategory[category] || 0;
    const previous = previousByCategory[category] || 0;
    const change = current - previous;
    const changePercentage = previous > 0 ? (change / previous) * 100 : 0;

    comparisons.push({
      category,
      currentYear: current,
      previousYear: previous,
      change,
      changePercentage,
    });
  });

  return comparisons.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

function groupByCategory(transactions: Transaction[]): Record<string, number> {
  return transactions.reduce(
    (acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    },
    {} as Record<string, number>,
  );
}
