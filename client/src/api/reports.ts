import { apiFetch } from './client';
import type {
  Currency,
  NetWorthPoint,
  IncomeExpensesPoint,
  SpendingByCategory,
  IncomeByCategoryItem,
  SpendingTrendPoint,
  SpendingComparisonData,
  DailyFlowPoint,
} from '../types';

const toQueryString = (from: string, to: string) => `?from=${from}&to=${to}`;

/** Net worth in `currency` (pesos when left out), each point at the rate of its own day */
export const getNetWorth = (
  from: string,
  to: string,
  granularity?: 'daily' | 'monthly',
  currency?: Currency,
) =>
  apiFetch<NetWorthPoint[]>(
    `/reports/net-worth${toQueryString(from, to)}${granularity ? `&granularity=${granularity}` : ''}${currency ? `&currency=${currency}` : ''}`,
  );

export const getIncomeVsExpenses = (from: string, to: string) =>
  apiFetch<IncomeExpensesPoint[]>(`/reports/income-vs-expenses${toQueryString(from, to)}`);

export const getSpendingByCategory = (from: string, to: string) =>
  apiFetch<SpendingByCategory[]>(`/reports/spending-by-category${toQueryString(from, to)}`);

export const getIncomeByCategory = (from: string, to: string) =>
  apiFetch<IncomeByCategoryItem[]>(`/reports/income-by-category${toQueryString(from, to)}`);

/** `daily` puts the date (yyyy-MM-dd) in each point's `month`. */
export const getSpendingTrends = (
  categoryIds: string[],
  from: string,
  to: string,
  granularity?: 'daily' | 'monthly',
) =>
  apiFetch<SpendingTrendPoint[]>(
    `/reports/spending-trends?category_ids=${categoryIds.join(',')}&from=${from}&to=${to}${granularity ? `&granularity=${granularity}` : ''}`,
  );

export const getSpendingComparison = (mode: string) =>
  apiFetch<SpendingComparisonData>(`/reports/spending-comparison?mode=${mode}`);

export const getDailyFlow = (from: string, to: string) =>
  apiFetch<DailyFlowPoint[]>(`/reports/daily-flow${toQueryString(from, to)}`);
