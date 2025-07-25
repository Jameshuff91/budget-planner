'use client';

import { Suspense } from 'react';

import ErrorBoundary from '@components/ErrorBoundary';
import { Toaster } from '@components/ui/toaster';
import { AuthProvider } from '@context/AuthContext';
import { DatabaseProvider } from '@context/DatabaseContext';
import { getPerformanceMonitor } from '@utils/performance';

// Lazy load heavy providers
const LazyDatabaseProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize performance monitoring for database operations
  getPerformanceMonitor();

  return <DatabaseProvider>{children}</DatabaseProvider>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className='flex items-center justify-center min-h-screen'>
            <div className='animate-pulse text-muted-foreground'>Initializing application...</div>
          </div>
        }
      >
        <AuthProvider>
          <LazyDatabaseProvider>
            {children}
            <Toaster />
          </LazyDatabaseProvider>
        </AuthProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
