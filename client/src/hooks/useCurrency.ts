import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as currencyApi from '../api/currency';
import { useAccounts } from './useAccounts';
import { useCurrencyStore } from '../store/currencyStore';
import { usePreferencesStore } from '../store/preferencesStore';
import {
  secondaryCurrencyOptions,
  secondaryFigure,
  secondaryLookup,
} from '../utils/secondaryCurrency';
import type { CurrencySettings, ExchangeRate } from '../types';

const KEY = ['currency'];

export function useCurrencySettings() {
  return useQuery({ queryKey: KEY, queryFn: currencyApi.getCurrencySettings });
}

/** The budget's currency (null while none is chosen) */
export const useBudgetCurrency = () => useCurrencyStore((s) => s.budgetCurrency);

/**
 * Keeps the budget's currency where the formatters read it. Mounted once, in AppShell; the
 * offline copy restores the last answer, so amounts look right even before the server replies.
 */
export function useBudgetCurrencySync() {
  const { data } = useCurrencySettings();
  const set = useCurrencyStore((s) => s.setBudgetCurrency);
  useEffect(() => {
    if (data) set(data.currency);
  }, [data, set]);
}

/** Whether this budget has accounts in more than one currency */
export function useHasForeignCurrencies() {
  const { data } = useCurrencySettings();
  return !!data?.currency && data.foreignCurrencies.length > 0;
}

/**
 * After rates or the budget's currency change, values in the budget's currency change
 * everywhere (budget, reports, balances): refetch everything
 */
function useRefreshAll() {
  const qc = useQueryClient();
  return (settings?: CurrencySettings) => {
    if (settings) {
      qc.setQueryData(KEY, settings);
      useCurrencyStore.getState().setBudgetCurrency(settings.currency);
    }
    qc.invalidateQueries();
  };
}

export function useSetBudgetCurrency() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: currencyApi.setBudgetCurrency, onSuccess: refresh });
}

export function useSetRateDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: currencyApi.setRateDownload,
    onSuccess: (settings) => qc.setQueryData(KEY, settings),
  });
}

export function useDownloadRates() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: currencyApi.downloadRates,
    onSuccess: (result) => refresh(result.settings),
    // A failed download saves its message in the settings: show it
    onError: () => refresh(),
  });
}

export function useRates(
  params: { base?: string; quote?: string; source?: 'manual' | 'ecb'; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: ['currency', 'rates', params],
    queryFn: () => currencyApi.getRates(params),
    enabled,
  });
}

export function useAddRate() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: currencyApi.addRate, onSuccess: () => refresh() });
}

export function useDeleteRate() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: currencyApi.deleteRate, onSuccess: () => refresh() });
}

export function useRecalculate() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: currencyApi.recalculate, onSuccess: () => refresh() });
}

/** What an amount is at the day's rate in another currency, for prefilling a field */
export function useConverted(
  params: { from: string | null; to: string | null; date: string; amount: number },
  enabled = true,
) {
  const { from, to, date, amount } = params;
  return useQuery({
    queryKey: ['currency', 'convert', from, to, date, amount],
    queryFn: () => currencyApi.convertAmount({ from: from!, to: to!, date, amount }),
    enabled:
      enabled && !!from && !!to && from !== to && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 60_000,
  });
}

/** Each account's currency (null = the budget's, while it has none), from the cached accounts */
export function useAccountCurrency(): (accountId: string | null | undefined) => string | null {
  const { data: accounts } = useAccounts();
  const budget = useBudgetCurrency();
  return (accountId) =>
    (accountId ? accounts?.find((a) => a.id === accountId)?.currency : null) ?? budget;
}

const NO_RATES: ExchangeRate[] = [];

/** The currencies offered as a Secondary Currency (accounts' and typed-in rates', not the budget's) */
export function useSecondaryCurrencyOptions(): string[] {
  const { data: settings } = useCurrencySettings();
  const budget = settings?.currency ?? null;
  const { data: typedIn = NO_RATES } = useRates({ source: 'manual', limit: 1000 }, !!budget);
  const foreign = settings?.foreignCurrencies;
  return useMemo(
    () => secondaryCurrencyOptions(budget, foreign ?? [], typedIn),
    [budget, foreign, typedIn],
  );
}

/** A figure in the budget's currency at `day`, in the Secondary Currency (see secondaryFigure) */
export function useSecondaryFigure(amount: number, day: string) {
  const secondary = usePreferencesStore((s) => s.secondaryCurrency);
  const budget = useBudgetCurrency();
  const offered = useSecondaryCurrencyOptions();
  const input = { secondary, budget, offered, amount };
  const lookup = secondaryLookup(input);
  const { data: conversion } = useConverted(
    { from: lookup?.from ?? null, to: lookup?.to ?? null, date: day, amount: lookup?.amount ?? 0 },
    !!lookup,
  );
  return secondaryFigure({ ...input, day, conversion });
}
