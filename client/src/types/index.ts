export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
];

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
  notes: string | null;
  cleared: number;
  reconciled: number;
  isParent: number;
  parentTransactionId: string | null;
  importedId: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  isIncome: number;
  sortOrder: number;
  createdAt: string;
  categories: Category[];
}

export interface Payee {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  createdAt: string;
}

export interface TransactionQueryParams {
  accountId?: string;
  month?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  search?: string;
  cleared?: 0 | 1;
  limit?: number;
  offset?: number;
}

export interface BudgetCategory {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  budgeted: number;
  spent: number;
  balance: number;
}

export interface BudgetGroup {
  id: string;
  name: string;
  isIncome: number;
  sortOrder: number;
  createdAt: string;
  categories: BudgetCategory[];
}

export interface BudgetSummary {
  month: string;
  income: number;
  totalBudgeted: number;
  toBeBudgeted: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  isOffBudget: number;
  sortOrder: number;
  closedAt: string | null;
  createdAt: string;
  balance: number;
}
