export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
];

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
