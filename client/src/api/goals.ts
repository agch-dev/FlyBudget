import { apiFetch } from './client';
import type { Currency, Goal } from '../types';

export const getGoals = () => apiFetch<Goal[]>('/goals');

export const createGoal = (data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string | null;
  accountId?: string | null;
  /** Used only with no linked account: a linked goal is in its account's currency */
  currency?: Currency;
  icon?: string;
  color?: string;
}) => apiFetch<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) });

export const updateGoal = (
  id: string,
  data: Partial<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string | null;
    accountId: string | null;
    currency: Currency;
    icon: string;
    color: string;
  }>,
) => apiFetch<Goal>(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteGoal = (id: string) => apiFetch<void>(`/goals/${id}`, { method: 'DELETE' });
