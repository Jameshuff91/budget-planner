/**
 * Test file for chart optimization utilities
 */

import {
  shallowCompareProps,
  compareArrayProps,
  getOptimizedAnimationProps,
  optimizeChartData,
  createPerformanceMarker,
  getCachedData,
  clearDataCache,
} from './chartOptimization';

describe('Chart Optimization Utilities', () => {
  describe('shallowCompareProps', () => {
    it('should return true for identical props', () => {
      const props1 = { a: 1, b: 'test', c: true };
      const props2 = { a: 1, b: 'test', c: true };
      expect(shallowCompareProps(props1, props2)).toBe(true);
    });

    it('should return false for different props', () => {
      const props1 = { a: 1, b: 'test' };
      const props2 = { a: 1, b: 'different' };
      expect(shallowCompareProps(props1, props2)).toBe(false);
    });

    it('should return false for different number of props', () => {
      const props1 = { a: 1, b: 'test' };
      const props2 = { a: 1, b: 'test', c: true };
      expect(shallowCompareProps(props1, props2)).toBe(false);
    });
  });

  describe('compareArrayProps', () => {
    it('should return true for identical arrays', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      expect(compareArrayProps(arr1, arr2)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 4];
      expect(compareArrayProps(arr1, arr2)).toBe(false);
    });

    it('should return true for arrays with identical objects by key', () => {
      const arr1 = [
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' },
      ];
      const arr2 = [
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' },
      ];
      expect(compareArrayProps(arr1, arr2, 'id')).toBe(true);
    });
  });

  describe('getOptimizedAnimationProps', () => {
    it('should disable animation for large datasets', () => {
      const props = getOptimizedAnimationProps(200);
      expect(props.isAnimationActive).toBe(false);
      expect(props.animationDuration).toBe(0);
    });

    it('should reduce animation duration for medium datasets', () => {
      const props = getOptimizedAnimationProps(75);
      expect(props.isAnimationActive).toBe(true);
      expect(props.animationDuration).toBe(300);
    });

    it('should use full animation for small datasets', () => {
      const props = getOptimizedAnimationProps(25);
      expect(props.isAnimationActive).toBe(true);
      expect(props.animationDuration).toBe(500);
    });
  });

  describe('optimizeChartData', () => {
    it('should return original data if within limit', () => {
      const data = [{ x: 1 }, { x: 2 }, { x: 3 }];
      const result = optimizeChartData(data, 10);
      expect(result).toEqual(data);
    });

    it('should downsample data if exceeding limit', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ x: i }));
      const result = optimizeChartData(data, 10);
      expect(result.length).toBeLessThanOrEqual(10);
      expect(result[0]).toEqual({ x: 0 });
    });
  });

  describe('createPerformanceMarker', () => {
    it('should measure performance correctly', (done) => {
      const marker = createPerformanceMarker('test');
      setTimeout(() => {
        const duration = marker.end();
        expect(duration).toBeGreaterThan(0);
        done();
      }, 10);
    });
  });

  describe('getCachedData', () => {
    beforeEach(() => {
      clearDataCache();
    });

    it('should cache and return computed data', () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return 'computed-value';
      };

      const result1 = getCachedData('test-key', computeFn);
      const result2 = getCachedData('test-key', computeFn);

      expect(result1).toBe('computed-value');
      expect(result2).toBe('computed-value');
      expect(callCount).toBe(1);
    });

    it('should recompute after cache expiry', () => {
      let callCount = 0;
      const computeFn = () => {
        callCount++;
        return 'computed-value';
      };

      // Mock Date.now to simulate cache expiry
      const originalNow = Date.now;
      Date.now = () => 0;

      getCachedData('test-key', computeFn);

      // Fast forward time beyond cache TTL
      Date.now = () => 6 * 60 * 1000; // 6 minutes

      getCachedData('test-key', computeFn);

      expect(callCount).toBe(2);

      // Restore Date.now
      Date.now = originalNow;
    });
  });
});

describe('Performance Optimization Patterns', () => {
  it('should demonstrate memoization benefits', () => {
    let computeCount = 0;
    const expensiveComputation = (data: number[]) => {
      computeCount++;
      return data.reduce((sum, val) => sum + val, 0);
    };

    const data = [1, 2, 3, 4, 5];
    const key = `sum-${data.join('-')}`;

    // First call should compute
    const result1 = getCachedData(key, () => expensiveComputation(data));
    expect(computeCount).toBe(1);
    expect(result1).toBe(15);

    // Second call should use cache
    const result2 = getCachedData(key, () => expensiveComputation(data));
    expect(computeCount).toBe(1); // Should not increment
    expect(result2).toBe(15);
  });
});
