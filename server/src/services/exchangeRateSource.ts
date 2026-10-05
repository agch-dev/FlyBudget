import { isRealDate } from '../utils/validation.js';
import { parseRatesResponse, type DateRange, type RatePoint } from './exchangeRates.js';
import { readTextLimited, safeFetch } from './safeFetch.js';

// The one place FlyBudget contacts the exchange rate source: the interbank pesos-per-dollar
// rate for a range of dates, one entry per Uruguayan business day.
//
// It is a personal API, so be kind to it: one request per call, no retries, and callers
// (exchangeRateService.ts) decide whether a request is needed at all. Never call it from
// tests. Node-only (network): the in-browser demo must not import this file.

const RATES_URL = 'https://datosuruguay.com/dolar.json';
const TIMEOUT_MS = 15_000;
// Ten years of daily rates is about 100 KB
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * Fetches the rates for a range of dates (both inclusive). The address is fixed, but the
 * answer is still untrusted: https only, a timeout, a size cap, and every row validated
 * (`parseRatesResponse`). Throws on any failure.
 */
export async function fetchRatesFromSource(
  range: DateRange,
  fetchImpl: typeof safeFetch = safeFetch,
): Promise<RatePoint[]> {
  if (!isRealDate(range.start) || !isRealDate(range.end) || range.start > range.end) {
    throw new Error('Invalid exchange rate date range');
  }
  const url = new URL(RATES_URL);
  url.search = new URLSearchParams({
    range: 'custom',
    start_date: range.start,
    end_date: range.end,
  }).toString();

  const response = await fetchImpl(
    url,
    { headers: { accept: 'application/json' } },
    { timeoutMs: TIMEOUT_MS },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Exchange rate source answered ${response.status}`);
  }
  return parseRatesResponse(JSON.parse(await readTextLimited(response, MAX_RESPONSE_BYTES)));
}

/** For when fetching is switched off (`FLYBUDGET_EXCHANGE_RATES=off`): never asks anyone. */
export const ratesDisabledSource = async (_range: DateRange): Promise<RatePoint[]> => {
  throw new Error('Fetching exchange rates is switched off (FLYBUDGET_EXCHANGE_RATES=off)');
};
