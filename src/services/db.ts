import { openDB, DBSchema, IDBPDatabase } from 'idb';

import { generateUUID } from '../utils/helpers'; // Import generateUUID

export interface Asset {
  id: string;
  name: string;
  type: string; // e.g., 'Cash', 'Savings Account', 'Investment (Stocks)', 'Real Estate'
  currentValue: number;
  lastUpdated: string; // ISO date string
}

export interface Liability {
  id: string;
  name: string;
  type: string; // e.g., 'Credit Card', 'Mortgage', 'Student Loan', 'Personal Loan'
  currentBalance: number; // The outstanding balance
  lastUpdated: string; // ISO date string
}

interface BudgetDB extends DBSchema {
  transactions: {
    key: string;
    value: {
      id: string;
      amount: number;
      category: string;
      description: string;
      date: Date;
      type: 'income' | 'expense';
      isMonthSummary?: boolean;
      accountNumber?: string;
    };
    indexes: { 'by-date': Date };
  };
  categories: {
    key: string;
    value: {
      id: string;
      name: string;
      type: 'income' | 'expense';
      budget?: number;
    };
  };
  pdfs: {
    key: string;
    value: {
      id: string;
      name: string;
      content: ArrayBuffer;
      uploadDate: Date;
      processed: boolean;
      status: 'pending' | 'processing' | 'completed' | 'error';
      error?: string;
      transactionCount?: number;
      contentHash: string;
      statementPeriod?: {
        startDate: Date;
        endDate: Date;
      };
    };
    indexes: {
      'by-hash': string;
      'by-statement-start': Date;
      'by-statement-end': Date;
    };
  };
  recurringPreferences: {
    // Added new store definition
    key: string;
    value: {
      id: string; // Typically the ID of the RecurringTransactionCandidate
      status: 'confirmed' | 'dismissed';
    };
    // No indexes needed for now, can be added later if required
  };
  assets: {
    // Added assets store definition
    key: string; // Corresponds to Asset['id']
    value: Asset;
  };
  liabilities: {
    // Added liabilities store definition
    key: string; // Corresponds to Liability['id']
    value: Liability;
  };
}

const DEFAULT_TRANSACTIONS: BudgetDB['transactions']['value'][] = [
  {
    id: 'default-income',
    amount: 17800,
    category: 'Salary',
    description: 'Monthly Income',
    date: new Date(),
    type: 'income' as const,
  },
  {
    id: 'default-expense-1',
    amount: 1200,
    category: 'Rent',
    description: 'Monthly Rent',
    date: new Date(),
    type: 'expense' as const,
  },
  {
    id: 'default-expense-2',
    amount: 300,
    category: 'Groceries',
    description: 'Weekly Groceries',
    date: new Date(),
    type: 'expense' as const,
  },
  {
    id: 'default-expense-3',
    amount: 150,
    category: 'Utilities',
    description: 'Electricity Bill',
    date: new Date(),
    type: 'expense' as const,
  },
  {
    id: 'default-expense-4',
    amount: 200,
    category: 'Transportation',
    description: 'Monthly Transport',
    date: new Date(),
    type: 'expense' as const,
  },
  {
    id: 'default-expense-5',
    amount: 100,
    category: 'Other Income',
    description: 'Freelance Work',
    date: new Date(),
    type: 'income' as const,
  },
];

const DEFAULT_CATEGORIES: BudgetDB['categories']['value'][] = [
  {
    id: 'income',
    name: 'Salary',
    type: 'income' as const,
  },
  {
    id: 'rent',
    name: 'Rent',
    type: 'expense' as const,
  },
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'expense' as const,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    type: 'expense' as const,
  },
  {
    id: 'transport',
    name: 'Transport',
    type: 'expense' as const,
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    type: 'expense' as const,
  },
];

class DatabaseService {
  private db: IDBPDatabase<BudgetDB> | null = null;
  private readonly DB_NAME = 'budget-planner';
  private readonly VERSION = 5;

  async initialize(): Promise<void> {
    try {
      this.db = await openDB<BudgetDB>(this.DB_NAME, this.VERSION, {
        upgrade: (db) => this.upgrade(db),
      });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async upgrade(db: IDBPDatabase<BudgetDB>) {
    console.log('Database upgrade started. Current stores:', Array.from(db.objectStoreNames));

    // Create stores if they don't exist
    if (!db.objectStoreNames.contains('transactions')) {
      const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-date', 'date');

      // Add default transactions within the same transaction
      for (const transaction of DEFAULT_TRANSACTIONS) {
        transactionStore.add(transaction);
      }
      console.log('Created transactions store with default data');
    }

    if (!db.objectStoreNames.contains('categories')) {
      const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });

      // Add default categories within the same transaction
      const defaultCategories = [
        { id: 'salary', name: 'Salary', type: 'income' as const },
        { id: 'other-income', name: 'Other Income', type: 'income' as const },
        { id: 'groceries', name: 'Groceries', type: 'expense' as const },
        { id: 'utilities', name: 'Utilities', type: 'expense' as const },
        { id: 'rent', name: 'Rent', type: 'expense' as const },
        { id: 'transportation', name: 'Transportation', type: 'expense' as const },
      ];

      for (const category of defaultCategories) {
        categoryStore.add(category);
      }
      console.log('Created categories store with default data');
    }

    if (!db.objectStoreNames.contains('pdfs')) {
      const pdfStore = db.createObjectStore('pdfs', { keyPath: 'id' });
      pdfStore.createIndex('by-hash', 'contentHash', { unique: true });
      pdfStore.createIndex('by-statement-start', 'statementPeriod.startDate');
      pdfStore.createIndex('by-statement-end', 'statementPeriod.endDate');
      console.log('Created pdfs store');
    }

    // Add recurringPreferences object store
    if (!db.objectStoreNames.contains('recurringPreferences')) {
      db.createObjectStore('recurringPreferences', { keyPath: 'id' });
      console.log('Created recurringPreferences object store');
    }

    // Add assets object store
    if (!db.objectStoreNames.contains('assets')) {
      db.createObjectStore('assets', { keyPath: 'id' });
      console.log('Created assets object store');
    }

    // Add liabilities object store
    if (!db.objectStoreNames.contains('liabilities')) {
      db.createObjectStore('liabilities', { keyPath: 'id' });
      console.log('Created liabilities object store');
    }

    console.log('Database upgrade completed. Final stores:', Array.from(db.objectStoreNames));
  }

  async addTransaction(transaction: BudgetDB['transactions']['value']): Promise<string> {
    if (!this.db) await this.initialize();
    const tx = await this.db!.add('transactions', transaction);
    return tx;
  }

  async getTransactions(): Promise<BudgetDB['transactions']['value'][]> {
    if (!this.db) await this.initialize();
    return this.db!.getAll('transactions');
  }

  async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<BudgetDB['transactions']['value'][]> {
    if (!this.db) await this.initialize();
    const index = this.db!.transaction('transactions').store.index('by-date');
    return index.getAll(IDBKeyRange.bound(startDate, endDate));
  }

  async addCategory(category: BudgetDB['categories']['value']): Promise<string> {
    if (!this.db) await this.initialize();
    const tx = await this.db!.add('categories', category);
    return tx;
  }

  async getCategories(): Promise<BudgetDB['categories']['value'][]> {
    if (!this.db) await this.initialize();
    return this.db!.getAll('categories');
  }

  async updateCategoryBudget(categoryId: string, budget: number): Promise<void> {
    if (!this.db) await this.initialize();
    const tx = this.db!.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const category = await store.get(categoryId);

    if (category) {
      category.budget = budget;
      await store.put(category);
    } else {
      // Option 1: Log an error
      console.error(`Category with ID ${categoryId} not found. Cannot update budget.`);
      // Option 2: Throw an error
      // throw new Error(`Category with ID ${categoryId} not found.`);
    }
    await tx.done;
  }

  async updateTransaction(transaction: BudgetDB['transactions']['value']): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('transactions', transaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('transactions', id);
  }

  async clearTransactions(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('transactions', 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  async clearPDFs(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('pdfs', 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  async getDB(): Promise<IDBPDatabase<BudgetDB>> {
    if (!this.db) await this.initialize();
    return this.db!;
  }

  // CRUD methods for recurringPreferences
  async setRecurringPreference(
    candidateId: string,
    status: 'confirmed' | 'dismissed',
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('recurringPreferences', 'readwrite');
      const store = tx.objectStore('recurringPreferences');
      await store.put({ id: candidateId, status: status });
      await tx.done;
      console.info(`Set preference for candidate ${candidateId} to ${status}`);
    } catch (error) {
      console.error(`Error setting recurring preference for candidate ${candidateId}:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async deleteRecurringPreference(candidateId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('recurringPreferences', 'readwrite');
      const store = tx.objectStore('recurringPreferences');
      await store.delete(candidateId);
      await tx.done;
      console.info(`Deleted preference for candidate ${candidateId}`);
    } catch (error) {
      console.error(`Error deleting recurring preference for candidate ${candidateId}:`, error);
      throw error;
    }
  }

  async getAllRecurringPreferences(): Promise<Record<string, 'confirmed' | 'dismissed'>> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('recurringPreferences', 'readonly');
      const store = tx.objectStore('recurringPreferences');
      const allPrefsArray = await store.getAll();
      await tx.done;

      const prefsRecord: Record<string, 'confirmed' | 'dismissed'> = {};
      for (const pref of allPrefsArray) {
        prefsRecord[pref.id] = pref.status;
      }
      console.info('Retrieved all recurring preferences:', prefsRecord);
      return prefsRecord;
    } catch (error) {
      console.error('Error getting all recurring preferences:', error);
      throw error; // Re-throw to allow caller to handle, or return {} as per original thought
    }
  }

  // --- Asset CRUD Methods ---
  async addAsset(assetData: Omit<Asset, 'id'>): Promise<string> {
    const newAssetWithId: Asset = { ...assetData, id: generateUUID() };
    try {
      const db = await this.getDB();
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      await store.add(newAssetWithId);
      await tx.done;
      console.info(`Asset added with ID: ${newAssetWithId.id}`);
      return newAssetWithId.id;
    } catch (error) {
      console.error(`Error adding asset ${newAssetWithId.name}:`, error);
      throw error;
    }
  }

  async updateAsset(asset: Asset): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      await store.put(asset);
      await tx.done;
      console.info(`Asset updated with ID: ${asset.id}`);
    } catch (error) {
      console.error(`Error updating asset ${asset.id}:`, error);
      throw error;
    }
  }

  async deleteAsset(assetId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      await store.delete(assetId);
      await tx.done;
      console.info(`Asset deleted with ID: ${assetId}`);
    } catch (error) {
      console.error(`Error deleting asset ${assetId}:`, error);
      throw error;
    }
  }

  async getAllAssets(): Promise<Asset[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const assets = await store.getAll();
      await tx.done;
      console.info('Retrieved all assets:', assets.length);
      return assets;
    } catch (error) {
      console.error('Error getting all assets:', error);
      throw error;
    }
  }

  // --- Liability CRUD Methods ---
  async addLiability(liabilityData: Omit<Liability, 'id'>): Promise<string> {
    const newLiabilityWithId: Liability = { ...liabilityData, id: generateUUID() };
    try {
      const db = await this.getDB();
      const tx = db.transaction('liabilities', 'readwrite');
      const store = tx.objectStore('liabilities');
      await store.add(newLiabilityWithId);
      await tx.done;
      console.info(`Liability added with ID: ${newLiabilityWithId.id}`);
      return newLiabilityWithId.id;
    } catch (error) {
      console.error(`Error adding liability ${newLiabilityWithId.name}:`, error);
      throw error;
    }
  }

  async updateLiability(liability: Liability): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('liabilities', 'readwrite');
      const store = tx.objectStore('liabilities');
      await store.put(liability);
      await tx.done;
      console.info(`Liability updated with ID: ${liability.id}`);
    } catch (error) {
      console.error(`Error updating liability ${liability.id}:`, error);
      throw error;
    }
  }

  async deleteLiability(liabilityId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('liabilities', 'readwrite');
      const store = tx.objectStore('liabilities');
      await store.delete(liabilityId);
      await tx.done;
      console.info(`Liability deleted with ID: ${liabilityId}`);
    } catch (error) {
      console.error(`Error deleting liability ${liabilityId}:`, error);
      throw error;
    }
  }

  async getAllLiabilities(): Promise<Liability[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('liabilities', 'readonly');
      const store = tx.objectStore('liabilities');
      const liabilities = await store.getAll();
      await tx.done;
      console.info('Retrieved all liabilities:', liabilities.length);
      return liabilities;
    } catch (error) {
      console.error('Error getting all liabilities:', error);
      throw error;
    }
  }
}

export const dbService = new DatabaseService();
