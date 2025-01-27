import { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/db';
import { logger } from '../services/logger';

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  isMonthSummary?: boolean;
  accountNumber?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budget?: number;
}

export const useDatabase = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedTransactions, loadedCategories] = await Promise.all([
        dbService.getTransactions(),
        dbService.getCategories(),
      ]);
      setTransactions(loadedTransactions);
      setCategories(loadedCategories);
      setError(null);
      logger.info('Data loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      logger.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      // Validate transaction type
      if (transaction.type !== 'income' && transaction.type !== 'expense') {
        throw new Error('Transaction type must be either "income" or "expense"');
      }

      const newTransaction = {
        ...transaction,
        id: crypto.randomUUID(),
      };
      await dbService.addTransaction(newTransaction);
      setTransactions((prev) => [...prev, newTransaction]);
      logger.info('Transaction added:', newTransaction);
      return newTransaction;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add transaction';
      setError(errorMessage);
      logger.error('Error adding transaction:', err);
      throw err;
    }
  };

  const updateTransaction = async (transaction: Transaction) => {
    try {
      // Validate transaction type
      if (transaction.type !== 'income' && transaction.type !== 'expense') {
        throw new Error('Transaction type must be either "income" or "expense"');
      }

      await dbService.updateTransaction(transaction);
      setTransactions((prev) => prev.map((t) => (t.id === transaction.id ? transaction : t)));
      logger.info('Transaction updated:', transaction);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update transaction';
      setError(errorMessage);
      logger.error('Error updating transaction:', err);
      throw err;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await dbService.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      logger.info('Transaction deleted:', id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete transaction';
      setError(errorMessage);
      logger.error('Error deleting transaction:', err);
      throw err;
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    try {
      const newCategory = {
        ...category,
        id: crypto.randomUUID(),
      };
      await dbService.addCategory(newCategory);
      setCategories((prev) => [...prev, newCategory]);
      logger.info('Category added:', newCategory);
      return newCategory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add category';
      setError(errorMessage);
      logger.error('Error adding category:', err);
      throw err;
    }
  };

  return {
    transactions,
    categories,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    refreshData: loadData,
  };
};
