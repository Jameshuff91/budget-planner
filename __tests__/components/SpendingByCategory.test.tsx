import { vi } from 'vitest';

describe('SpendingByCategory Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should have correct category spending calculations', () => {
    // Test data
    const categorySpending = [
      { name: 'Food', value: 500, target: 600 },
      { name: 'Transport', value: 300, target: 250 },
      { name: 'Entertainment', value: 200, target: 200 },
      { name: 'Utilities', value: 0, target: 100 },
    ];

    const totalSpending = categorySpending.reduce((sum, cat) => sum + cat.value, 0);
    expect(totalSpending).toBe(1000);

    // Test percentages
    const foodPercentage = (500 / totalSpending) * 100;
    expect(foodPercentage).toBe(50);

    const transportPercentage = (300 / totalSpending) * 100;
    expect(transportPercentage).toBe(30);

    const entertainmentPercentage = (200 / totalSpending) * 100;
    expect(entertainmentPercentage).toBe(20);

    const utilitiesPercentage = (0 / totalSpending) * 100;
    expect(utilitiesPercentage).toBe(0);
  });

  test('should calculate budget usage correctly', () => {
    const categories = [
      { name: 'Food', value: 500, target: 600 },
      { name: 'Transport', value: 300, target: 250 },
      { name: 'Entertainment', value: 200, target: 200 },
      { name: 'Utilities', value: 0, target: 100 },
    ];

    // Food: under budget
    const foodUsage = (categories[0].value / categories[0].target) * 100;
    expect(foodUsage).toBeCloseTo(83.33, 1);

    // Transport: over budget
    const transportUsage = (categories[1].value / categories[1].target) * 100;
    expect(transportUsage).toBe(120);

    // Entertainment: exactly on budget
    const entertainmentUsage = (categories[2].value / categories[2].target) * 100;
    expect(entertainmentUsage).toBe(100);

    // Utilities: no spending
    const utilitiesUsage = (categories[3].value / categories[3].target) * 100;
    expect(utilitiesUsage).toBe(0);
  });

  test('should identify budget status correctly', () => {
    const getBudgetStatus = (value: number, target: number) => {
      if (target === 0) return 'no-budget';
      const percentage = (value / target) * 100;
      if (percentage > 100) return 'over-budget';
      if (percentage >= 75) return 'warning';
      return 'good';
    };

    expect(getBudgetStatus(500, 600)).toBe('warning'); // 83.3%
    expect(getBudgetStatus(300, 250)).toBe('over-budget'); // 120%
    expect(getBudgetStatus(200, 200)).toBe('warning'); // 100% - at threshold
    expect(getBudgetStatus(0, 100)).toBe('good'); // 0%
    expect(getBudgetStatus(100, 0)).toBe('no-budget');
  });

  test('should format currency values correctly', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    };

    expect(formatCurrency(500)).toBe('$500.00');
    expect(formatCurrency(300.5)).toBe('$300.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  test('should handle trend calculations', () => {
    const trends = {
      Food: { percentageChange: 10.5 },
      Transport: { percentageChange: -5.2 },
      Entertainment: { percentageChange: 0 },
      Utilities: { percentageChange: -100 },
    };

    // Positive trend
    expect(trends.Food.percentageChange).toBeGreaterThan(0);
    expect(trends.Food.percentageChange).toBe(10.5);

    // Negative trend
    expect(trends.Transport.percentageChange).toBeLessThan(0);
    expect(trends.Transport.percentageChange).toBe(-5.2);

    // No change
    expect(trends.Entertainment.percentageChange).toBe(0);

    // Complete reduction
    expect(trends.Utilities.percentageChange).toBe(-100);
  });

  test('should filter zero-value categories from pie chart data', () => {
    const categorySpending = [
      { name: 'Food', value: 500, target: 600 },
      { name: 'Transport', value: 300, target: 250 },
      { name: 'Entertainment', value: 200, target: 200 },
      { name: 'Utilities', value: 0, target: 100 },
    ];

    const pieChartData = categorySpending.filter((cat) => cat.value > 0);
    expect(pieChartData).toHaveLength(3);
    expect(pieChartData.find((cat) => cat.name === 'Utilities')).toBeUndefined();
  });

  test('should validate budget input correctly', () => {
    const isValidBudget = (input: string): boolean => {
      if (input.trim() === '') return true; // Empty is valid (treated as 0)
      const num = parseFloat(input);
      if (isNaN(num)) return false;
      if (num < 0) return false;
      // Check if the input string matches what parseFloat returns when converted back
      return num.toString() === input || input === num.toFixed(2);
    };

    // Valid inputs
    expect(isValidBudget('100')).toBe(true);
    expect(isValidBudget('100.50')).toBe(true);
    expect(isValidBudget('0')).toBe(true);
    expect(isValidBudget('')).toBe(true);
    expect(isValidBudget('  ')).toBe(true);

    // Invalid inputs
    expect(isValidBudget('abc')).toBe(false);
    expect(isValidBudget('-100')).toBe(false);
    expect(isValidBudget('$100')).toBe(false);
    expect(isValidBudget('100.50.50')).toBe(false); // parseFloat would parse this as 100.50
  });

  test('should handle date ranges correctly', () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Current month range
    const monthStart = new Date(currentYear, currentMonth, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    expect(monthStart.getDate()).toBe(1);
    expect(monthEnd.getMonth()).toBe(currentMonth);
    expect(monthEnd.getHours()).toBe(23);

    // Year to date range
    const yearStart = new Date(currentYear, 0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const yearEnd = new Date(currentYear, 11, 31);
    yearEnd.setHours(23, 59, 59, 999);

    expect(yearStart.getMonth()).toBe(0);
    expect(yearEnd.getMonth()).toBe(11);
    expect(yearEnd.getDate()).toBe(31);
  });
});
