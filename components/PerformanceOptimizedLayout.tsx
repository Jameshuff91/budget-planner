'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { preloadCriticalComponents, preloadFunctions } from '@components/lazy/LazyComponents';
import { getPerformanceMonitor } from '@utils/performance';

interface PerformanceOptimizedLayoutProps {
  children: React.ReactNode;
}

// Navigation links with preloading configuration
const navigationConfig = [
  {
    href: '/',
    label: 'Dashboard',
    preload: ['charts', 'transactions'],
    priority: 'high' as const,
  },
  {
    href: '/upload',
    label: 'Upload',
    preload: ['pdf', 'csv'],
    priority: 'medium' as const,
  },
  {
    href: '/budget',
    label: 'Budget',
    preload: ['budget'],
    priority: 'medium' as const,
  },
  {
    href: '/connect',
    label: 'Connect Bank',
    preload: ['plaid'],
    priority: 'low' as const,
  },
];

export function PerformanceOptimizedLayout({ children }: PerformanceOptimizedLayoutProps) {
  const router = useRouter();
  const monitor = getPerformanceMonitor({ debug: process.env.NODE_ENV === 'development' });

  // Initialize performance monitoring
  useEffect(() => {
    monitor.initWebVitals();

    // Preload critical components after initial load
    preloadCriticalComponents();

    // Report performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        monitor.logReport();
      }, 5000);
    }
  }, [monitor]);

  // Handle route prefetching with performance tracking
  const handleLinkHover = (linkConfig: (typeof navigationConfig)[0]) => {
    monitor.startMeasure(`prefetch_${linkConfig.href}`);

    // Prefetch the route
    router.prefetch(linkConfig.href);

    // Preload associated components
    linkConfig.preload.forEach((componentKey) => {
      const preloadFn = preloadFunctions[componentKey as keyof typeof preloadFunctions];
      if (preloadFn) {
        preloadFn().then(() => {
          monitor.endMeasure(`prefetch_${linkConfig.href}`);
        });
      }
    });
  };

  // Handle route changes with performance tracking
  const handleLinkClick = (href: string) => {
    monitor.startMeasure(`route_change_${href}`);

    // The measurement will be completed when the new page loads
    const completeRouteChange = () => {
      requestAnimationFrame(() => {
        monitor.endMeasure(`route_change_${href}`);
      });
    };

    // Complete measurement after a short delay to account for rendering
    setTimeout(completeRouteChange, 100);
  };

  return (
    <div className='min-h-screen bg-background'>
      {/* Navigation with smart prefetching */}
      <nav className='border-b'>
        <div className='container mx-auto px-4'>
          <div className='flex h-16 items-center space-x-8'>
            <div className='font-semibold'>Budget Planner</div>
            <div className='flex space-x-4'>
              {navigationConfig.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className='text-sm font-medium transition-colors hover:text-primary'
                  onMouseEnter={() => handleLinkHover(link)}
                  onClick={() => handleLinkClick(link.href)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content with performance boundary */}
      <main className='container mx-auto px-4 py-8'>
        <PerformanceBoundary>{children}</PerformanceBoundary>
      </main>

      {/* Performance debug panel (development only) */}
      {process.env.NODE_ENV === 'development' && <PerformanceDebugPanel monitor={monitor} />}
    </div>
  );
}

// Error boundary with performance tracking
interface PerformanceBoundaryState {
  hasError: boolean;
  error?: Error;
}

class PerformanceBoundary extends React.Component<
  { children: React.ReactNode },
  PerformanceBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): PerformanceBoundaryState {
    const monitor = getPerformanceMonitor();
    monitor.startMeasure('error_recovery');

    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const monitor = getPerformanceMonitor();

    console.error('Performance boundary caught error:', error, errorInfo);

    // Track error in performance monitoring
    monitor.endMeasure('error_recovery');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <h2 className='text-lg font-semibold text-red-800'>Something went wrong</h2>
          <p className='text-red-600'>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className='mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700'
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Development performance debug panel
interface PerformanceDebugPanelProps {
  monitor: ReturnType<typeof getPerformanceMonitor>;
}

function PerformanceDebugPanel({ monitor }: PerformanceDebugPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [metrics, setMetrics] = React.useState<any>(null);

  const refreshMetrics = () => {
    setMetrics(monitor.getMetrics());
  };

  React.useEffect(() => {
    if (isOpen) {
      refreshMetrics();
      const interval = setInterval(refreshMetrics, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        className='fixed bottom-4 right-4 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700'
        onClick={() => setIsOpen(true)}
        title='Open Performance Debug Panel'
      >
        📊
      </button>
    );
  }

  return (
    <div className='fixed bottom-4 right-4 w-80 rounded-lg border bg-white p-4 shadow-lg'>
      <div className='mb-2 flex items-center justify-between'>
        <h3 className='font-semibold'>Performance Debug</h3>
        <button className='text-gray-500 hover:text-gray-700' onClick={() => setIsOpen(false)}>
          ✕
        </button>
      </div>

      <div className='max-h-60 overflow-y-auto text-xs'>
        {metrics?.webVitals?.length > 0 && (
          <div className='mb-2'>
            <strong>Web Vitals:</strong>
            {metrics.webVitals.map((metric: any, index: number) => (
              <div key={index} className='ml-2'>
                {metric.name}: {metric.value.toFixed(2)} ({metric.rating})
              </div>
            ))}
          </div>
        )}

        {metrics?.custom?.length > 0 && (
          <div>
            <strong>Custom Metrics:</strong>
            {metrics.custom.map((metric: any, index: number) => (
              <div key={index} className='ml-2'>
                {metric.name}: {metric.duration?.toFixed(2)}ms
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='mt-2 flex space-x-2'>
        <button
          className='rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700'
          onClick={refreshMetrics}
        >
          Refresh
        </button>
        <button
          className='rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700'
          onClick={() => monitor.clearMetrics()}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
