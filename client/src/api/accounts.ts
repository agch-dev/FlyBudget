import { apiFetch } from './client';
import type { Account, AccountType, Currency } from '../types';
import type { ImportMemory } from '../utils/csv';

export const getAccounts = () => apiFetch<Account[]>('/accounts');

export const createAccount = (data: {
  name: string;
  type: AccountType;
  startingBalance: number;
  isOffBudget?: number;
  currency?: Currency;
  /** The Account Group to join or start; null or blank = none */
  groupName?: string | null;
}) => apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) });

export const updateAccount = (
  id: string,
  data: Partial<{
    name: string;
    type: AccountType;
    startingBalance: number;
    isOffBudget: number;
    logo: string | null;
    /** Refused by the server once the account has transactions */
    currency: Currency;
    groupName: string | null;
  }>,
) => apiFetch<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const closeAccount = (id: string) => apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' });

export const reorderAccounts = (ids: string[]) =>
  apiFetch<{ ok: boolean }>('/accounts/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });

export const getBalancesAgo = () => apiFetch<Record<string, number>>('/accounts/balances-ago');

/** How this account's bank files are read, from its last import (null before the first) */
export const getImportSettings = (id: string) =>
  apiFetch<{ settings: ImportMemory | null }>(`/accounts/${id}/import-settings`);

export const saveImportSettings = (id: string, settings: ImportMemory) =>
  apiFetch<{ settings: ImportMemory }>(`/accounts/${id}/import-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
