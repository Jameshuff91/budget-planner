'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';
import { ChartSkeleton } from '@components/skeletons/ChartSkeleton';
import { useRenderPerformance } from '@utils/performance';

// Create different loading components for different component types
const DefaultLoadingComponent = () => (
  <div className='flex items-center justify-center h-32'>
    <div className='animate-pulse text-muted-foreground'>Loading...</div>
  </div>
);

const FormLoadingComponent = () => (
  <div className='space-y-4'>
    <div className='h-4 bg-gray-200 rounded animate-pulse'></div>
    <div className='h-10 bg-gray-200 rounded animate-pulse'></div>
    <div className='h-4 bg-gray-200 rounded animate-pulse w-3/4'></div>
  </div>
);

const PDFLoadingComponent = () => (
  <div className='border-2 border-dashed border-gray-300 rounded-lg p-8'>
    <div className='text-center'>
      <div className='animate-pulse text-muted-foreground'>Loading PDF processor...</div>
    </div>
  </div>
);

// Lazy load heavy UI components
export const LazyPDFUpload = dynamic(() => import('@components/PDFUpload'), {
  loading: PDFLoadingComponent,
  ssr: false,
});

export const LazyCSVUpload = dynamic(() => import('@components/CSVUpload'), {
  loading: FormLoadingComponent,
  ssr: false,
});

export const LazyPlaidConnection = dynamic(() => import('@components/PlaidConnection'), {
  loading: FormLoadingComponent,
  ssr: false,
});

export const LazyBudgetManagementPage = dynamic(() => import('@components/BudgetManagementPage'), {
  loading: DefaultLoadingComponent,
  ssr: false,
});

export const LazyTransactionList = dynamic(() => import('@components/TransactionList'), {
  loading: DefaultLoadingComponent,
  ssr: false,
});

export const LazyRecurringTransactionsView = dynamic(
  () => import('@components/RecurringTransactionsView'),
  {
    loading: DefaultLoadingComponent,
    ssr: false,
  },
);

export const LazyNetWorthSummary = dynamic(() => import('@components/NetWorthSummary'), {
  loading: ChartSkeleton,
  ssr: false,
});

// Chart components with performance tracking
export const LazySpendingByCategory = dynamic(() => import('@components/SpendingByCategory'), {
  loading: ChartSkeleton,
  ssr: false,
});

export const LazySpendingTrend = dynamic(() => import('@components/SpendingTrend'), {
  loading: ChartSkeleton,
  ssr: false,
});

export const LazySpendingOverview = dynamic(() => import('@components/SpendingOverview'), {
  loading: ChartSkeleton,
  ssr: false,
});

export const LazySpendingVelocity = dynamic(() => import('@components/SpendingVelocity'), {
  loading: ChartSkeleton,
  ssr: false,
});

export const LazySpendingByMerchant = dynamic(() => import('@components/SpendingByMerchant'), {
  loading: ChartSkeleton,
  ssr: false,
});

// Conditional lazy loading wrapper
interface ConditionalLazyComponentProps {
  condition: boolean;
  component: React.ComponentType<any>;
  fallback?: React.ComponentType<any>;
  loadingComponent?: React.ComponentType<any>;
  children?: React.ReactNode;
  [key: string]: any;
}

/**
 * Conditionally lazy load components based on a condition
 */
export function ConditionalLazyComponent({
  condition,
  component: Component,
  fallback: Fallback,
  loadingComponent: Loading = DefaultLoadingComponent,
  children,
  ...props
}: ConditionalLazyComponentProps) {
  useRenderPerformance('ConditionalLazyComponent');

  if (!condition) {
    return Fallback ? <Fallback {...props}>{children}</Fallback> : null;
  }

  return (
    <Suspense fallback={<Loading />}>
      <Component {...props}>{children}</Component>
    </Suspense>
  );
}

// Performance-optimized component wrapper
interface PerformanceOptimizedComponentProps {
  componentName: string;
  children: React.ReactNode;
  preload?: boolean;
}

/**
 * Wrapper that adds performance tracking to components
 */
export function PerformanceOptimizedComponent({
  componentName,
  children,
  preload = false,
}: PerformanceOptimizedComponentProps) {
  useRenderPerformance(componentName);

  // Preload component dependencies if requested
  React.useEffect(() => {
    if (preload) {
      // Dynamic import to preload dependencies
      import('@utils/performance').then(({ getPerformanceMonitor }) => {
        const monitor = getPerformanceMonitor();
        monitor.startMeasure(`${componentName}_preload`);

        // Preload can include specific logic here
        requestIdleCallback(() => {
          monitor.endMeasure(`${componentName}_preload`);
        });
      });
    }
  }, [preload, componentName]);

  return <>{children}</>;
}

// Intersection Observer based lazy loading
interface InViewLazyComponentProps {
  component: React.ComponentType<any>;
  fallback?: React.ComponentType<any>;
  rootMargin?: string;
  threshold?: number;
  [key: string]: any;
}

/**
 * Load component only when it comes into view
 */
export function InViewLazyComponent({
  component: Component,
  fallback: Fallback = DefaultLoadingComponent,
  rootMargin = '100px',
  threshold = 0.1,
  ...props
}: InViewLazyComponentProps) {
  const [isInView, setIsInView] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold,
      },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  React.useEffect(() => {
    if (isInView && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isInView, isLoaded]);

  return (
    <div ref={ref}>
      {isLoaded ? (
        <Suspense fallback={<Fallback />}>
          <Component {...props} />
        </Suspense>
      ) : (
        <Fallback />
      )}
    </div>
  );
}

// Preload functions for critical components
export const preloadFunctions = {
  pdf: () => import('@components/PDFUpload'),
  csv: () => import('@components/CSVUpload'),
  plaid: () => import('@components/PlaidConnection'),
  charts: () =>
    Promise.all([
      import('@components/SpendingByCategory'),
      import('@components/SpendingTrend'),
      import('@components/SpendingOverview'),
    ]),
  budget: () => import('@components/BudgetManagementPage'),
  transactions: () => import('@components/TransactionList'),
};

/**
 * Preload critical components for better performance
 */
export function preloadCriticalComponents() {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback to preload during idle time
    const preload = () => {
      preloadFunctions.charts();
      preloadFunctions.transactions();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 1000);
    }
  }
}
