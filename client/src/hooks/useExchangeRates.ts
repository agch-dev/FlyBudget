import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ratesApi from '../api/exchangeRates';

const KEY = ['exchange-rates'];
// Under KEY, so saving a rate refreshes it too
const ESTIMATED_KEY = [...KEY, 'estimated'];

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
      qc.invalidateQueries({ queryKey: ESTIMATED_KEY });
    },
  });
}

/** Enters or corrects one date's rate by hand. */
export function useSaveExchangeRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ratesApi.saveExchangeRate,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
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
