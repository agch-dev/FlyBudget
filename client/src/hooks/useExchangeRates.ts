import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ratesApi from '../api/exchangeRates';

const KEY = ['exchange-rates'];

/** Every stored exchange rate, today's rate and when rates were last fetched. */
export const useExchangeRates = () =>
  useQuery({ queryKey: KEY, queryFn: ratesApi.getExchangeRates });

/** The Refresh button: the server fetches from the last stored date through today. */
export function useRefreshExchangeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ratesApi.refreshExchangeRates,
    onSuccess: (overview) => qc.setQueryData(KEY, overview),
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
