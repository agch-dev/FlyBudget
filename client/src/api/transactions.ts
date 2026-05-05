import { apiFetch } from './client';
import type { Transaction, TransactionQueryParams } from '../types';

export interface CreateTransactionData {
  accountId: string;
  date: string;
  amount: number;
  payeeId?: string | null;
  payeeName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  cleared?: number;
}

export function getTransactions(params: TransactionQueryParams = {}) {
  const q = new URLSearchParams();
  if (params.accountId) q.set('account_id', params.accountId);
  if (params.month) q.set('month', params.month);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.categoryId) q.set('category_id', params.categoryId);
  if (params.search) q.set('search', params.search);
  if (params.cleared !== undefined) q.set('cleared', String(params.cleared));
  if (params.reconciled !== undefined) q.set('reconciled', String(params.reconciled));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
}

export const createTransaction = (data: CreateTransactionData) =>
  apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) });

export const updateTransaction = (id: string, data: Partial<CreateTransactionData>) =>
  apiFetch<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTransaction = (id: string) =>
  apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' });

export const reconcileAccount = (accountId: string, transactionIds: string[]) =>
  apiFetch<{ reconciled: number }>(`/accounts/${accountId}/reconcile`, {
    method: 'PUT',
    body: JSON.stringify({ transactionIds }),
  });
