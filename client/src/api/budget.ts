import { apiFetch } from './client';
import type { BudgetGroup } from '../types';

export const getBudget = (month: string) =>
  apiFetch<BudgetGroup[]>(`/budget/${month}`);

export const setBudget = (month: string, categoryId: string, budgeted: number) =>
  apiFetch<{ month: string; categoryId: string; budgeted: number }>(
    `/budget/${month}/${categoryId}`,
    { method: 'PUT', body: JSON.stringify({ budgeted }) },
  );
