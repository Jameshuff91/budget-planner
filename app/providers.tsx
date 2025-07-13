'use client';

import ErrorBoundary from '@components/ErrorBoundary';
import { Toaster } from '@components/ui/toaster';
import { DatabaseProvider } from '@context/DatabaseContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        {children}
        <Toaster />
      </DatabaseProvider>
    </ErrorBoundary>
  );
}
