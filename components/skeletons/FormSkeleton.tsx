import { Card, CardContent, CardHeader } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='container mx-auto p-4'>
      <Card>
        <CardHeader>
          <Skeleton className='h-7 w-48' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {[...Array(rows)].map((_, i) => (
              <div
                key={i}
                className='flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 border-b last:border-b-0'
              >
                <Skeleton className='h-5 w-32 mb-2 sm:mb-0' />
                <Skeleton className='h-10 w-full sm:w-40' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
