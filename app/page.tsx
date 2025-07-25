'use client';

import { Auth } from '@components/Auth';
import Dashboard from '@components/Dashboard';
import MonthSelector from '@components/MonthSelector';
import PDFUpload from '@components/PDFUpload';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/use-toast';
import { useAuth } from '@context/AuthContext';
import { useDBContext } from '@context/DatabaseContext';
import { pdfService } from '@services/pdfService';
import {
  categorizeTransactionsBatchWithAI,
  getSmartCategorizationSettings,
} from '@utils/smartCategorization';

export default function Home() {
  const { clearTransactions, addTransaction } = useDBContext();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  const handleReset = async () => {
    try {
      await clearTransactions();
      // Reprocess PDFs and get the extracted transactions
      const extractedTransactions = await pdfService.reprocessStoredPDFs();

      // Check if AI categorization is enabled
      const settings = getSmartCategorizationSettings();
      const transactionsToAdd = extractedTransactions.map((transaction) => ({
        date: transaction.date.toISOString().split('T')[0],
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category || 'Uncategorized',
        type: transaction.type,
        isMonthSummary: transaction.isMonthSummary || false,
        accountNumber: transaction.accountNumber,
      }));

      // Use AI to categorize transactions if enabled
      if (settings.enabled && transactionsToAdd.length > 0) {
        const transactionsForCategorization = transactionsToAdd
          .filter((t) => !t.category || t.category === 'Uncategorized')
          .map((t) => ({
            description: t.description,
            amount: t.amount,
            date: t.date,
            existingCategory: t.category,
          }));

        if (transactionsForCategorization.length > 0) {
          toast({
            title: 'Categorizing transactions...',
            description: `Using AI to categorize ${transactionsForCategorization.length} transactions`,
          });

          const categories = await categorizeTransactionsBatchWithAI(transactionsForCategorization);

          // Update transactions with AI categories
          let currentIndex = 0;
          for (let i = 0; i < transactionsToAdd.length; i++) {
            if (
              !transactionsToAdd[i].category ||
              transactionsToAdd[i].category === 'Uncategorized'
            ) {
              transactionsToAdd[i].category = categories[currentIndex];
              currentIndex++;
            }
          }
        }
      }

      // Add each transaction back to the database
      for (const transaction of transactionsToAdd) {
        await addTransaction(transaction);
      }

      toast({
        title: 'Dashboard Reset',
        description: `All data has been reset and ${extractedTransactions.length} transactions reprocessed.`,
      });
    } catch {
      toast({
        title: 'Reset Failed',
        description: 'Failed to reset dashboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <main className='flex min-h-screen flex-col items-center justify-center'>
        <div className='animate-pulse text-muted-foreground'>Loading...</div>
      </main>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <main className='flex min-h-screen flex-col items-center justify-center p-4'>
        <Auth onSuccess={() => window.location.reload()} />
      </main>
    );
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-24'>
      <div className='z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex'>
        <p className='fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30'>
          Budget Planner Dashboard
        </p>
        <div className='fixed right-4 top-4 flex items-center gap-4'>
          <span className='text-sm text-muted-foreground'>{user?.email}</span>
          <Button variant='outline' onClick={handleReset}>
            Reset Dashboard
          </Button>
          <Button variant='outline' onClick={logout}>
            Logout
          </Button>
        </div>
      </div>
      <div className='container mx-auto py-8 px-4'>
        <PDFUpload />

        <div className='mb-4'>
          <MonthSelector />
        </div>

        <div className='text-2xl font-bold mb-6 text-blue-600'>Financial Dashboard</div>
        <Dashboard />
      </div>
    </main>
  );
}
