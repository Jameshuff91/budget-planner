'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <Skeleton className='h-5 w-32' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-8 w-24 mb-2' />
        <Skeleton className='h-4 w-40' />
      </CardContent>
    </Card>
  );
}

export function StatCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      {[...Array(count)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
