'use client';

import Dashboard from '@components/Dashboard';
import MonthSelector from '@components/MonthSelector';
import PDFUpload from '@components/PDFUpload';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { pdfService } from '@services/pdfService';

export default function Home() {
  const { clearTransactions, addTransaction, refreshData } = useDBContext();

  const handleReset = async () => {
    try {
      await clearTransactions();
      // Reprocess PDFs and get the extracted transactions
      const extractedTransactions = await pdfService.reprocessStoredPDFs();

      // Add each transaction back to the database
      for (const transaction of extractedTransactions) {
        await addTransaction({
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description,
          category: transaction.category || 'Uncategorized',
          type: transaction.type,
          isMonthSummary: transaction.isMonthSummary || false,
          accountNumber: transaction.accountNumber,
        });
      }

      toast({
        title: 'Dashboard Reset',
        description: `All data has been reset and ${extractedTransactions.length} transactions reprocessed.`,
      });
    } catch (error) {
      toast({
        title: 'Reset Failed',
        description: 'Failed to reset dashboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-24'>
      <div className='z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex'>
        <p className='fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30'>
          Budget Planner Dashboard
        </p>
        <Button variant='outline' className='fixed right-4 top-4' onClick={handleReset}>
          Reset Dashboard
        </Button>
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
