'use client';

import { BarChart3, AlertCircle } from 'lucide-react';
import React from 'react';

import ErrorBoundary from './ErrorBoundary';
import { Alert, AlertDescription } from './ui/alert';

interface Props {
  children: React.ReactNode;
  chartName?: string;
}

const ChartErrorFallback = ({ chartName }: { chartName?: string }) => (
  <div className='flex flex-col items-center justify-center h-full min-h-[300px] p-4'>
    <BarChart3 className='h-12 w-12 text-gray-400 mb-3' />
    <Alert className='max-w-md'>
      <AlertCircle className='h-4 w-4' />
      <AlertDescription>
        <p className='font-medium'>Unable to render {chartName || 'chart'}</p>
        <p className='text-sm text-muted-foreground mt-1'>
          This might be due to invalid data or a rendering issue. Try refreshing the page.
        </p>
      </AlertDescription>
    </Alert>
  </div>
);

export function ChartErrorBoundary({ children, chartName }: Props) {
  return (
    <ErrorBoundary fallback={<ChartErrorFallback chartName={chartName} />}>
      {children}
    </ErrorBoundary>
  );
}

export default ChartErrorBoundary;
