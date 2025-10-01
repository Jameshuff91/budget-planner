import { dbService } from './db';
import { Transaction, Category } from '../types';
import { toast } from '@components/ui/use-toast';

interface AlertCheckResult {
  triggered: boolean;
  categoryName: string;
  percentUsed: number;
  threshold: number;
  spent: number;
  budget: number;
}

/**
 * Check all budget alerts and trigger notifications if thresholds are exceeded
 */
export async function checkBudgetAlerts(
  transactions: Transaction[],
  categories: Category[],
): Promise<AlertCheckResult[]> {
  try {
    const alerts = await dbService.getAllBudgetAlerts();
    const triggeredAlerts: AlertCheckResult[] = [];

    // Get current month's transactions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthTransactions = transactions.filter(
      (t) => new Date(t.date) >= startOfMonth && t.type === 'expense',
    );

    // Check each enabled alert
    for (const alert of alerts.filter((a) => a.enabled)) {
      const category = categories.find((c) => c.id === alert.categoryId);

      if (!category || !category.budget || category.budget === 0) {
        continue;
      }

      // Calculate spending for this category
      const spent = currentMonthTransactions
        .filter((t) => t.category === category.name)
        .reduce((sum, t) => sum + t.amount, 0);

      const percentUsed = (spent / category.budget) * 100;

      // Check if threshold is exceeded
      if (percentUsed >= alert.threshold) {
        const result: AlertCheckResult = {
          triggered: true,
          categoryName: category.name,
          percentUsed: Math.round(percentUsed * 10) / 10,
          threshold: alert.threshold,
          spent,
          budget: category.budget,
        };

        triggeredAlerts.push(result);

        // Show toast notification
        showBudgetAlertNotification(result);

        // Update notification count
        await dbService.updateBudgetAlert({
          ...alert,
          notificationsSent: alert.notificationsSent + 1,
        });
      }
    }

    return triggeredAlerts;
  } catch (error) {
    console.error('Error checking budget alerts:', error);
    return [];
  }
}

/**
 * Show a toast notification for a budget alert
 */
function showBudgetAlertNotification(alert: AlertCheckResult) {
  const isOverBudget = alert.percentUsed >= 100;
  const isWarning = alert.percentUsed >= 90;

  toast({
    title: isOverBudget
      ? `🚨 Over Budget: ${alert.categoryName}`
      : `⚠️ Budget Alert: ${alert.categoryName}`,
    description: `You've spent $${alert.spent.toFixed(2)} (${alert.percentUsed}%) of your $${alert.budget.toFixed(2)} budget.`,
    variant: isOverBudget ? 'destructive' : 'default',
    duration: 8000, // Show for 8 seconds
  });
}

/**
 * Check if any category is approaching or over budget (without alerts configured)
 */
export function checkBudgetStatus(
  transactions: Transaction[],
  categories: Category[],
): {
  overBudget: number;
  nearLimit: number;
  categories: Array<{ name: string; percentUsed: number; spent: number; budget: number }>;
} {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthTransactions = transactions.filter(
    (t) => new Date(t.date) >= startOfMonth && t.type === 'expense',
  );

  let overBudget = 0;
  let nearLimit = 0;
  const categoryStatus: Array<{
    name: string;
    percentUsed: number;
    spent: number;
    budget: number;
  }> = [];

  categories.forEach((category) => {
    if (!category.budget || category.budget === 0 || category.type !== 'expense') {
      return;
    }

    const spent = currentMonthTransactions
      .filter((t) => t.category === category.name)
      .reduce((sum, t) => sum + t.amount, 0);

    const percentUsed = (spent / category.budget) * 100;

    if (percentUsed >= 100) {
      overBudget++;
    } else if (percentUsed >= 80) {
      nearLimit++;
    }

    if (percentUsed >= 80) {
      categoryStatus.push({
        name: category.name,
        percentUsed: Math.round(percentUsed * 10) / 10,
        spent,
        budget: category.budget,
      });
    }
  });

  return {
    overBudget,
    nearLimit,
    categories: categoryStatus.sort((a, b) => b.percentUsed - a.percentUsed),
  };
}

/**
 * Reset alert notification counts at the start of a new month
 */
export async function resetMonthlyAlertCounts(): Promise<void> {
  try {
    const alerts = await dbService.getAllBudgetAlerts();

    for (const alert of alerts) {
      if (alert.notificationsSent > 0) {
        await dbService.updateBudgetAlert({
          ...alert,
          notificationsSent: 0,
        });
      }
    }

    console.log('Monthly alert counts reset successfully');
  } catch (error) {
    console.error('Error resetting monthly alert counts:', error);
  }
}
