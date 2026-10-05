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

// Every report is in one currency, the `currency` argument (the viewing currency): the server
// converts each transaction at its own date's rate, and each balance at the rate of its day.
const toQueryString = (from: string, to: string, currency: Currency) =>
  `?from=${from}&to=${to}&currency=${currency}`;

export const getNetWorth = (
  from: string,
  to: string,
  currency: Currency,
  granularity?: 'daily' | 'monthly',
) =>
  apiFetch<NetWorthPoint[]>(
    `/reports/net-worth${toQueryString(from, to, currency)}${granularity ? `&granularity=${granularity}` : ''}`,
  );

export const getIncomeVsExpenses = (from: string, to: string, currency: Currency) =>
  apiFetch<IncomeExpensesPoint[]>(
    `/reports/income-vs-expenses${toQueryString(from, to, currency)}`,
  );

export const getSpendingByCategory = (from: string, to: string, currency: Currency) =>
  apiFetch<SpendingByCategory[]>(
    `/reports/spending-by-category${toQueryString(from, to, currency)}`,
  );

export const getIncomeByCategory = (from: string, to: string, currency: Currency) =>
  apiFetch<IncomeByCategoryItem[]>(
    `/reports/income-by-category${toQueryString(from, to, currency)}`,
  );

/** `daily` puts the date (yyyy-MM-dd) in each point's `month`. */
export const getSpendingTrends = (
  categoryIds: string[],
  from: string,
  to: string,
  currency: Currency,
  granularity?: 'daily' | 'monthly',
) =>
  apiFetch<SpendingTrendPoint[]>(
    `/reports/spending-trends${toQueryString(from, to, currency)}&category_ids=${categoryIds.join(',')}${granularity ? `&granularity=${granularity}` : ''}`,
  );

export const getSpendingComparison = (mode: string, currency: Currency) =>
  apiFetch<SpendingComparisonData>(
    `/reports/spending-comparison?mode=${mode}&currency=${currency}`,
  );

export const getDailyFlow = (from: string, to: string, currency: Currency) =>
  apiFetch<DailyFlowPoint[]>(`/reports/daily-flow${toQueryString(from, to, currency)}`);
