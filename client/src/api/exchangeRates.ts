import { apiFetch } from './client';

// Exchange rates: pesos per dollar, one per date. The page only ever asks FlyBudget's own
// server; the server is what fetches rates from the source.

export interface ExchangeRate {
  /** YYYY-MM-DD */
  date: string;
  /** Pesos per dollar */
  rate: number;
  /** When it was fetched, or typed in (ISO timestamp) */
  fetchedAt: string;
  /** Entered by hand: fetches leave it alone */
  manual: boolean;
}

export interface ExchangeRatesOverview {
  /** Every stored rate, oldest first */
  rates: ExchangeRate[];
  /** The rate in effect today: today's, or the closest earlier one */
  current: { date: string; rate: number } | null;
  /** When rates last came from the source */
  lastFetchedAt: string | null;
}

export const getExchangeRates = () => apiFetch<ExchangeRatesOverview>('/exchange-rates');

/** Fetches from the last stored date through today */
export const refreshExchangeRates = () =>
  apiFetch<ExchangeRatesOverview>('/exchange-rates/refresh', { method: 'POST' });

/** Enters or corrects one date's rate by hand */
export const saveExchangeRate = ({ date, rate }: { date: string; rate: number }) =>
  apiFetch<ExchangeRate>(`/exchange-rates/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify({ rate }),
  });

export interface EstimatedRateDates {
  /**
   * Dates (YYYY-MM-DD, oldest first) of dollar transactions with no rate on or before them:
   * their converted amounts use the closest rate there is
   */
  dates: string[];
}

export const getEstimatedRateDates = () =>
  apiFetch<EstimatedRateDates>('/exchange-rates/estimated');
