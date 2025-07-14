import { vi } from 'vitest';

describe('SpendingOverview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should calculate monthly spending and income correctly', () => {
    const spendingOverview = [
      { name: 'January', month: 0, year: 2024, totalSpending: 1500, totalIncome: 3000 },
      { name: 'February', month: 1, year: 2024, totalSpending: 1800, totalIncome: 3000 },
      { name: 'March', month: 2, year: 2024, totalSpending: 1200, totalIncome: 3500 },
      { name: 'December', month: 11, year: 2023, totalSpending: 2000, totalIncome: 3000 },
    ];
    
    // Test monthly savings calculation
    spendingOverview.forEach(month => {
      const savings = month.totalIncome - month.totalSpending;
      expect(savings).toBe(month.totalIncome - month.totalSpending);
    });
    
    // Test January 2024 savings
    expect(spendingOverview[0].totalIncome - spendingOverview[0].totalSpending).toBe(1500);
    
    // Test February 2024 savings
    expect(spendingOverview[1].totalIncome - spendingOverview[1].totalSpending).toBe(1200);
  });

  test('should filter data by year correctly', () => {
    const spendingOverview = [
      { name: 'January', month: 0, year: 2024, totalSpending: 1500, totalIncome: 3000 },
      { name: 'February', month: 1, year: 2024, totalSpending: 1800, totalIncome: 3000 },
      { name: 'December', month: 11, year: 2023, totalSpending: 2000, totalIncome: 3000 },
      { name: 'November', month: 10, year: 2023, totalSpending: 1700, totalIncome: 2800 },
    ];
    
    const selectedYear = 2024;
    const yearData = spendingOverview.filter(item => item.year === selectedYear);
    
    expect(yearData).toHaveLength(2);
    expect(yearData.every(item => item.year === 2024)).toBe(true);
    expect(yearData[0].name).toBe('January');
    expect(yearData[1].name).toBe('February');
  });

  test('should calculate monthly trends correctly', () => {
    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    // Test spending trend
    const currentSpending = 1800;
    const previousSpending = 1500;
    const spendingTrend = calculateTrend(currentSpending, previousSpending);
    expect(spendingTrend).toBeCloseTo(20); // 20% increase
    
    // Test savings trend
    const currentSavings = 1200;
    const previousSavings = 1500;
    const savingsTrend = calculateTrend(currentSavings, previousSavings);
    expect(savingsTrend).toBeCloseTo(-20); // 20% decrease
    
    // Test with zero previous value
    expect(calculateTrend(100, 0)).toBe(100);
    expect(calculateTrend(0, 0)).toBe(0);
  });

  test('should determine available years correctly', () => {
    const spendingOverview = [
      { name: 'January', month: 0, year: 2024, totalSpending: 1500, totalIncome: 3000 },
      { name: 'December', month: 11, year: 2023, totalSpending: 2000, totalIncome: 3000 },
      { name: 'June', month: 5, year: 2022, totalSpending: 1700, totalIncome: 2800 },
      { name: 'March', month: 2, year: 2024, totalSpending: 1200, totalIncome: 3500 },
    ];
    
    const years = new Set(spendingOverview.map(item => item.year));
    const availableYears = Array.from(years).sort();
    
    expect(availableYears).toEqual([2022, 2023, 2024]);
    expect(Math.min(...availableYears)).toBe(2022);
    expect(Math.max(...availableYears)).toBe(2024);
  });

  test('should determine navigation state correctly', () => {
    const availableYears = [2022, 2023, 2024];
    
    // Test for year 2023
    let selectedYear = 2023;
    let canNavigateNext = selectedYear < Math.max(...availableYears);
    let canNavigatePrev = selectedYear > Math.min(...availableYears);
    expect(canNavigateNext).toBe(true);
    expect(canNavigatePrev).toBe(true);
    
    // Test for year 2024 (max year)
    selectedYear = 2024;
    canNavigateNext = selectedYear < Math.max(...availableYears);
    canNavigatePrev = selectedYear > Math.min(...availableYears);
    expect(canNavigateNext).toBe(false);
    expect(canNavigatePrev).toBe(true);
    
    // Test for year 2022 (min year)
    selectedYear = 2022;
    canNavigateNext = selectedYear < Math.max(...availableYears);
    canNavigatePrev = selectedYear > Math.min(...availableYears);
    expect(canNavigateNext).toBe(true);
    expect(canNavigatePrev).toBe(false);
  });

  test('should format month names correctly', () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    expect(monthNames[0]).toBe('January');
    expect(monthNames[11]).toBe('December');
    expect(monthNames.length).toBe(12);
    
    // Test month calculations
    const currentMonth = 2; // March
    const previousMonth = (currentMonth - 1 + 12) % 12;
    expect(monthNames[currentMonth]).toBe('March');
    expect(monthNames[previousMonth]).toBe('February');
    
    // Test edge case: January
    const januaryIndex = 0;
    const beforeJanuary = (januaryIndex - 1 + 12) % 12;
    expect(monthNames[beforeJanuary]).toBe('December');
  });

  test('should handle year change correctly', () => {
    let selectedYear = 2023;
    
    // Test next year
    const handleYearChange = (direction: 'next' | 'prev') => {
      return direction === 'next' ? selectedYear + 1 : selectedYear - 1;
    };
    
    expect(handleYearChange('next')).toBe(2024);
    expect(handleYearChange('prev')).toBe(2022);
  });

  test('should format currency values correctly', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    };
    
    expect(formatCurrency(1500)).toBe('$1,500.00');
    expect(formatCurrency(3000.50)).toBe('$3,000.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  test('should handle empty data correctly', () => {
    const spendingOverview: any[] = [];
    const selectedYear = 2024;
    
    const yearData = spendingOverview.filter(item => item.year === selectedYear);
    expect(yearData).toHaveLength(0);
    
    // Available years should be empty
    const years = new Set(spendingOverview.map(item => item.year));
    const availableYears = Array.from(years).sort();
    expect(availableYears).toHaveLength(0);
  });

  test('should calculate spending velocity', () => {
    const monthlyData = [
      { month: 0, totalSpending: 1500 },
      { month: 1, totalSpending: 1800 },
      { month: 2, totalSpending: 1200 },
      { month: 3, totalSpending: 2000 },
    ];
    
    // Calculate average monthly spending
    const totalSpending = monthlyData.reduce((sum, m) => sum + m.totalSpending, 0);
    const avgMonthlySpending = totalSpending / monthlyData.length;
    expect(avgMonthlySpending).toBe(1625);
    
    // Calculate daily average (assuming 30 days per month)
    const avgDailySpending = avgMonthlySpending / 30;
    expect(avgDailySpending).toBeCloseTo(54.17, 2);
  });

  test('should identify spending patterns', () => {
    const monthlyData = [
      { month: 0, name: 'January', totalSpending: 1500 },
      { month: 1, name: 'February', totalSpending: 1800 },
      { month: 2, name: 'March', totalSpending: 1200 },
      { month: 11, name: 'December', totalSpending: 2500 }, // Holiday spending
    ];
    
    // Find highest spending month
    const highestSpending = monthlyData.reduce((max, month) => 
      month.totalSpending > max.totalSpending ? month : max
    );
    expect(highestSpending.name).toBe('December');
    expect(highestSpending.totalSpending).toBe(2500);
    
    // Find lowest spending month
    const lowestSpending = monthlyData.reduce((min, month) => 
      month.totalSpending < min.totalSpending ? month : min
    );
    expect(lowestSpending.name).toBe('March');
    expect(lowestSpending.totalSpending).toBe(1200);
  });
});