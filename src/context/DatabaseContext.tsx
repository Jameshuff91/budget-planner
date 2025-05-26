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
import { dbService, Asset, Liability } from '../services/db'; // Import Asset and Liability
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
  updateCategoryBudget: (categoryId: string, budget: number) => Promise<void>;
  recurringPreferences: Record<string, 'confirmed' | 'dismissed'>;
  setRecurringPreference: (candidateId: string, status: 'confirmed' | 'dismissed') => Promise<void>;
  deleteRecurringPreference: (candidateId: string) => Promise<void>;
  assets: Asset[]; // Added
  liabilities: Liability[]; // Added
  addAsset: (assetData: Omit<Asset, 'id'>) => Promise<string>; // Added
  updateAsset: (asset: Asset) => Promise<void>; // Added
  deleteAsset: (assetId: string) => Promise<void>; // Added
  addLiability: (liabilityData: Omit<Liability, 'id'>) => Promise<string>; // Added
  updateLiability: (liability: Liability) => Promise<void>; // Added
  deleteLiability: (liabilityId: string) => Promise<void>; // Added
  refreshData: () => Promise<void>;
  getTransactionsByMonth: (date: Date) => Promise<Transaction[]>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringPreferences, setRecurringPreferences] = useState<Record<string, 'confirmed' | 'dismissed'>>({});
  const [assets, setAssets] = useState<Asset[]>([]); // Added
  const [liabilities, setLiabilities] = useState<Liability[]>([]); // Added
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        loadedTransactions, 
        loadedCategories, 
        loadedRecurringPrefs,
        loadedAssets, // New
        loadedLiabilities, // New
      ] = await Promise.all([
        dbService.getTransactions(),
        dbService.getCategories(),
        dbService.getAllRecurringPreferences(),
        dbService.getAllAssets(), // New call
        dbService.getAllLiabilities(), // New call
      ]);
      setTransactions(loadedTransactions);
      setCategories(loadedCategories);
      setRecurringPreferences(loadedRecurringPrefs);
      setAssets(loadedAssets); // New
      setLiabilities(loadedLiabilities); // New
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

  // --- Asset Context Functions ---
  const addAsset = useCallback(
    async (assetData: Omit<Asset, 'id'>) => {
      try {
        const id = await dbService.addAsset(assetData);
        await loadData();
        logger.info(`Asset added in context: ${id}`);
        return id;
      } catch (err) {
        logger.error('Error adding asset in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const updateAsset = useCallback(
    async (asset: Asset) => {
      try {
        await dbService.updateAsset(asset);
        await loadData();
        logger.info(`Asset updated in context: ${asset.id}`);
      } catch (err) {
        logger.error('Error updating asset in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      try {
        await dbService.deleteAsset(assetId);
        await loadData();
        logger.info(`Asset deleted in context: ${assetId}`);
      } catch (err) {
        logger.error('Error deleting asset in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  // --- Liability Context Functions ---
  const addLiability = useCallback(
    async (liabilityData: Omit<Liability, 'id'>) => {
      try {
        const id = await dbService.addLiability(liabilityData);
        await loadData();
        logger.info(`Liability added in context: ${id}`);
        return id;
      } catch (err) {
        logger.error('Error adding liability in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const updateLiability = useCallback(
    async (liability: Liability) => {
      try {
        await dbService.updateLiability(liability);
        await loadData();
        logger.info(`Liability updated in context: ${liability.id}`);
      } catch (err) {
        logger.error('Error updating liability in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const deleteLiability = useCallback(
    async (liabilityId: string) => {
      try {
        await dbService.deleteLiability(liabilityId);
        await loadData();
        logger.info(`Liability deleted in context: ${liabilityId}`);
      } catch (err) {
        logger.error('Error deleting liability in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const setRecurringPreference = useCallback(
    async (candidateId: string, status: 'confirmed' | 'dismissed') => {
      try {
        await dbService.setRecurringPreference(candidateId, status);
        await loadData(); // Refresh data
      } catch (err) {
        logger.error('Error setting recurring preference in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const deleteRecurringPreference = useCallback(
    async (candidateId: string) => {
      try {
        await dbService.deleteRecurringPreference(candidateId);
        await loadData(); // Refresh data
      } catch (err) {
        logger.error('Error deleting recurring preference in context:', err);
        throw err;
      }
    },
    [loadData],
  );

  const updateCategoryBudget = useCallback(
    async (categoryId: string, budget: number) => {
      try {
        await dbService.updateCategoryBudget(categoryId, budget);
        await loadData(); // Refresh data after updating category budget
      } catch (err) {
        logger.error('Error updating category budget in context:', err);
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
      updateCategoryBudget,
      recurringPreferences, 
      setRecurringPreference, 
      deleteRecurringPreference,
      assets, // Added
      liabilities, // Added
      addAsset, // Added
      updateAsset, // Added
      deleteAsset, // Added
      addLiability, // Added
      updateLiability, // Added
      deleteLiability, // Added
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
      updateCategoryBudget,
      recurringPreferences,
      setRecurringPreference,
      deleteRecurringPreference,
      assets, // Added
      liabilities, // Added
      addAsset, // Added
      updateAsset, // Added
      deleteAsset, // Added
      addLiability, // Added
      updateLiability, // Added
      deleteLiability, // Added
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
