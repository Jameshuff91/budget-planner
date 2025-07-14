'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';

export function TransactionListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-7 w-48' />
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-32' />
            <Skeleton className='h-9 w-32' />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Search and Filter */}
          <div className='flex gap-4'>
            <Skeleton className='h-10 flex-1' />
            <Skeleton className='h-10 w-40' />
          </div>

          {/* Table Header */}
          <div className='border rounded-md'>
            <div className='border-b bg-muted/50 p-4'>
              <div className='grid grid-cols-5 gap-4'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-20 ml-auto' />
                <Skeleton className='h-4 w-16 ml-auto' />
              </div>
            </div>

            {/* Table Rows */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className='border-b p-4 last:border-0'>
                <div className='grid grid-cols-5 gap-4 items-center'>
                  <Skeleton className='h-4 w-20' />
                  <Skeleton className='h-4 w-40' />
                  <Skeleton className='h-6 w-24' />
                  <Skeleton className='h-4 w-16 ml-auto' />
                  <div className='flex gap-2 ml-auto'>
                    <Skeleton className='h-8 w-8' />
                    <Skeleton className='h-8 w-8' />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className='flex justify-between pt-4 border-t'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-24' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
