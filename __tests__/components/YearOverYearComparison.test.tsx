import { vi } from 'vitest';

describe('YearOverYearComparison Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  test('should filter spending data by year correctly', () => {
    const spendingOverview = [
      { month: 'Jan', year: 2024, totalSpending: 1500, totalIncome: 3000 },
      { month: 'Feb', year: 2024, totalSpending: 1800, totalIncome: 3000 },
      { month: 'Jan', year: 2023, totalSpending: 1200, totalIncome: 2800 },
      { month: 'Feb', year: 2023, totalSpending: 1400, totalIncome: 2800 },
      { month: 'Mar', year: 2024, totalSpending: 1600, totalIncome: 3200 },
      { month: 'Jan', year: 2022, totalSpending: 1000, totalIncome: 2500 },
    ];
    
    const selectedYear = 2024;
    const currentYearData = spendingOverview.filter((d) => d.year === selectedYear);
    const previousYearData = spendingOverview.filter((d) => d.year === selectedYear - 1);
    
    expect(currentYearData).toHaveLength(3);
    expect(previousYearData).toHaveLength(2);
    
    expect(currentYearData.every(d => d.year === 2024)).toBe(true);
    expect(previousYearData.every(d => d.year === 2023)).toBe(true);
  });

  test('should create comparison data structure correctly', () => {
    const currentYearData = [
      { month: 'Jan', year: 2024, totalSpending: 1500, totalIncome: 3000 },
      { month: 'Feb', year: 2024, totalSpending: 1800, totalIncome: 3000 },
    ];
    
    const previousYearData = [
      { month: 'Jan', year: 2023, totalSpending: 1200, totalIncome: 2800 },
      { month: 'Feb', year: 2023, totalSpending: 1400, totalIncome: 2800 },
    ];
    
    const selectedYear = 2024;
    const comparisonData = monthNames.map((month) => {
      const currentMonth = currentYearData.find((d) => d.month === month);
      const previousMonth = previousYearData.find((d) => d.month === month);
      
      return {
        month,
        [selectedYear]: currentMonth?.totalSpending || 0,
        [`${selectedYear - 1}`]: previousMonth?.totalSpending || 0,
        currentIncome: currentMonth?.totalIncome || 0,
        previousIncome: previousMonth?.totalIncome || 0,
      };
    });
    
    expect(comparisonData).toHaveLength(12);
    
    // Check January data
    const janData = comparisonData[0];
    expect(janData.month).toBe('Jan');
    expect(janData[2024]).toBe(1500);
    expect(janData['2023']).toBe(1200);
    expect(janData.currentIncome).toBe(3000);
    expect(janData.previousIncome).toBe(2800);
    
    // Check March data (no data for March)
    const marData = comparisonData[2];
    expect(marData.month).toBe('Mar');
    expect(marData[2024]).toBe(0);
    expect(marData['2023']).toBe(0);
  });

  test('should calculate year-over-year statistics correctly', () => {
    const comparisonData = [
      { month: 'Jan', 2024: 1500, '2023': 1200, currentIncome: 3000, previousIncome: 2800 },
      { month: 'Feb', 2024: 1800, '2023': 1400, currentIncome: 3000, previousIncome: 2800 },
      { month: 'Mar', 2024: 1600, '2023': 1300, currentIncome: 3200, previousIncome: 2900 },
    ];
    
    const selectedYear = 2024;
    const currentYearTotal = comparisonData.reduce((sum, d) => sum + d[selectedYear], 0);
    const previousYearTotal = comparisonData.reduce((sum, d) => sum + d[`${selectedYear - 1}`], 0);
    const currentIncomeTotal = comparisonData.reduce((sum, d) => sum + d.currentIncome, 0);
    const previousIncomeTotal = comparisonData.reduce((sum, d) => sum + d.previousIncome, 0);
    
    expect(currentYearTotal).toBe(4900); // 1500 + 1800 + 1600
    expect(previousYearTotal).toBe(3900); // 1200 + 1400 + 1300
    expect(currentIncomeTotal).toBe(9200); // 3000 + 3000 + 3200
    expect(previousIncomeTotal).toBe(8500); // 2800 + 2800 + 2900
    
    // Calculate percentage changes
    const spendingChange = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100;
    expect(spendingChange).toBeCloseTo(25.64, 2); // (4900 - 3900) / 3900 * 100
    
    const incomeChange = ((currentIncomeTotal - previousIncomeTotal) / previousIncomeTotal) * 100;
    expect(incomeChange).toBeCloseTo(8.24, 2); // (9200 - 8500) / 8500 * 100
  });

  test('should handle zero previous year total correctly', () => {
    const currentYearTotal = 5000;
    const previousYearTotal = 0;
    
    const spendingChange = previousYearTotal > 0
      ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
      : 0;
    
    expect(spendingChange).toBe(0);
  });

  test('should identify trends correctly', () => {
    const getTrendDirection = (value: number) => {
      if (value > 5) return 'increasing';
      if (value < -5) return 'decreasing';
      return 'stable';
    };
    
    expect(getTrendDirection(10)).toBe('increasing');
    expect(getTrendDirection(25.64)).toBe('increasing');
    expect(getTrendDirection(-10)).toBe('decreasing');
    expect(getTrendDirection(-25.5)).toBe('decreasing');
    expect(getTrendDirection(3)).toBe('stable');
    expect(getTrendDirection(-3)).toBe('stable');
    expect(getTrendDirection(5)).toBe('stable');
    expect(getTrendDirection(-5)).toBe('stable');
  });

  test('should calculate monthly variance correctly', () => {
    const calculateVariance = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    // January: 1500 vs 1200
    expect(calculateVariance(1500, 1200)).toBeCloseTo(25, 1);
    
    // February: 1800 vs 1400
    expect(calculateVariance(1800, 1400)).toBeCloseTo(28.57, 2);
    
    // With zero previous value
    expect(calculateVariance(1000, 0)).toBe(100);
    expect(calculateVariance(0, 0)).toBe(0);
    
    // Negative variance (spending decreased)
    expect(calculateVariance(1000, 1200)).toBeCloseTo(-16.67, 2);
  });

  test('should handle missing months correctly', () => {
    const spendingData = [
      { month: 'Jan', year: 2024, totalSpending: 1500 },
      { month: 'Mar', year: 2024, totalSpending: 1600 },
      // February is missing
    ];
    
    const fullYearData = monthNames.map(month => {
      const monthData = spendingData.find(d => d.month === month);
      return {
        month,
        spending: monthData?.totalSpending || 0,
      };
    });
    
    expect(fullYearData[0].spending).toBe(1500); // Jan
    expect(fullYearData[1].spending).toBe(0); // Feb (missing)
    expect(fullYearData[2].spending).toBe(1600); // Mar
  });

  test('should calculate savings correctly', () => {
    const monthlyData = [
      { income: 3000, spending: 1500 },
      { income: 3000, spending: 1800 },
      { income: 3200, spending: 1600 },
    ];
    
    const monthlySavings = monthlyData.map(m => m.income - m.spending);
    expect(monthlySavings).toEqual([1500, 1200, 1600]);
    
    const totalSavings = monthlySavings.reduce((sum, s) => sum + s, 0);
    expect(totalSavings).toBe(4300);
    
    const avgMonthlySavings = totalSavings / monthlyData.length;
    expect(avgMonthlySavings).toBeCloseTo(1433.33, 2);
  });

  test('should identify highest spending months', () => {
    const monthlySpending = [
      { month: 'Jan', spending: 1500 },
      { month: 'Feb', spending: 1800 },
      { month: 'Mar', spending: 1200 },
      { month: 'Dec', spending: 2500 }, // Holiday spending
    ];
    
    const highestMonth = monthlySpending.reduce((max, month) => 
      month.spending > max.spending ? month : max
    );
    
    expect(highestMonth.month).toBe('Dec');
    expect(highestMonth.spending).toBe(2500);
    
    // Find all months above average
    const totalSpending = monthlySpending.reduce((sum, m) => sum + m.spending, 0);
    const avgSpending = totalSpending / monthlySpending.length;
    const aboveAverage = monthlySpending.filter(m => m.spending > avgSpending);
    
    expect(avgSpending).toBe(1750);
    expect(aboveAverage).toHaveLength(2); // Feb and Dec
  });

  test('should format currency correctly', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    };
    
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(-500)).toBe('-$500.00');
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});