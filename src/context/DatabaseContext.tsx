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

import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { dbService, Asset, Liability } from '../services/db'; // Import Asset and Liability
import { logger } from '../services/logger';
import { pdfService } from '../services/pdfService'; // Fix import path
import { Transaction, Category } from '../types';
import { generateUUID } from '../utils/helpers';
import { offlineQueue } from '../utils/offline-queue';

interface DatabaseContextType {
  transactions: Transaction[];
  categories: Category[];
  loading: boolean;
  error: Error | null;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<string>;
  addTransactionsBatch: (transactions: Omit<Transaction, 'id'>[]) => Promise<string[]>;
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
  const [recurringPreferences, setRecurringPreferences] = useState<
    Record<string, 'confirmed' | 'dismissed'>
  >({});
  const [assets, setAssets] = useState<Asset[]>([]); // Added
  const [liabilities, setLiabilities] = useState<Liability[]>([]); // Added
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Offline status
  const { isOffline } = useOfflineStatus();

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
      setTransactions(
        loadedTransactions.map((t) => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : t.date,
        })),
      );
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
            { id: 'entertainment', name: 'Entertainment', type: 'expense' as const },
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

  // Set up offline queue sync handler
  useEffect(() => {
    if (!offlineQueue) return;

    const unsubscribe = offlineQueue.onSync(async (operation) => {
      try {
        switch (operation.type) {
          case 'ADD_TRANSACTION':
            await dbService.addTransaction({
              ...operation.payload,
              id: generateUUID(),
              date: new Date(operation.payload.date),
            });
            break;
          case 'UPDATE_TRANSACTION':
            await dbService.updateTransaction({
              ...operation.payload,
              date: new Date(operation.payload.date),
            });
            break;
          case 'DELETE_TRANSACTION':
            await dbService.deleteTransaction(operation.payload.id);
            break;
          case 'ADD_ASSET':
            await dbService.addAsset(operation.payload);
            break;
          case 'UPDATE_ASSET':
            await dbService.updateAsset(operation.payload);
            break;
          case 'DELETE_ASSET':
            await dbService.deleteAsset(operation.payload.id);
            break;
          case 'ADD_LIABILITY':
            await dbService.addLiability(operation.payload);
            break;
          case 'UPDATE_LIABILITY':
            await dbService.updateLiability(operation.payload);
            break;
          case 'DELETE_LIABILITY':
            await dbService.deleteLiability(operation.payload.id);
            break;
        }
        await loadData();
        logger.info('Synced offline operation:', operation.type);
      } catch (error) {
        logger.error('Failed to sync operation:', error);
        throw error;
      }
    });

    return unsubscribe;
  }, [loadData]);

  const addTransaction = useCallback(
    async (transaction: Omit<Transaction, 'id'>) => {
      try {
        if (isOffline) {
          // Queue for offline sync
          if (offlineQueue) {
            const queueId = await offlineQueue.queueAddTransaction(transaction);
            logger.info('Transaction queued for offline sync:', queueId);
          }

          // Add to local state optimistically
          const newTransaction: Transaction = {
            ...transaction,
            id: generateUUID(),
            date: transaction.date,
          };
          setTransactions((prev) => [...prev, newTransaction]);

          return newTransaction.id;
        } else {
          // Normal online operation
          const id = await dbService.addTransaction({
            ...transaction,
            id: generateUUID(),
            date: new Date(transaction.date),
          });
          await loadData(); // Refresh data after adding transaction
          return id;
        }
      } catch (err) {
        logger.error('Error adding transaction:', err);
        throw err;
      }
    },
    [loadData, isOffline],
  );

  const addTransactionsBatch = useCallback(
    async (transactions: Omit<Transaction, 'id'>[]) => {
      try {
        const ids: string[] = [];
        for (const transaction of transactions) {
          const id = await dbService.addTransaction({
            ...transaction,
            id: generateUUID(),
            date: new Date(transaction.date),
          });
          ids.push(id);
        }
        await loadData(); // Refresh data only once after all transactions are added
        return ids;
      } catch (err) {
        logger.error('Error adding transactions batch:', err);
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
        if (isOffline) {
          // Queue for offline sync
          if (offlineQueue) {
            const queueId = await offlineQueue.queueUpdateTransaction(transaction);
            logger.info('Transaction update queued for offline sync:', queueId);
          }

          // Update local state optimistically
          setTransactions((prev) => prev.map((t) => (t.id === transaction.id ? transaction : t)));
        } else {
          // Normal online operation
          await dbService.updateTransaction({
            ...transaction,
            date: new Date(transaction.date),
          });
          await loadData(); // Refresh data after updating transaction
        }
      } catch (err) {
        logger.error('Error updating transaction:', err);
        throw err;
      }
    },
    [loadData, isOffline],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      try {
        if (isOffline) {
          // Queue for offline sync
          if (offlineQueue) {
            const queueId = await offlineQueue.queueDeleteTransaction(id);
            logger.info('Transaction deletion queued for offline sync:', queueId);
          }

          // Remove from local state optimistically
          setTransactions((prev) => prev.filter((t) => t.id !== id));
        } else {
          // Normal online operation
          await dbService.deleteTransaction(id);
          await loadData(); // Refresh data after deleting transaction
        }
      } catch (err) {
        logger.error('Error deleting transaction:', err);
        throw err;
      }
    },
    [loadData, isOffline],
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

      // Get transactions from database and convert dates to strings
      const dbTransactions = (await dbService.getTransactions()).map((t) => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : t.date,
      }));

      // Get transactions from stored PDFs and convert to Transaction type
      const pdfTransactions = (await pdfService.reprocessStoredPDFs()).map((data) => ({
        ...data,
        id: generateUUID(),
        date: data.date.toISOString(),
        category: data.category || 'Uncategorized',
      }));

      // Combine and deduplicate transactions
      const allTransactions = [...dbTransactions, ...pdfTransactions];
      const uniqueTransactions = allTransactions.filter(
        (transaction, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.date === transaction.date &&
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
      addTransactionsBatch,
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
      addTransactionsBatch,
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
