'use client';

import { Edit2, Trash2, Search, Download, FileText } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useDBContext } from '@context/DatabaseContext';
import { exportTransactionsToCSV, exportCategorySummaryToCSV } from '@utils/csvExport';
import { formatCurrency } from '@utils/helpers';

import { Transaction } from '../src/types';

import { TransactionListSkeleton } from './skeletons/TransactionListSkeleton';
import { TransactionEditModal } from './TransactionEditModal';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from './ui/use-toast';

export default function TransactionList() {
  const { transactions, updateTransaction, deleteTransaction, loading } = useDBContext();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter transactions based on search and category
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesSearch = transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || transaction.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, searchTerm, selectedCategory]);

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    const categories = new Set(transactions.map((t) => t.category));
    return Array.from(categories).sort();
  }, [transactions]);

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditModalOpen(true);
  };

  const handleSave = async (updatedTransaction: Transaction) => {
    try {
      await updateTransaction(updatedTransaction);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(transactionId);
        toast({
          title: 'Success',
          description: 'Transaction deleted successfully',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to delete transaction',
          variant: 'destructive',
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExportTransactions = () => {
    try {
      exportTransactionsToCSV(filteredTransactions);
      toast({
        title: 'Success',
        description: `Exported ${filteredTransactions.length} transactions to CSV`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export transactions',
        variant: 'destructive',
      });
    }
  };

  const handleExportSummary = () => {
    try {
      exportCategorySummaryToCSV(filteredTransactions);
      toast({
        title: 'Success',
        description: 'Exported category summary to CSV',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export summary',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <TransactionListSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Transaction History</CardTitle>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleExportTransactions}
              disabled={filteredTransactions.length === 0}
            >
              <Download className='h-4 w-4 mr-2' />
              Export Transactions
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleExportSummary}
              disabled={filteredTransactions.length === 0}
            >
              <FileText className='h-4 w-4 mr-2' />
              Export Summary
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Search and Filter Controls */}
          <div className='flex gap-4'>
            <div className='relative flex-1'>
              <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search transactions...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-8'
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className='px-3 py-2 border border-gray-300 rounded-md text-sm'
            >
              <option value='all'>All Categories</option>
              {uniqueCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Table */}
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center py-8 text-gray-500'>
                      {transactions.length === 0
                        ? 'No transactions found. Upload a bank statement to get started.'
                        : 'No transactions match your search criteria.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className='font-medium'>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        <span className='inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700'>
                          {transaction.category}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : ''}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button variant='ghost' size='sm' onClick={() => handleEdit(transaction)}>
                            <Edit2 className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleDelete(transaction.id)}
                            className='text-red-600 hover:text-red-700'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Stats */}
          <div className='flex justify-between text-sm text-gray-600 pt-4 border-t'>
            <span>Total Transactions: {filteredTransactions.length}</span>
            <span>
              Total: {formatCurrency(filteredTransactions.reduce((sum, t) => sum + t.amount, 0))}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Edit Modal */}
      <TransactionEditModal
        transaction={selectedTransaction}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
      />
    </Card>
  );
}
