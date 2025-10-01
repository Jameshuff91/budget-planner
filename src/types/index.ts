export interface Transaction {
  id: string;
  amount: number;
  category: string;
  categoryId?: string;
  description: string;
  date: string;
  type: 'income' | 'expense';
  isMonthSummary?: boolean;
  accountNumber?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budget?: number;
  parentId?: string; // For category hierarchy
  icon?: string; // Optional icon for visual representation
  color?: string; // Optional color for charts
  isTaxDeductible?: boolean; // For tax reporting
  tags?: string[]; // For flexible categorization
}

export interface Asset {
  id: string;
  name: string;
  type: 'savings' | 'investment' | 'property' | 'other';
  value: number;
  lastUpdated: string;
}

export interface Liability {
  id: string;
  name: string;
  type: 'mortgage' | 'auto' | 'credit_card' | 'student_loan' | 'other';
  balance: number;
  minimumPayment?: number;
  interestRate?: number;
  lastUpdated: string;
}

export interface MerchantLearning {
  id: string;
  merchantName: string;
  categoryId: string;
  confidence: number;
  lastUsed: string;
  useCount: number;
}

export interface BudgetAlert {
  id: string;
  categoryId: string;
  threshold: number; // Percentage (e.g., 80 for 80%)
  enabled: boolean;
  notificationsSent: number;
}
