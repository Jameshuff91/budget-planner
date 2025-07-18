'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

import { ChartSkeleton } from '@components/skeletons/ChartSkeleton';
import { useRenderPerformance } from '@utils/performance';

// Chart component mapping
const chartComponents = {
  SpendingByCategory: dynamic(
    () => import('@components/SpendingByCategory').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
  SpendingTrend: dynamic(
    () => import('@components/SpendingTrend').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
  SpendingOverview: dynamic(
    () => import('@components/SpendingOverview').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
  SpendingVelocity: dynamic(
    () => import('@components/SpendingVelocity').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
  SpendingByMerchant: dynamic(
    () => import('@components/SpendingByMerchant').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
  YearOverYearComparison: dynamic(
    () => import('@components/YearOverYearComparison').then((mod) => mod.default || mod),
    {
      loading: () => <ChartSkeleton />,
      ssr: false,
    },
  ),
};

export type ChartType = keyof typeof chartComponents;

interface LazyChartProps {
  type: ChartType;
  selectedYear?: number;
  [key: string]: unknown; // Allow passing through any props to the chart component
}

/**
 * Lazy loading wrapper for all chart components
 * Automatically handles code splitting and loading states
 */
export function LazyChart({ type, ...props }: LazyChartProps) {
  useRenderPerformance(`LazyChart_${type}`);

  const ChartComponent = chartComponents[type];

  if (!ChartComponent) {
    console.error(`Unknown chart type: ${type}`);
    return null;
  }

  // Handle specific component prop requirements
  if ((type === 'YearOverYearComparison' || type === 'SpendingVelocity') && !props.selectedYear) {
    console.error(`${type} requires selectedYear prop`);
    return null;
  }

  return (
    <Suspense fallback={<div className='h-96 animate-pulse bg-gray-200 rounded-lg' />}>
      <ChartComponent {...props} selectedYear={props.selectedYear || new Date().getFullYear()} />
    </Suspense>
  );
}

/**
 * Preload a chart component to improve perceived performance
 */
export function preloadChart(type: ChartType) {
  const component = chartComponents[type];
  if (component && 'preload' in component) {
    (component as { preload: () => void }).preload();
  }
}

/**
 * Preload all chart components (use sparingly)
 */
export function preloadAllCharts() {
  Object.keys(chartComponents).forEach((type) => {
    preloadChart(type as ChartType);
  });
}
