'use client';

import { Auth } from '@components/Auth';
import SettingsPage from '@components/SettingsPage';
import { useAuth } from '@context/AuthContext';

export default function Settings() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <main className='flex min-h-screen flex-col items-center justify-center'>
        <div className='animate-pulse text-muted-foreground'>Loading...</div>
      </main>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <main className='flex min-h-screen flex-col items-center justify-center p-4'>
        <Auth onSuccess={() => window.location.reload()} />
      </main>
    );
  }

  return <SettingsPage />;
}
