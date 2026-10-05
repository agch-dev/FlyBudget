import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as ratesApi from '../api/exchangeRates';
import type { DatedRate } from '../utils/balanceConversion';

const KEY = ['exchange-rates'];
// Under KEY, so saving a rate refreshes it too
const ESTIMATED_KEY = [...KEY, 'estimated'];

/**
 * Queries whose answers hold converted amounts. Converted amounts are worked out from the
 * rates each time they are read (docs/adr/0001), so a new or corrected rate changes them:
 * every rate mutation refetches these. Add the key of any query that starts converting.
 */
export const CONVERTED_QUERY_KEYS = [
  ['budget'],
  ['budget-summary'],
  ['category-history'],
  ['transactions'],
  // Every report, dashboard card and the cash flow diagram ('reports', …), custom reports included
  ['reports'],
  ['schedule-occurrences'],
  ['schedule-summary'],
  ['goals'],
] as const;

function ratesChanged(qc: QueryClient) {
  for (const queryKey of CONVERTED_QUERY_KEYS) qc.invalidateQueries({ queryKey });
}

/** Every stored exchange rate, today's rate and when rates were last fetched. */
export const useExchangeRates = () =>
  useQuery({ queryKey: KEY, queryFn: ratesApi.getExchangeRates });

const NO_RATES: DatedRate[] = [];

/**
 * What a total of account balances converts with: every stored rate and today's date
 * (yyyy-MM-dd), for `balancesTotal`, `groupTotal` and `totalAndChange`. One source for the
 * sidebar, the Accounts page and their groups, so the same accounts always add up to the same
 * figure.
 */
export function useBalanceRates(): { rates: readonly DatedRate[]; today: string } {
  const rates = useExchangeRates().data?.rates ?? NO_RATES;
  return { rates, today: format(new Date(), 'yyyy-MM-dd') };
}

/** The Refresh button: the server fetches from the last stored date through today. */
export function useRefreshExchangeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ratesApi.refreshExchangeRates,
    onSuccess: (overview) => {
      qc.setQueryData(KEY, overview);
      ratesChanged(qc);
      qc.invalidateQueries({ queryKey: ESTIMATED_KEY });
    },
  });
}

/** Enters or corrects one date's rate by hand. */
export function useSaveExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ratesApi.saveExchangeRate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      ratesChanged(qc);
    },
  });
}

/**
 * The dates of dollar transactions older than every stored rate (the estimated-rates
 * banner). It changes when transactions do, and every change to transactions reloads the
 * accounts (their balances), so it reloads whenever fresh accounts arrive.
 */
export function useEstimatedRateDates() {
  const qc = useQueryClient();
  useEffect(
    () =>
      qc.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'success' &&
          event.query.queryKey[0] === 'accounts'
        ) {
          void qc.invalidateQueries({ queryKey: ESTIMATED_KEY });
        }
      }),
    [qc],
  );
  return useQuery({ queryKey: ESTIMATED_KEY, queryFn: ratesApi.getEstimatedRateDates });
}
