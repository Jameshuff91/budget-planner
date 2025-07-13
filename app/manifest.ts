import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Budget Planner',
    short_name: 'BudgetPlan',
    description: 'Smart personal finance management with AI-powered categorization',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['finance', 'productivity'],
    shortcuts: [
      {
        name: 'Add Transaction',
        url: '/?tab=transactions',
        description: 'Quickly add a new transaction',
      },
      {
        name: 'View Dashboard',
        url: '/?tab=overview',
        description: 'View your financial overview',
      },
    ],
  };
}
