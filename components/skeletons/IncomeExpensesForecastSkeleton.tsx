import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export function IncomeExpensesForecastSkeleton() {
  return (
    <Card data-testid="income-expenses-forecast-skeleton">
      <CardHeader>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        <Skeleton className="h-96 w-full" />
      </CardContent>
    </Card>
  );
}