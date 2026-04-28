import { apiFetch } from './client';
import type { NetWorthPoint, IncomeExpensesPoint, CashFlowPoint, SpendingByCategory } from '../types';

const qs = (from: string, to: string) => `?from=${from}&to=${to}`;

export const getNetWorth = (from: string, to: string) =>
  apiFetch<NetWorthPoint[]>(`/reports/net-worth${qs(from, to)}`);

export const getIncomeVsExpenses = (from: string, to: string) =>
  apiFetch<IncomeExpensesPoint[]>(`/reports/income-vs-expenses${qs(from, to)}`);

export const getCashFlow = (from: string, to: string) =>
  apiFetch<CashFlowPoint[]>(`/reports/cash-flow${qs(from, to)}`);

export const getSpendingByCategory = (from: string, to: string) =>
  apiFetch<SpendingByCategory[]>(`/reports/spending-by-category${qs(from, to)}`);
