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
