/**
 * Chart optimization utilities for performance enhancement
 * Includes React.memo comparison functions, data transformation helpers,
 * and performance measurement tools
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { logger } from '../services/logger';

// Performance measurement utilities
export const createPerformanceMarker = (name: string) => {
  const startTime = performance.now();
  return {
    end: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      logger.info(`Performance [${name}]: ${duration.toFixed(2)}ms`);
      return duration;
    },
  };
};

export const usePerformanceTracker = () => {
  const markers = useRef<Map<string, number>>(new Map());

  const startMeasure = useCallback((name: string) => {
    markers.current.set(name, performance.now());
  }, []);

  const endMeasure = useCallback((name: string) => {
    const startTime = markers.current.get(name);
    if (startTime) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      logger.info(`Performance [${name}]: ${duration.toFixed(2)}ms`);
      markers.current.delete(name);
      return duration;
    }
    return 0;
  }, []);

  return { startMeasure, endMeasure };
};

// React.memo comparison functions for different prop types
export const shallowCompareProps = <T extends Record<string, any>>(
  prevProps: T,
  nextProps: T,
): boolean => {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
};

export const compareArrayProps = (
  prevArray: any[],
  nextArray: any[],
  compareKey?: string,
): boolean => {
  if (prevArray.length !== nextArray.length) {
    return false;
  }

  for (let i = 0; i < prevArray.length; i++) {
    const prevItem = prevArray[i];
    const nextItem = nextArray[i];

    if (compareKey) {
      if (prevItem[compareKey] !== nextItem[compareKey]) {
        return false;
      }
    } else if (prevItem !== nextItem) {
      return false;
    }
  }

  return true;
};

export const compareTimeRangeProps = (
  prevTimeRange?: { startDate?: Date; endDate?: Date },
  nextTimeRange?: { startDate?: Date; endDate?: Date },
): boolean => {
  if (!prevTimeRange && !nextTimeRange) return true;
  if (!prevTimeRange || !nextTimeRange) return false;

  return (
    prevTimeRange.startDate?.getTime() === nextTimeRange.startDate?.getTime() &&
    prevTimeRange.endDate?.getTime() === nextTimeRange.endDate?.getTime()
  );
};

// Data transformation utilities with memoization helpers
export const createDataTransformer = <TInput, TOutput>(
  transformer: (data: TInput) => TOutput,
  dependencyExtractor?: (data: TInput) => any[],
) => {
  return (data: TInput): TOutput => {
    return useMemo(() => {
      const marker = createPerformanceMarker('dataTransformation');
      const result = transformer(data);
      marker.end();
      return result;
    }, dependencyExtractor ? dependencyExtractor(data) : [data]);
  };
};

// Chart-specific optimization helpers
export const optimizeChartData = <T extends Record<string, any>>(
  data: T[],
  maxDataPoints: number = 1000,
): T[] => {
  if (data.length <= maxDataPoints) {
    return data;
  }

  // Simple downsampling - take every nth item
  const step = Math.ceil(data.length / maxDataPoints);
  const optimized = data.filter((_, index) => index % step === 0);

  logger.info(
    `Chart data optimized: ${data.length} -> ${optimized.length} points (step: ${step})`,
  );

  return optimized;
};

export const memoizeChartProps = <T>(props: T, deps: any[]): T => {
  return useMemo(() => props, deps);
};

// Animation control utilities
export const getOptimizedAnimationProps = (
  dataLength: number,
  forceDisable: boolean = false,
): { animationBegin?: number; animationDuration?: number; isAnimationActive?: boolean } => {
  if (forceDisable || dataLength > 100) {
    return {
      animationBegin: 0,
      animationDuration: 0,
      isAnimationActive: false,
    };
  }

  if (dataLength > 50) {
    return {
      animationBegin: 0,
      animationDuration: 300,
      isAnimationActive: true,
    };
  }

  return {
    animationBegin: 0,
    animationDuration: 500,
    isAnimationActive: true,
  };
};

// Virtual scrolling helper for large datasets
export const useVirtualizedData = <T>(
  data: T[],
  visibleRange: { start: number; end: number },
  bufferSize: number = 10,
): T[] => {
  return useMemo(() => {
    const startIndex = Math.max(0, visibleRange.start - bufferSize);
    const endIndex = Math.min(data.length, visibleRange.end + bufferSize);
    return data.slice(startIndex, endIndex);
  }, [data, visibleRange.start, visibleRange.end, bufferSize]);
};

// Debounced update hook for expensive operations
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Chart color optimization - reuse color objects
const COLOR_CACHE = new Map<string, string>();

export const getOptimizedColor = (key: string, colors: string[]): string => {
  if (COLOR_CACHE.has(key)) {
    return COLOR_CACHE.get(key)!;
  }

  const colorIndex = Math.abs(hashString(key)) % colors.length;
  const color = colors[colorIndex];
  COLOR_CACHE.set(key, color);
  return color;
};

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
};

// Recharts-specific optimization props
export const getOptimizedRechartProps = (dataLength: number) => ({
  ...getOptimizedAnimationProps(dataLength),
  syncId: dataLength > 100 ? undefined : 'charts', // Disable sync for large datasets
  margin: dataLength > 200 ? { top: 5, right: 5, left: 20, bottom: 20 } : undefined,
});

// Performance monitoring component
export interface PerformanceMetrics {
  renderTime: number;
  dataTransformTime: number;
  totalTime: number;
}

export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
) => {
  const WrappedComponent = React.memo((props: P) => {
    const renderStartTime = useRef<number>();
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

    useEffect(() => {
      renderStartTime.current = performance.now();
    });

    useEffect(() => {
      if (renderStartTime.current) {
        const totalTime = performance.now() - renderStartTime.current;
        const newMetrics: PerformanceMetrics = {
          renderTime: totalTime,
          dataTransformTime: 0, // This would be set by data transformation functions
          totalTime,
        };
        setMetrics(newMetrics);
        logger.info(`Component [${componentName}] render time:`, newMetrics);
      }
    });

    return React.createElement(Component, props);
  });

  return WrappedComponent;
};

// Data cache for expensive computations
const DATA_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getCachedData = <T>(key: string, computeFn: () => T): T => {
  const now = Date.now();
  const cached = DATA_CACHE.get(key);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = computeFn();
  DATA_CACHE.set(key, { data, timestamp: now });
  return data;
};

export const clearDataCache = (keyPrefix?: string) => {
  if (keyPrefix) {
    for (const key of DATA_CACHE.keys()) {
      if (key.startsWith(keyPrefix)) {
        DATA_CACHE.delete(key);
      }
    }
  } else {
    DATA_CACHE.clear();
  }
};