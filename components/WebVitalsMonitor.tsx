'use client';

import React, { useEffect, useState } from 'react';

import { getPerformanceMonitor } from '@utils/performance';

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  entries?: PerformanceEntry[];
}

interface WebVitalsMonitorProps {
  reportWebVitals?: (metric: WebVitalsMetric) => void;
  debug?: boolean;
}

/**
 * Component to monitor and report Web Vitals
 * Should be included once in the app, preferably in the root layout
 */
export function WebVitalsMonitor({ reportWebVitals, debug = false }: WebVitalsMonitorProps) {
  useEffect(() => {
    const monitor = getPerformanceMonitor({
      debug,
      reportingEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
    });

    // Initialize Web Vitals monitoring
    monitor.initWebVitals();

    // Custom event listener for performance insights
    const handlePerformanceEntry = (entry: PerformanceEntry) => {
      if (debug) {
        console.log('Performance entry:', entry);
      }

      // Track specific performance patterns
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        monitor.startMeasure('page_load_breakdown');

        // Log detailed timing breakdown
        console.log('Navigation timing:', {
          domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
          loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
          firstPaint: performance.getEntriesByType('paint').find((p) => p.name === 'first-paint')
            ?.startTime,
          firstContentfulPaint: performance
            .getEntriesByType('paint')
            .find((p) => p.name === 'first-contentful-paint')?.startTime,
        });

        monitor.endMeasure('page_load_breakdown');
      }

      // Track resource loading performance
      if (entry.entryType === 'resource') {
        const resource = entry as PerformanceResourceTiming;

        // Track slow resources
        if (resource.duration > 1000) {
          console.warn('Slow resource detected:', {
            name: resource.name,
            duration: resource.duration,
            size: resource.transferSize,
          });
        }
      }
    };

    // Set up performance observer
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(handlePerformanceEntry);
      });

      observer.observe({
        entryTypes: ['navigation', 'resource', 'paint', 'largest-contentful-paint'],
      });

      return () => observer.disconnect();
    }
  }, [debug, reportWebVitals]);

  // Monitor specific user interactions
  useEffect(() => {
    if (!debug) return;

    const trackUserInteractions = () => {
      const monitor = getPerformanceMonitor();

      // Track button clicks
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
          monitor.startMeasure('button_click_response');

          // End measurement after next frame
          requestAnimationFrame(() => {
            monitor.endMeasure('button_click_response');
          });
        }
      });

      // Track form submissions
      document.addEventListener('submit', (_event) => {
        monitor.startMeasure('form_submit_response');

        // End measurement after a short delay to capture processing
        setTimeout(() => {
          monitor.endMeasure('form_submit_response');
        }, 100);
      });
    };

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trackUserInteractions);
    } else {
      trackUserInteractions();
    }
  }, [debug]);

  // Monitor memory usage (if available)
  useEffect(() => {
    if (!debug || !('memory' in performance)) return;

    const logMemoryUsage = () => {
      const memory = (
        performance as unknown as {
          memory: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory;
      console.log('Memory usage:', {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB',
      });
    };

    // Log memory usage every 30 seconds
    const interval = setInterval(logMemoryUsage, 30000);

    return () => clearInterval(interval);
  }, [debug]);

  return null; // This component doesn't render anything
}

/**
 * Hook to track component-specific performance
 */
export function useComponentPerformance(componentName: string) {
  useEffect(() => {
    const monitor = getPerformanceMonitor();
    monitor.startMeasure(`${componentName}_mount`);

    return () => {
      monitor.endMeasure(`${componentName}_mount`);
    };
  }, [componentName]);
}

/**
 * Higher-order component to wrap components with performance tracking
 */
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
) {
  const PerformanceTrackedComponent = (props: P) => {
    useComponentPerformance(componentName);
    return <WrappedComponent {...props} />;
  };

  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${componentName})`;
  return PerformanceTrackedComponent;
}

/**
 * Get suggestion for Web Vital improvement
 */
function getWebVitalSuggestion(metricName: string): string {
  const suggestions: Record<string, string> = {
    CLS: 'Ensure ad elements have reserved space, avoid animations, and use transform for layout changes',
    FID: 'Reduce JavaScript execution time, minimize main thread work, and use code splitting',
    LCP: 'Optimize images, improve server response times, and eliminate render-blocking resources',
    FCP: 'Minimize render-blocking resources, optimize fonts, and reduce server response times',
    TTFB: 'Improve server response times, use a CDN, and optimize database queries',
  };
  return suggestions[metricName] || 'Consider optimizing this metric';
}

/**
 * Performance insights component for development
 */
interface PerformanceInsight {
  type: 'warning' | 'info';
  metric: string;
  message: string;
  suggestion: string;
}

export function PerformanceInsights() {
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const monitor = getPerformanceMonitor();

    const generateInsights = () => {
      const metrics = monitor.getMetrics();
      const newInsights: PerformanceInsight[] = [];

      // Analyze Web Vitals
      metrics.webVitals.forEach((metric) => {
        if (metric.rating === 'poor') {
          newInsights.push({
            type: 'warning',
            metric: metric.name,
            message: `${metric.name} is ${metric.value.toFixed(2)} (poor)`,
            suggestion: getWebVitalSuggestion(metric.name),
          });
        }
      });

      // Analyze custom metrics
      metrics.custom.forEach((metric) => {
        if (metric.duration && metric.duration > 1000) {
          newInsights.push({
            type: 'info',
            metric: metric.name,
            message: `${metric.name} took ${metric.duration.toFixed(2)}ms`,
            suggestion: 'Consider optimizing this operation',
          });
        }
      });

      setInsights(newInsights);
    };

    const interval = setInterval(generateInsights, 5000);
    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development' || insights.length === 0) {
    return null;
  }

  return (
    <div className='fixed top-4 right-4 max-w-sm space-y-2 z-50'>
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`rounded-lg border p-3 text-sm ${
            insight.type === 'warning'
              ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
              : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          <div className='font-medium'>{insight.message}</div>
          <div className='text-xs mt-1'>{insight.suggestion}</div>
        </div>
      ))}
    </div>
  );
}

function getWebVitalSuggestion(metricName: string): string {
  switch (metricName) {
    case 'LCP':
      return 'Optimize images and critical resources loading';
    case 'FID':
      return 'Reduce JavaScript execution time and use code splitting';
    case 'CLS':
      return 'Reserve space for dynamic content and avoid layout shifts';
    case 'TTFB':
      return 'Optimize server response time and use CDN';
    default:
      return 'Check performance optimization guides';
  }
}
