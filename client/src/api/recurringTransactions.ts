import { apiFetch } from './client';
import type { RecurringTransaction, RecurringOccurrence, RecurringSummary, Transaction } from '../types';

export interface CreateRecurringData {
  title: string;
  amount: number;
  isApproximate?: number;
  frequency: string;
  startDate: string;
  endDate?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  payeeId?: string | null;
  notes?: string | null;
  status?: string;
  autoCreate?: number;
}

export const getRecurringTransactions = (status?: string) => {
  const q = status ? `?status=${status}` : '';
  return apiFetch<RecurringTransaction[]>(`/recurring-transactions${q}`);
};

export const getRecurringTransaction = (id: string) =>
  apiFetch<RecurringTransaction>(`/recurring-transactions/${id}`);

export const createRecurringTransaction = (data: CreateRecurringData) =>
  apiFetch<RecurringTransaction>('/recurring-transactions', { method: 'POST', body: JSON.stringify(data) });

export const updateRecurringTransaction = (id: string, data: Partial<CreateRecurringData>) =>
  apiFetch<RecurringTransaction>(`/recurring-transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteRecurringTransaction = (id: string, hard = false) =>
  apiFetch<void>(`/recurring-transactions/${id}${hard ? '?hard=1' : ''}`, { method: 'DELETE' });

export const getOccurrences = (from: string, to: string, status?: string) => {
  const q = new URLSearchParams({ from, to });
  if (status) q.set('status', status);
  return apiFetch<RecurringOccurrence[]>(`/recurring-transactions/occurrences?${q}`);
};

export const markAsPaid = (id: string, date: string, amount?: number) =>
  apiFetch<Transaction>(`/recurring-transactions/${id}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ date, ...(amount !== undefined ? { amount } : {}) }),
  });

export const getRecurringSummary = (month: string) =>
  apiFetch<RecurringSummary>(`/recurring-transactions/summary?month=${month}`);

export const triggerAutoCreate = () =>
  apiFetch<{ created: number }>('/recurring-transactions/auto-create', { method: 'POST' });
