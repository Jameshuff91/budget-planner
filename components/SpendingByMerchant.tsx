'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { ScrollArea } from '@components/ui/scroll-area';
import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';

export default function SpendingByMerchant() {
  // Calling useAnalytics without arguments, so it uses its internal default time range (current month).
  const { merchantSpending } = useAnalytics();

  // Optional: Log the data received for debugging
  // useEffect(() => {
  //   logger.debug('SpendingByMerchant - merchantSpending data:', merchantSpending);
  // }, [merchantSpending]);

  const isDataAvailable = merchantSpending && merchantSpending.length > 0;

  return (
    <Card>
      <CardHeader>
        {/* Title indicates the assumed default period. If useAnalytics returned startDate/endDate, we could make this dynamic. */}
        <CardTitle>Spending by Merchant (Current Month)</CardTitle>
      </CardHeader>
      <CardContent>
        {!isDataAvailable && <p>No merchant spending data available for this period.</p>}
        {isDataAvailable && (
          <ScrollArea className='h-[350px] pr-4'>
            {' '}
            {/* Adjust height as needed */}
            <div className='space-y-2'>
              {merchantSpending.map(
                (
                  merchant: { name: string; value: number; transactionCount: number },
                  index: number,
                ) => (
                  <div
                    key={index}
                    className='flex justify-between items-center py-3 border-b last:border-b-0 hover:bg-gray-50 p-2 rounded-md'
                  >
                    <div className='flex-grow mr-2 overflow-hidden'>
                      {' '}
                      {/* Added overflow-hidden for long names */}
                      <p className='font-semibold text-sm truncate' title={merchant.name}>
                        {merchant.name}
                      </p>{' '}
                      {/* Added truncate and title */}
                      <p className='text-xs text-gray-500'>
                        {merchant.transactionCount} transaction
                        {merchant.transactionCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <p className='font-semibold text-sm whitespace-nowrap'>
                      {formatCurrency(merchant.value)}
                    </p>{' '}
                    {/* Added whitespace-nowrap */}
                  </div>
                ),
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
