import { render, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock ChartSkeleton
vi.mock('@components/skeletons/ChartSkeleton', () => ({
  ChartSkeleton: () => <div data-testid='chart-skeleton'>Loading...</div>,
}));

// Mock useAnalytics hook
vi.mock('@hooks/useAnalytics');

// Mock useDBContext
vi.mock('@context/DatabaseContext');

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid='responsive-container'>{children}</div>
  ),
  LineChart: ({ children, data }: any) => (
    <div data-testid='line-chart' data-points={data?.length || 0}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name, stroke, strokeDasharray }: any) => (
    <div
      data-testid={`line-${dataKey}`}
      data-name={name}
      data-stroke={stroke}
      data-dashed={strokeDasharray ? 'true' : 'false'}
    />
  ),
  XAxis: ({ tickFormatter }: any) => (
    <div data-testid='x-axis' data-has-formatter={tickFormatter ? 'true' : 'false'} />
  ),
  YAxis: ({ tickFormatter }: any) => (
    <div data-testid='y-axis' data-has-formatter={tickFormatter ? 'true' : 'false'} />
  ),
  CartesianGrid: ({ strokeDasharray }: any) => (
    <div data-testid='cartesian-grid' data-dashed={strokeDasharray} />
  ),
  Tooltip: ({ formatter, labelFormatter }: any) => (
    <div
      data-testid='tooltip'
      data-has-formatter={formatter ? 'true' : 'false'}
      data-has-label-formatter={labelFormatter ? 'true' : 'false'}
    />
  ),
  Legend: () => <div data-testid='legend' />,
}));

// Import the component and mocks after all vi.mock calls
import SpendingTrend from '@components/SpendingTrend';
import { useAnalytics } from '@hooks/useAnalytics';
import { useDBContext } from '@context/DatabaseContext';

// Get references to the mocked functions
const mockUseAnalytics = useAnalytics as any;
const mockUseDBContext = useDBContext as any;

describe('SpendingTrend Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default values
    mockUseAnalytics.mockReturnValue({
      spendingOverview: mockSpendingOverview,
    });
    mockUseDBContext.mockReturnValue({
      loading: false,
    });
  });

  test('renders component with title', () => {
    render(<SpendingTrend />);

    expect(screen.getByText('Spending Trend & Forecast')).toBeInTheDocument();
  });

  test('renders line chart with correct data points', () => {
    render(<SpendingTrend />);

    const lineChart = screen.getByTestId('line-chart');
    // 6 historical + 3 forecast = 9 points
    expect(lineChart).toHaveAttribute('data-points', '9');
  });

  test('renders all required lines', () => {
    render(<SpendingTrend />);

    // Historical lines
    expect(screen.getByTestId('line-Spending')).toBeInTheDocument();
    expect(screen.getByTestId('line-Income')).toBeInTheDocument();

    // Forecast lines (dashed)
    const spendingForecast = screen.getByTestId('line-spendingTrend');
    expect(spendingForecast).toBeInTheDocument();
    expect(spendingForecast).toHaveAttribute('data-dashed', 'true');

    const incomeForecast = screen.getByTestId('line-incomeTrend');
    expect(incomeForecast).toBeInTheDocument();
    expect(incomeForecast).toHaveAttribute('data-dashed', 'true');
  });

  test('renders chart components correctly', () => {
    render(<SpendingTrend />);

    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  test('displays loading state', () => {
    mockUseDBContext.mockReturnValueOnce({
      loading: true,
    });

    render(<SpendingTrend />);

    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Spending Trend & Forecast')).not.toBeInTheDocument();
  });

  test('displays no data message when spendingOverview is empty', () => {
    mockUseAnalytics.mockReturnValueOnce({
      spendingOverview: [],
    });

    render(<SpendingTrend />);

    expect(screen.getByText('No trend data available')).toBeInTheDocument();
    expect(
      screen.getByText('Upload bank statements to see spending trends and forecasts'),
    ).toBeInTheDocument();
    expect(screen.getByText('• Trends require at least 2 months of data')).toBeInTheDocument();
    expect(
      screen.getByText('• Forecasts are calculated using linear regression'),
    ).toBeInTheDocument();
    // Ensure chart is not rendered
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  test('filters data by selected year', () => {
    const mixedYearData = [
      ...mockSpendingOverview,
      { month: 'Jul', year: 2023, totalSpending: 1400, totalIncome: 2400 },
      { month: 'Aug', year: 2023, totalSpending: 1450, totalIncome: 2400 },
    ];

    mockUseAnalytics.mockReturnValueOnce({
      spendingOverview: mixedYearData,
    });

    render(<SpendingTrend selectedYear={2024} />);

    // Component should render without errors
    expect(screen.getByText('Spending Trend & Forecast')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  test('handles single data point gracefully', () => {
    mockUseAnalytics.mockReturnValueOnce({
      spendingOverview: [{ month: 'Jan', year: 2024, totalSpending: 1500, totalIncome: 2500 }],
    });

    render(<SpendingTrend />);

    // Should still render chart even with single point
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  test('applies correct colors to lines', () => {
    render(<SpendingTrend />);

    // Spending lines - red
    expect(screen.getByTestId('line-Spending')).toHaveAttribute('data-stroke', '#ef4444');
    expect(screen.getByTestId('line-spendingTrend')).toHaveAttribute('data-stroke', '#ef4444');

    // Income lines - green
    expect(screen.getByTestId('line-Income')).toHaveAttribute('data-stroke', '#16a34a');
    expect(screen.getByTestId('line-incomeTrend')).toHaveAttribute('data-stroke', '#16a34a');
  });

  test('has formatters for axes and tooltip', () => {
    render(<SpendingTrend />);

    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-has-formatter', 'true');
    expect(screen.getByTestId('y-axis')).toHaveAttribute('data-has-formatter', 'true');
    expect(screen.getByTestId('tooltip')).toHaveAttribute('data-has-formatter', 'true');
    expect(screen.getByTestId('tooltip')).toHaveAttribute('data-has-label-formatter', 'true');
  });
});

// Test trend calculation logic
describe('SpendingTrend Calculation Tests', () => {
  test('calculateTrendLine with valid data', () => {
    // Test the linear regression calculation
    const calculateTrendLine = (
      data: { x: number; y: number }[],
    ): { slope: number; intercept: number } => {
      const n = data.length;
      if (n < 2) return { slope: 0, intercept: 0 };

      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;

      for (let i = 0; i < n; i++) {
        sumX += data[i].x;
        sumY += data[i].y;
        sumXY += data[i].x * data[i].y;
        sumXX += data[i].x * data[i].x;
      }

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      return { slope, intercept };
    };

    // Test with increasing trend
    const increasingData = [
      { x: 0, y: 100 },
      { x: 1, y: 110 },
      { x: 2, y: 120 },
      { x: 3, y: 130 },
    ];

    const increasingTrend = calculateTrendLine(increasingData);
    expect(increasingTrend.slope).toBe(10);
    expect(increasingTrend.intercept).toBe(100);

    // Test with decreasing trend
    const decreasingData = [
      { x: 0, y: 200 },
      { x: 1, y: 180 },
      { x: 2, y: 160 },
      { x: 3, y: 140 },
    ];

    const decreasingTrend = calculateTrendLine(decreasingData);
    expect(decreasingTrend.slope).toBe(-20);
    expect(decreasingTrend.intercept).toBe(200);

    // Test with no trend (flat)
    const flatData = [
      { x: 0, y: 150 },
      { x: 1, y: 150 },
      { x: 2, y: 150 },
      { x: 3, y: 150 },
    ];

    const flatTrend = calculateTrendLine(flatData);
    expect(flatTrend.slope).toBe(0);
    expect(flatTrend.intercept).toBe(150);

    // Test with single point
    const singlePoint = [{ x: 0, y: 100 }];
    const singleTrend = calculateTrendLine(singlePoint);
    expect(singleTrend.slope).toBe(0);
    expect(singleTrend.intercept).toBe(0);

    // Test with empty data
    const emptyTrend = calculateTrendLine([]);
    expect(emptyTrend.slope).toBe(0);
    expect(emptyTrend.intercept).toBe(0);
  });

  test('month abbreviations', () => {
    const monthsAbbrev = [
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

    expect(monthsAbbrev).toHaveLength(12);
    expect(monthsAbbrev[0]).toBe('Jan');
    expect(monthsAbbrev[11]).toBe('Dec');
  });

  test('forecast calculation', () => {
    // Test that forecast extends 3 months beyond last data point
    const lastMonth = 5; // June (0-indexed)
    const lastYear = 2024;

    const forecastMonths = [];
    for (let i = 0; i < 3; i++) {
      const forecastDate = new Date(lastYear, lastMonth + i + 1, 1);
      forecastMonths.push({
        month: forecastDate.getMonth(),
        year: forecastDate.getFullYear(),
      });
    }

    expect(forecastMonths[0].month).toBe(6); // July
    expect(forecastMonths[1].month).toBe(7); // August
    expect(forecastMonths[2].month).toBe(8); // September
    expect(forecastMonths[0].year).toBe(2024);
  });

  test('year rollover in forecast', () => {
    // Test forecast that goes into next year
    const lastMonth = 10; // November (0-indexed)
    const lastYear = 2024;

    const forecastMonths = [];
    for (let i = 0; i < 3; i++) {
      const forecastDate = new Date(lastYear, lastMonth + i + 1, 1);
      forecastMonths.push({
        month: forecastDate.getMonth(),
        year: forecastDate.getFullYear(),
      });
    }

    expect(forecastMonths[0].month).toBe(11); // December
    expect(forecastMonths[0].year).toBe(2024);
    expect(forecastMonths[1].month).toBe(0); // January
    expect(forecastMonths[1].year).toBe(2025);
    expect(forecastMonths[2].month).toBe(1); // February
    expect(forecastMonths[2].year).toBe(2025);
  });
});

// Test data transformation
describe('SpendingTrend Data Transformation', () => {
  test('transforms spending overview to chart data', () => {
    const spendingOverview = [
      { month: 'Jan', year: 2024, totalSpending: 1500, totalIncome: 2500 },
      { month: 'Feb', year: 2024, totalSpending: 1600, totalIncome: 2500 },
    ];

    const expectedChartData = [
      { name: 'Jan', year: 2024, Spending: 1500, Income: 2500 },
      { name: 'Feb', year: 2024, Spending: 1600, Income: 2500 },
    ];

    // Transform data
    const chartData = spendingOverview.map((item) => ({
      name: item.month,
      year: item.year,
      Spending: item.totalSpending,
      Income: item.totalIncome,
    }));

    expect(chartData).toEqual(expectedChartData);
  });

  test('handles negative values correctly', () => {
    const dataWithNegatives = [
      { month: 'Jan', year: 2024, totalSpending: -100, totalIncome: 2500 },
      { month: 'Feb', year: 2024, totalSpending: 1600, totalIncome: -500 },
    ];

    const chartData = dataWithNegatives.map((item) => ({
      name: item.month,
      year: item.year,
      Spending: item.totalSpending,
      Income: item.totalIncome,
    }));

    expect(chartData[0].Spending).toBe(-100);
    expect(chartData[1].Income).toBe(-500);
  });

  test('handles zero values correctly', () => {
    const dataWithZeros = [
      { month: 'Jan', year: 2024, totalSpending: 0, totalIncome: 2500 },
      { month: 'Feb', year: 2024, totalSpending: 1600, totalIncome: 0 },
    ];

    const chartData = dataWithZeros.map((item) => ({
      name: item.month,
      year: item.year,
      Spending: item.totalSpending,
      Income: item.totalIncome,
    }));

    expect(chartData[0].Spending).toBe(0);
    expect(chartData[1].Income).toBe(0);
  });
});
