import { openDB, DBSchema, IDBPDatabase } from 'idb';

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
    category: 'Transport',
    description: 'Monthly Transport',
    date: new Date(),
    type: 'expense' as const,
  },
  {
    id: 'default-expense-5',
    amount: 100,
    category: 'Entertainment',
    description: 'Movie Tickets',
    date: new Date(),
    type: 'expense' as const,
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
  private readonly VERSION = 3;

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
    // Create stores if they don't exist
    if (!db.objectStoreNames.contains('transactions')) {
      const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-date', 'date');
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
    }

    if (!db.objectStoreNames.contains('pdfs')) {
      const pdfStore = db.createObjectStore('pdfs', { keyPath: 'id' });
      pdfStore.createIndex('by-hash', 'contentHash', { unique: true });
      pdfStore.createIndex('by-statement-start', 'statementPeriod.startDate');
      pdfStore.createIndex('by-statement-end', 'statementPeriod.endDate');
    }
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
}

export const dbService = new DatabaseService();
