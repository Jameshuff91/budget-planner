'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-72 mt-2' />
      </CardHeader>
      <CardContent>
        <div className='h-[350px] w-full relative'>
          {/* Y-axis labels */}
          <div className='absolute left-0 top-0 bottom-0 flex flex-col justify-between w-8'>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className='h-3 w-8' />
            ))}
          </div>

          {/* Chart area */}
          <div className='ml-12 h-full flex items-end justify-between gap-2'>
            {[...Array(12)].map((_, i) => (
              <div key={i} className='flex-1 flex flex-col justify-end'>
                <Skeleton className='w-full' style={{ height: `${Math.random() * 60 + 20}%` }} />
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className='ml-12 mt-2 flex justify-between'>
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className='h-3 w-6' />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
