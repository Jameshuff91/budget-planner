'use client';

import { Brain } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';

export function AICategoryIndicator() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const checkSettings = () => {
      const enabled = localStorage.getItem('smartCategorization.enabled') === 'true';
      const apiKey = localStorage.getItem('smartCategorization.apiKey');
      setIsEnabled(enabled && !!apiKey);
    };

    // Check on mount
    checkSettings();

    // Listen for storage changes (in case settings are updated in another tab)
    const handleStorageChange = () => checkSettings();
    window.addEventListener('storage', handleStorageChange);

    // Also check when the page becomes visible (in case settings were changed in the same tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) checkSettings();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!isEnabled) return null;

  return (
    <Badge variant='secondary' className='flex items-center gap-1 bg-purple-100 text-purple-700'>
      <Brain className='h-3 w-3' />
      AI Categorization Active
    </Badge>
  );
}
