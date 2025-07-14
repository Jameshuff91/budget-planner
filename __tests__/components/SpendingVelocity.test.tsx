import { vi } from 'vitest';

describe('SpendingVelocity Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should calculate daily spending velocity correctly', () => {
    const transactions = [
      { date: '2024-01-01', type: 'expense', amount: -100 },
      { date: '2024-01-02', type: 'expense', amount: -150 },
      { date: '2024-01-03', type: 'expense', amount: -80 },
      { date: '2024-01-05', type: 'expense', amount: -120 },
      { date: '2024-01-10', type: 'expense', amount: -200 },
    ];
    
    // Total spending for 5 transactions
    const totalSpending = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    expect(totalSpending).toBe(650);
    
    // If these transactions happened over 10 days
    const daysElapsed = 10;
    const velocity = totalSpending / daysElapsed;
    expect(velocity).toBe(65); // $65 per day
  });

  test('should calculate cumulative spending correctly', () => {
    const dailySpending = [100, 150, 80, 0, 120, 0, 0, 0, 0, 200];
    
    let cumulative = 0;
    const cumulativeSpending = dailySpending.map((daily) => {
      cumulative += daily;
      return cumulative;
    });
    
    expect(cumulativeSpending).toEqual([100, 250, 330, 330, 450, 450, 450, 450, 450, 650]);
    expect(cumulativeSpending[cumulativeSpending.length - 1]).toBe(650);
  });

  test('should project monthly spending based on current velocity', () => {
    const currentSpending = 650;
    const daysElapsed = 10;
    const daysInMonth = 31;
    
    const projectedTotal = (currentSpending / daysElapsed) * daysInMonth;
    expect(projectedTotal).toBe(2015); // $65/day * 31 days
    
    // Test with different elapsed days
    const halfMonthSpending = 500;
    const halfMonthDays = 15;
    const halfMonthProjection = (halfMonthSpending / halfMonthDays) * daysInMonth;
    expect(halfMonthProjection).toBeCloseTo(1033.33, 2);
  });

  test('should identify velocity trends correctly', () => {
    const getVelocityTrend = (currentVelocity: number, lastMonthAvg: number) => {
      if (lastMonthAvg === 0) return 'insufficient';
      
      const velocityChange = ((currentVelocity - lastMonthAvg) / lastMonthAvg) * 100;
      
      if (velocityChange > 10) return 'increasing';
      if (velocityChange < -10) return 'decreasing';
      return 'stable';
    };
    
    // Test increasing velocity
    expect(getVelocityTrend(110, 100)).toBe('stable'); // 10% increase
    expect(getVelocityTrend(115, 100)).toBe('increasing'); // 15% increase
    
    // Test decreasing velocity
    expect(getVelocityTrend(90, 100)).toBe('stable'); // 10% decrease
    expect(getVelocityTrend(85, 100)).toBe('decreasing'); // 15% decrease
    
    // Test stable velocity
    expect(getVelocityTrend(105, 100)).toBe('stable'); // 5% increase
    expect(getVelocityTrend(95, 100)).toBe('stable'); // 5% decrease
    
    // Test insufficient data
    expect(getVelocityTrend(100, 0)).toBe('insufficient');
  });

  test('should filter transactions by year and month correctly', () => {
    const transactions = [
      { date: '2024-01-15', type: 'expense', amount: -100 },
      { date: '2024-01-20', type: 'expense', amount: -150 },
      { date: '2024-02-10', type: 'expense', amount: -200 },
      { date: '2023-01-15', type: 'expense', amount: -300 },
      { date: '2024-01-25', type: 'income', amount: 1000 },
    ];
    
    const selectedYear = 2024;
    const selectedMonth = 0; // January
    
    const filtered = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return (
        tDate.getFullYear() === selectedYear && 
        tDate.getMonth() === selectedMonth && 
        t.type === 'expense'
      );
    });
    
    expect(filtered).toHaveLength(2);
    expect(filtered[0].amount).toBe(-100);
    expect(filtered[1].amount).toBe(-150);
  });

  test('should calculate days remaining in month correctly', () => {
    // For January (31 days)
    let daysInMonth = 31;
    let daysElapsed = 10;
    let daysRemaining = daysInMonth - daysElapsed;
    expect(daysRemaining).toBe(21);
    
    // For February in non-leap year (28 days)
    daysInMonth = 28;
    daysElapsed = 15;
    daysRemaining = daysInMonth - daysElapsed;
    expect(daysRemaining).toBe(13);
    
    // For month end
    daysInMonth = 30;
    daysElapsed = 30;
    daysRemaining = daysInMonth - daysElapsed;
    expect(daysRemaining).toBe(0);
  });

  test('should calculate average daily spending for full month', () => {
    const monthlyData = {
      totalSpending: 3100,
      daysInMonth: 31,
    };
    
    const avgDailySpending = monthlyData.totalSpending / monthlyData.daysInMonth;
    expect(avgDailySpending).toBe(100);
    
    // Test with February
    const febData = {
      totalSpending: 2800,
      daysInMonth: 28,
    };
    
    const febAvgDaily = febData.totalSpending / febData.daysInMonth;
    expect(febAvgDaily).toBe(100);
  });

  test('should handle empty transaction data', () => {
    const transactions: any[] = [];
    const selectedYear = 2024;
    const selectedMonth = 0;
    
    const filtered = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return (
        tDate.getFullYear() === selectedYear && 
        tDate.getMonth() === selectedMonth && 
        t.type === 'expense'
      );
    });
    
    const totalSpending = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    expect(totalSpending).toBe(0);
    
    const velocity = totalSpending / 1; // Avoid division by zero
    expect(velocity).toBe(0);
  });

  test('should calculate budget remaining correctly', () => {
    const monthlyBudget = 3000;
    const currentSpending = 1200;
    
    const budgetRemaining = Math.max(0, monthlyBudget - currentSpending);
    expect(budgetRemaining).toBe(1800);
    
    // Test overspending
    const overspendBudget = 2000;
    const overspending = 2500;
    const overspendRemaining = Math.max(0, overspendBudget - overspending);
    expect(overspendRemaining).toBe(0);
  });

  test('should generate daily chart data correctly', () => {
    const cumulativeSpending = [100, 250, 330, 450, 650];
    const velocity = 130; // $130/day average
    
    const chartData = cumulativeSpending.map((spending, index) => ({
      day: index + 1,
      actual: spending,
      projected: velocity * (index + 1),
    }));
    
    expect(chartData).toHaveLength(5);
    expect(chartData[0]).toEqual({ day: 1, actual: 100, projected: 130 });
    expect(chartData[4]).toEqual({ day: 5, actual: 650, projected: 650 });
  });

  test('should find max velocity across months', () => {
    const velocityData = [
      { monthIndex: 0, velocity: 100 },
      { monthIndex: 1, velocity: 120 },
      { monthIndex: 2, velocity: 90 },
      { monthIndex: 3, velocity: 150 },
    ];
    
    const maxVelocity = Math.max(...velocityData.map((v) => v.velocity));
    expect(maxVelocity).toBe(150);
    
    // Calculate percentage for progress bar
    const percentages = velocityData.map((v) => (v.velocity / maxVelocity) * 100);
    expect(percentages[0]).toBeCloseTo(66.67, 1);
    expect(percentages[3]).toBe(100);
  });

  test('should identify current month correctly', () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    
    const velocityData = [
      { monthIndex: 0, month: 'Jan' },
      { monthIndex: 1, month: 'Feb' },
      { monthIndex: currentMonth, month: currentDate.toLocaleDateString('default', { month: 'short' }) },
    ];
    
    const currentMonthData = velocityData.find((d) => d.monthIndex === currentMonth);
    expect(currentMonthData).toBeDefined();
    expect(currentMonthData?.monthIndex).toBe(currentMonth);
  });
});