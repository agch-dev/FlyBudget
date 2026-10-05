import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as ratesApi from '../api/exchangeRates';

const KEY = ['exchange-rates'];

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
] as const;

function ratesChanged(qc: QueryClient) {
  for (const queryKey of CONVERTED_QUERY_KEYS) qc.invalidateQueries({ queryKey });
}

/** Every stored exchange rate, today's rate and when rates were last fetched. */
export const useExchangeRates = () =>
  useQuery({ queryKey: KEY, queryFn: ratesApi.getExchangeRates });

/** The Refresh button: the server fetches from the last stored date through today. */
export function useRefreshExchangeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ratesApi.refreshExchangeRates,
    onSuccess: (overview) => {
      qc.setQueryData(KEY, overview);
      ratesChanged(qc);
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
