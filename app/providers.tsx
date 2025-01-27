'use client';

import { Toaster } from '@components/ui/toaster';
import { DatabaseProvider } from '@context/DatabaseContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DatabaseProvider>
      {children}
      <Toaster />
    </DatabaseProvider>
  );
}
