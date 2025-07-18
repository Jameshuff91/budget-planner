/**
 * Performance monitoring utilities for the Budget Planner application
 * Tracks Web Vitals, custom metrics, and provides performance benchmarking
 */

import React from 'react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from 'web-vitals';

type PerformanceMetric = {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
};

type CustomMetric = {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
};

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private customMetrics: Map<string, CustomMetric> = new Map();
  private reportingEndpoint?: string;
  private debugMode: boolean = false;

  constructor(options?: { reportingEndpoint?: string; debug?: boolean }) {
    this.reportingEndpoint = options?.reportingEndpoint;
    this.debugMode = options?.debug || false;
  }

  /**
   * Initialize Web Vitals monitoring
   */
  initWebVitals() {
    // Core Web Vitals
    onCLS(this.handleMetric);
    onLCP(this.handleMetric);

    // Additional metrics
    onFCP(this.handleMetric);
    onINP(this.handleMetric);
    onTTFB(this.handleMetric);
  }

  /**
   * Handle Web Vitals metric reporting
   */
  private handleMetric = (metric: Metric) => {
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating || 'good',
      timestamp: Date.now(),
    };

    this.metrics.set(metric.name, performanceMetric);

    if (this.debugMode) {
      console.log(`[Performance] ${metric.name}:`, metric.value, metric.rating);
    }

    // Report to analytics endpoint if configured
    if (this.reportingEndpoint) {
      this.reportMetric(performanceMetric);
    }
  };

  /**
   * Start measuring a custom performance metric
   */
  startMeasure(name: string) {
    this.customMetrics.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * End measuring a custom performance metric
   */
  endMeasure(name: string): number | null {
    const metric = this.customMetrics.get(name);
    if (!metric) {
      console.warn(`[Performance] No start time found for metric: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    if (this.debugMode) {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Measure the execution time of an async function
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Measure the execution time of a sync function
   */
  measureSync<T>(name: string, fn: () => T): T {
    this.startMeasure(name);
    try {
      const result = fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics() {
    return {
      webVitals: Array.from(this.metrics.values()),
      custom: Array.from(this.customMetrics.values()),
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.customMetrics.clear();
  }

  /**
   * Report metric to analytics endpoint
   */
  private async reportMetric(metric: PerformanceMetric) {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metric,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('[Performance] Failed to report metric:', error);
    }
  }

  /**
   * Log performance report to console
   */
  logReport() {
    const metrics = this.getMetrics();

    console.group('📊 Performance Report');

    if (metrics.webVitals.length > 0) {
      console.group('Web Vitals');
      metrics.webVitals.forEach((metric) => {
        const emoji =
          metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
        console.log(`${emoji} ${metric.name}: ${metric.value.toFixed(2)}`);
      });
      console.groupEnd();
    }

    if (metrics.custom.length > 0) {
      console.group('Custom Metrics');
      metrics.custom.forEach((metric) => {
        if (metric.duration !== undefined) {
          console.log(`⏱️ ${metric.name}: ${metric.duration.toFixed(2)}ms`);
        }
      });
      console.groupEnd();
    }

    console.groupEnd();
  }
}

// Performance benchmarks for critical operations
export const PERFORMANCE_BENCHMARKS = {
  // Page load benchmarks
  INITIAL_LOAD: 3000, // 3 seconds
  ROUTE_CHANGE: 1000, // 1 second

  // Data operation benchmarks
  PDF_PARSE: 5000, // 5 seconds
  CSV_PARSE: 1000, // 1 second
  TRANSACTION_SAVE: 500, // 500ms
  CHART_RENDER: 300, // 300ms

  // UI interaction benchmarks
  BUTTON_CLICK: 100, // 100ms
  FORM_SUBMIT: 200, // 200ms
  MODAL_OPEN: 150, // 150ms
} as const;

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the performance monitor instance
 */
export function getPerformanceMonitor(options?: {
  reportingEndpoint?: string;
  debug?: boolean;
}): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(options);
  }
  return performanceMonitor;
}

/**
 * Performance decorator for React components
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
) {
  return function PerformanceTrackedComponent(props: P) {
    const monitor = getPerformanceMonitor();

    React.useEffect(() => {
      monitor.startMeasure(`${componentName}_mount`);

      return () => {
        monitor.endMeasure(`${componentName}_mount`);
      };
    }, [monitor]);

    return React.createElement(Component, props);
  };
}

/**
 * Hook for measuring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const monitor = getPerformanceMonitor();
  const renderCount = React.useRef(0);

  React.useEffect(() => {
    renderCount.current += 1;
    const metricName = `${componentName}_render_${renderCount.current}`;

    monitor.startMeasure(metricName);

    // Measure after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        monitor.endMeasure(metricName);
      });
    });
  });
}

/**
 * Hook for measuring data fetching performance
 */
export function useDataFetchPerformance(operationName: string) {
  const monitor = getPerformanceMonitor();

  return React.useCallback(
    async <T>(fetchFn: () => Promise<T>): Promise<T> => {
      return monitor.measureAsync(operationName, fetchFn);
    },
    [monitor, operationName],
  );
}

// Re-export web-vitals types for convenience
export type { Metric } from 'web-vitals';

// React is already imported at the top
