'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Create a loading component for charts
const ChartLoadingComponent = () => (
  <div className='flex items-center justify-center h-[300px]'>
    <div className='animate-pulse text-muted-foreground'>Loading chart...</div>
  </div>
);

// Lazy load individual Recharts components with proper typing
export const AreaChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.AreaChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const BarChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.BarChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const LineChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.LineChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const PieChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.PieChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const RadarChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.RadarChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const ScatterChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.ScatterChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

export const ComposedChart = dynamic(
  () => import('recharts').then((mod) => ({ default: mod.ComposedChart as any })),
  { ssr: false, loading: ChartLoadingComponent },
);

// Re-export non-chart components directly (these are lightweight)
export {
  Area,
  Bar,
  Line,
  Pie,
  Radar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
  ReferenceArea,
  Brush,
  type TooltipProps,
  type LegendProps,
  type PieLabelRenderProps,
} from 'recharts';

/**
 * Helper to preload Recharts library
 */
export function preloadRecharts() {
  return import('recharts');
}

/**
 * Preload specific chart types
 */
export const preloadChartType = {
  area: () => import('recharts').then((mod) => mod.AreaChart),
  bar: () => import('recharts').then((mod) => mod.BarChart),
  line: () => import('recharts').then((mod) => mod.LineChart),
  pie: () => import('recharts').then((mod) => mod.PieChart),
  radar: () => import('recharts').then((mod) => mod.RadarChart),
  scatter: () => import('recharts').then((mod) => mod.ScatterChart),
  composed: () => import('recharts').then((mod) => mod.ComposedChart),
};
