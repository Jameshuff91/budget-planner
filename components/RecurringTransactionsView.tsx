'use client';

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAnalytics } from '@hooks/useAnalytics';
import { useDBContext } from '@context/DatabaseContext'; // Import useDBContext
import { useToast } from '@components/ui/use-toast'; // Import useToast
import { formatCurrency } from '@utils/helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { ScrollArea } from '@components/ui/scroll-area';
import { Button } from '@components/ui/button'; 
import { CheckCircle2, XCircle } from 'lucide-react'; // Import icons
import { logger } from '@services/logger'; // Optional for debugging

export default function RecurringTransactionsView() {
  const { potentialRecurringTransactions } = useAnalytics();
  const { 
    recurringPreferences, 
    setRecurringPreference, 
    deleteRecurringPreference, 
    loading: dbLoading // Use this if needed for loading states
  } = useDBContext();
  const { toast } = useToast();

  // Simple date formatter, can be replaced with a more robust one from helpers if available
  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Optional: Log the data received for debugging
  // useEffect(() => {
  //    logger.debug('RecurringTransactionsView - Data:', potentialRecurringTransactions, recurringPreferences);
  // }, [potentialRecurringTransactions, recurringPreferences]);

  type FilterStatus = 'all' | 'pending' | 'confirmed' | 'dismissed';
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const filteredCandidates = useMemo(() => {
    if (!potentialRecurringTransactions) return [];
    if (activeFilter === 'all') {
      return potentialRecurringTransactions;
    }
    return potentialRecurringTransactions.filter(candidate => {
      const status = recurringPreferences[candidate.id]; // Use context's recurringPreferences
      if (activeFilter === 'pending') {
        return status === undefined;
      }
      return status === activeFilter;
    });
  }, [potentialRecurringTransactions, recurringPreferences, activeFilter]);

  const handleSetPreference = async (candidateId: string, status: 'confirmed' | 'dismissed' | null) => {
    try {
      if (status === null) {
        await deleteRecurringPreference(candidateId);
        toast({ title: "Preference Reset", description: "Transaction status reset to pending." });
      } else {
        await setRecurringPreference(candidateId, status);
        toast({ title: "Preference Saved", description: `Transaction marked as ${status}.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not save preference.", variant: "destructive" });
      logger.error("Error saving preference:", error);
    }
  };

  const isDataAvailable = potentialRecurringTransactions && potentialRecurringTransactions.length > 0;
  const isFilteredDataAvailable = filteredCandidates && filteredCandidates.length > 0;

  if (dbLoading && !isDataAvailable) { // Show loading indicator if DB is loading and we don't have any candidates yet
    return (
      <Card>
        <CardHeader><CardTitle>Potential Recurring Transactions</CardTitle></CardHeader>
        <CardContent><p>Loading preferences and transactions...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Potential Recurring Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Button variant={activeFilter === 'all' ? 'default' : 'outline'} onClick={() => setActiveFilter('all')}>All ({potentialRecurringTransactions?.length || 0})</Button>
          <Button variant={activeFilter === 'pending' ? 'default' : 'outline'} onClick={() => setActiveFilter('pending')}>
            Pending ({potentialRecurringTransactions?.filter(c => !recurringPreferences[c.id]).length || 0})
          </Button>
          <Button variant={activeFilter === 'confirmed' ? 'default' : 'outline'} onClick={() => setActiveFilter('confirmed')}>
            Confirmed ({potentialRecurringTransactions?.filter(c => recurringPreferences[c.id] === 'confirmed').length || 0})
          </Button>
          <Button variant={activeFilter === 'dismissed' ? 'default' : 'outline'} onClick={() => setActiveFilter('dismissed')}>
            Dismissed ({potentialRecurringTransactions?.filter(c => recurringPreferences[c.id] === 'dismissed').length || 0})
          </Button>
        </div>

        {!isDataAvailable ? (
          <p>No potential recurring transactions identified overall.</p>
        ) : !isFilteredDataAvailable ? (
          <p>No transactions match the current filter '{activeFilter}'.</p>
        ) : (
          <ScrollArea className="h-[350px] pr-3"> {/* Adjusted height slightly for filter buttons */}
            <div className="space-y-3"> 
              {filteredCandidates.map(candidate => {
                const currentStatus = recurringPreferences[candidate.id]; // Use context's recurringPreferences
                let itemClasses = "py-3 px-2 border-b last:border-b-0 hover:bg-gray-50 rounded-md transition-all duration-150 ease-in-out";
                let statusBadge = null;
                let textClasses = "font-semibold text-md truncate";
                let amountClasses = "font-semibold text-md whitespace-nowrap";

                if (currentStatus === 'confirmed') {
                  itemClasses += " bg-green-50 border-l-4 border-green-500";
                  statusBadge = <span className="ml-2 text-xs text-green-700 inline-flex items-center"><CheckCircle2 size={14} className="mr-1" /> Confirmed</span>;
                } else if (currentStatus === 'dismissed') {
                  itemClasses += " opacity-60 bg-gray-50";
                  textClasses += " line-through";
                  amountClasses += " line-through";
                  statusBadge = <span className="ml-2 text-xs text-gray-500 inline-flex items-center"><XCircle size={14} className="mr-1" /> Dismissed</span>;
                }

                return (
                  <div key={candidate.id} className={itemClasses}>
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className={textClasses} title={candidate.merchantName}>
                          {candidate.merchantName}
                          {statusBadge}
                        </p>
                      </div>
                      <p className={amountClasses}>{formatCurrency(candidate.amount)}</p>
                    </div>
                    <p className={`text-sm text-gray-600 ${currentStatus === 'dismissed' ? 'line-through' : ''}`}>
                      Frequency: <span className={`font-medium ${currentStatus === 'dismissed' ? 'line-through' : ''}`}>{capitalizeFirstLetter(candidate.frequency)}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Last Payment: {formatDate(candidate.lastDate)}
                    </p>
                    {candidate.nextEstimatedDate && (
                      <p className="text-sm text-gray-500">
                        Next Est: {formatDate(candidate.nextEstimatedDate)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      (Based on {candidate.transactionIds.length} transactions, avg. {candidate.avgDaysBetween?.toFixed(0)} days apart)
                    </p>
                    <div className={`mt-2 flex space-x-2 ${currentStatus === 'dismissed' ? 'hidden' : ''}`}> {/* Hide buttons if dismissed */}
                      {currentStatus === 'confirmed' ? (
                        <Button variant="outline" size="sm" onClick={() => handleSetPreference(candidate.id, null)}>Undo Confirm</Button>
                      ) : ( // Only show Confirm/Dismiss if not already confirmed (dismissed case handled by hiding parent div)
                        <>
                          <Button variant="outline" size="sm" className="mr-2 border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600" onClick={() => handleSetPreference(candidate.id, 'confirmed')}>Confirm</Button>
                          <Button variant="outline" size="sm" className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleSetPreference(candidate.id, 'dismissed')}>Dismiss</Button>
                        </>
                      )}
                    </div>
                     {/* Show Undo Dismiss button always if dismissed, outside the conditional hiding div */}
                    {currentStatus === 'dismissed' && (
                       <div className="mt-2 flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleSetPreference(candidate.id, null)}>Undo Dismiss</Button>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
