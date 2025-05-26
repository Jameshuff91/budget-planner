'use client';

import React, { useMemo } from 'react';
import { useDBContext } from '@context/DatabaseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { formatCurrency } from '@utils/helpers';
import { logger } from '@services/logger'; // Optional for debugging

export default function NetWorthSummary() {
  const { assets, liabilities, loading } = useDBContext();

  const totalAssets = useMemo(() => {
    const sum = assets.reduce((acc, asset) => acc + asset.currentValue, 0);
    // logger.debug('NetWorthSummary - Calculated totalAssets:', sum);
    return sum;
  }, [assets]);

  const totalLiabilities = useMemo(() => {
    const sum = liabilities.reduce((acc, liability) => acc + liability.currentBalance, 0);
    // logger.debug('NetWorthSummary - Calculated totalLiabilities:', sum);
    return sum;
  }, [liabilities]);

  const netWorth = useMemo(() => {
    const nw = totalAssets - totalLiabilities;
    // logger.debug('NetWorthSummary - Calculated netWorth:', nw);
    return nw;
  }, [totalAssets, totalLiabilities]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Calculating net worth...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3"> {/* Increased spacing slightly */}
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-600">Total Assets:</span>
            <span className="font-medium text-green-600">{formatCurrency(totalAssets)}</span>
          </div>
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-600">Total Liabilities:</span>
            <span className="font-medium text-red-600">{formatCurrency(totalLiabilities)}</span>
          </div>
          <hr className="my-3" /> {/* Increased margin for separator */}
          <div className="flex justify-between items-center text-xl">
            <span className="font-bold">Net Worth:</span>
            <span className={`font-bold ${netWorth >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {formatCurrency(netWorth)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
