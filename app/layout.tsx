import type { Metadata } from 'next';
import localFont from 'next/font/local';
import dynamic from 'next/dynamic';

import './globals.css';
import { Providers } from './providers';

// Lazy load performance monitoring components
const WebVitalsMonitor = dynamic(
  () => import('@components/WebVitalsMonitor').then((mod) => ({ default: mod.WebVitalsMonitor })),
  {
    ssr: false,
  },
);

const PerformanceInsights = dynamic(
  () =>
    import('@components/WebVitalsMonitor').then((mod) => ({ default: mod.PerformanceInsights })),
  {
    ssr: false,
  },
);

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap', // Improve font loading performance
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap', // Improve font loading performance
});

export const metadata: Metadata = {
  title: 'Budget Planner',
  description:
    'Track and manage your finances with advanced analytics and AI-powered categorization',
  keywords: 'budget, finance, money management, expense tracking, financial planning',
  authors: [{ name: 'Budget Planner Team' }],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Budget Planner',
    description: 'Track and manage your finances with advanced analytics',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}

          {/* Performance monitoring components */}
          <WebVitalsMonitor debug={process.env.NODE_ENV === 'development'} />
          <PerformanceInsights />
        </Providers>
      </body>
    </html>
  );
}
