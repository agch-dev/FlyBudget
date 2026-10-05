import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import * as reportsApi from '../api/reports';
import { DAILY_MAX_MONTHS, dayBounds, monthCount } from '../utils/dateRange';
import { useViewingCurrency } from './useViewingCurrency';

// Every report here is in the viewing currency (`useViewingCurrency`): it is sent to the
// server and is part of each query key, so flipping the switch loads the other currency.

/**
 * Net worth over time in the viewing currency, dollar and pesos balances combined at the
 * exchange rate of each point's day.
 */
export function useNetWorth(from: string, to: string, granularity?: 'daily' | 'monthly') {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'net-worth', from, to, granularity, currency],
    queryFn: () => reportsApi.getNetWorth(from, to, currency, granularity),
  });
}

/**
 * Net worth for a yyyy-MM range as the reports show it: a point per day for short ranges (up to
 * DAILY_MAX_MONTHS), starting at the previous month's close so the change covers the whole
 * range; a point per month otherwise.
 */
export function useNetWorthSeries(from: string, to: string) {
  const daily = monthCount(from, to) <= DAILY_MAX_MONTHS;
  const days = dayBounds(from, to);
  const start = format(subDays(parseISO(days.from), 1), 'yyyy-MM-dd');
  return useNetWorth(daily ? start : from, daily ? days.to : to, daily ? 'daily' : undefined);
}

export function useIncomeVsExpenses(from: string, to: string) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'income-expenses', from, to, currency],
    queryFn: () => reportsApi.getIncomeVsExpenses(from, to, currency),
  });
}

export function useDailyFlow(from: string, to: string) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'daily-flow', from, to, currency],
    queryFn: () => reportsApi.getDailyFlow(from, to, currency),
  });
}

export function useSpendingByCategory(from: string, to: string) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'spending-by-category', from, to, currency],
    queryFn: () => reportsApi.getSpendingByCategory(from, to, currency),
  });
}

/** How many categories Spending Trends shows when none are chosen, and the most it can show. */
export const TOP_TREND_CATEGORIES = 5;
export const MAX_TREND_CATEGORIES = 5;

/** The `count` categories with the most spending in the range, biggest first. */
export function useTopSpendingCategories(from: string, to: string, count: number) {
  const { data, isLoading } = useSpendingByCategory(from, to);
  const ids = useMemo(
    () =>
      [...(data ?? [])]
        .filter((d) => d.categoryId)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, count)
        .map((d) => d.categoryId!),
    [data, count],
  );
  return { ids, isLoading };
}

export function useIncomeByCategory(from: string, to: string) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'income-by-category', from, to, currency],
    queryFn: () => reportsApi.getIncomeByCategory(from, to, currency),
  });
}

export function useSpendingTrends(
  categoryIds: string[],
  from: string,
  to: string,
  granularity?: 'daily' | 'monthly',
) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: [
      'reports',
      'spending-trends',
      categoryIds.join(','),
      from,
      to,
      granularity,
      currency,
    ],
    queryFn: () => reportsApi.getSpendingTrends(categoryIds, from, to, currency, granularity),
    enabled: categoryIds.length > 0,
  });
}

export function useSpendingComparison(mode: string) {
  const currency = useViewingCurrency();
  return useQuery({
    queryKey: ['reports', 'spending-comparison', mode, currency],
    queryFn: () => reportsApi.getSpendingComparison(mode, currency),
  });
}
