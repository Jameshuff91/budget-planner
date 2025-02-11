'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { dbService } from '../services/db';
import { logger } from '../services/logger';
import { generateUUID } from '../utils/helpers';
import { pdfService } from '../services/pdfService'; // Fix import path

interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  isMonthSummary?: boolean;
  accountNumber?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budget?: number;
}

interface DatabaseContextType {
  transactions: Transaction[];
  categories: Category[];
  loading: boolean;
  error: Error | null;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<string>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<string>;
  refreshData: () => Promise<void>;
  getTransactionsByMonth: (date: Date) => Promise<Transaction[]>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load data'));
      logger.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get existing categories
        const existingCategories = await dbService.getCategories();
        
        // If no categories exist, add default ones
        if (existingCategories.length === 0) {
          const defaultCategories = [
            { id: 'salary', name: 'Salary', type: 'income' as const },
            { id: 'rent', name: 'Rent', type: 'expense' as const },
            { id: 'groceries', name: 'Groceries', type: 'expense' as const },
            { id: 'utilities', name: 'Utilities', type: 'expense' as const },
            { id: 'transport', name: 'Transport', type: 'expense' as const },
            { id: 'entertainment', name: 'Entertainment', type: 'expense' as const }
          ];

          for (const category of defaultCategories) {
            await dbService.addCategory(category);
          }
          logger.info('Default categories initialized');
        }

        // Load all data after ensuring categories exist
        await loadData();
      } catch (error) {
        logger.error('Error initializing data:', error);
        setError(error instanceof Error ? error : new Error('Failed to initialize data'));
      }
    };

    initializeData();
  }, [loadData]);

  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, 'id'>) => {
      try {
        const id = await dbService.addTransaction({ ...transaction, id: generateUUID() });
        await loadData(); // Refresh data after adding transaction
        return id;
      } catch (err) {
        logger.error('Error adding transaction:', err);
        throw err;
      }
    },
    [loadData],
  );

  const updateTransaction = useCallback(
    async (transaction: Transaction) => {
      try {
        await dbService.updateTransaction(transaction);
        await loadData(); // Refresh data after updating transaction
      } catch (err) {
        logger.error('Error updating transaction:', err);
        throw err;
      }
    },
    [loadData],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      try {
        await dbService.deleteTransaction(id);
        await loadData(); // Refresh data after deleting transaction
      } catch (err) {
        logger.error('Error deleting transaction:', err);
        throw err;
      }
    },
    [loadData],
  );

  const clearTransactions = useCallback(async () => {
    try {
      setLoading(true);
      await dbService.clearTransactions();
      await loadData();
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  const addCategory = useCallback(
    async (category: Omit<Category, 'id'>) => {
      try {
        const id = await dbService.addCategory({ ...category, id: generateUUID() });
        await loadData(); // Refresh data after adding category
        return id;
      } catch (err) {
        logger.error('Error adding category:', err);
        throw err;
      }
    },
    [loadData],
  );

  const getTransactionsByMonth = useCallback(
    async (date: Date) => {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      return transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
      });
    },
    [transactions],
  );

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Clear existing transactions
      setTransactions([]);

      // Get transactions from database
      const dbTransactions = await dbService.getTransactions();

      // Get transactions from stored PDFs and convert to Transaction type
      const pdfTransactions = (await pdfService.reprocessStoredPDFs()).map((data) => ({
        ...data,
        id: generateUUID(),
        category: data.category || 'Uncategorized',
      }));

      // Combine and deduplicate transactions
      const allTransactions = [...dbTransactions, ...pdfTransactions];
      const uniqueTransactions = allTransactions.filter(
        (transaction, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.date.getTime() === transaction.date.getTime() &&
              t.amount === transaction.amount &&
              t.description === transaction.description,
          ),
      );

      setTransactions(uniqueTransactions);
      const categories = await dbService.getCategories();
      setCategories(categories);
    } catch (error) {
      logger.error('Error refreshing data:', error);
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      transactions,
      categories,
      loading,
      error,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      clearTransactions,
      addCategory,
      refreshData,
      getTransactionsByMonth,
    }),
    [
      transactions,
      categories,
      loading,
      error,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      clearTransactions,
      addCategory,
      refreshData,
      getTransactionsByMonth,
    ],
  );

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDBContext() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDBContext must be used within a DatabaseProvider');
  }
  return context;
}
