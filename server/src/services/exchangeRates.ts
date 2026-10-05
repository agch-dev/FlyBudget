import { z } from 'zod';
import { isoDate } from '../utils/validation.js';

// Exchange rates: pesos per dollar on a date (interbank, no spread). The pure parts: looking
// a rate up, reading the source's answer, and deciding what to fetch. The database and the
// network live in exchangeRateService.ts and exchangeRateSource.ts.

export interface RatePoint {
  /** YYYY-MM-DD */
  date: string;
  /** Pesos per dollar */
  rate: number;
}

/** A fresh install starts here: nobody tracks finances in the app from before this. */
export const FIRST_RATE_DATE = '2024-01-01';

/** The source is a personal API: on its own, the app asks at most this often. */
export const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Above any pesos-per-dollar rate that could be real */
export const MAX_RATE = 100_000;

/**
 * Looks rates up by date. A date with no rate uses the closest earlier one (weekends and
 * holidays use the previous business day); a date before every rate has none (null).
 * `rates` may be in any order, one per date.
 */
export function rateLookup<T extends RatePoint>(rates: readonly T[]): (date: string) => T | null {
  // ISO dates sort as text
  const sorted = [...rates].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return (date) => {
    // The last rate dated on or before `date`
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (sorted[mid].date <= date) low = mid + 1;
      else high = mid;
    }
    return low === 0 ? null : sorted[low - 1];
  };
}

const sourceRate = z
  .union([z.string().regex(/^\d{1,9}(\.\d{1,9})?$/), z.number()])
  .transform(Number)
  .refine((rate) => Number.isFinite(rate) && rate > 0 && rate <= MAX_RATE);

const sourceResponse = z.object({
  // One entry per Uruguayan business day
  chart_data: z.array(z.object({ date: isoDate, rate: sourceRate })).max(50_000),
});

/**
 * Reads the source's answer (`{ chart_data: [{ date, rate }] }`). It is untrusted input: one
 * row that isn't a real date with a plausible rate rejects the whole answer (throws), so a
 * broken response never stores anything.
 */
export function parseRatesResponse(body: unknown): RatePoint[] {
  return sourceResponse.parse(body).chart_data.map(({ date, rate }) => ({ date, rate }));
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * What to fetch to bring rates up to date, or null when it isn't time yet. Starts at the
 * last fetched date (inclusive: that day may have been fetched before its rate was final)
 * and ends today. `force` (the Refresh button) skips the 24-hour wait.
 */
export function refreshRange(input: {
  /** The newest rate that came from the source (not one entered by hand) */
  newestFetched: { date: string; fetchedAt: string } | null;
  /** Milliseconds since the epoch */
  now: number;
  today: string;
  force?: boolean;
}): DateRange | null {
  const { newestFetched, now, today } = input;
  if (!newestFetched) return { start: FIRST_RATE_DATE, end: today };
  const age = now - Date.parse(newestFetched.fetchedAt);
  // A fetch time "in the future" means the clock moved: still wait
  if (!input.force && Math.abs(age) <= FETCH_INTERVAL_MS) return null;
  return { start: newestFetched.date < today ? newestFetched.date : today, end: today };
}

/**
 * What to fetch so rates reach back to `from` (a dollar transaction older than every stored
 * rate), or null when they already do, or when that was already asked of the source.
 */
export function backfillRange(input: {
  from: string;
  /** The oldest rate that came from the source */
  earliestFetched: string | null;
  /** The earliest date a backfill already asked for (the source may have nothing that old) */
  alreadyAskedFrom?: string | null;
  today: string;
}): DateRange | null {
  const { from, earliestFetched, alreadyAskedFrom, today } = input;
  if (from > today) return null;
  if (earliestFetched && from >= earliestFetched) return null;
  if (alreadyAskedFrom && from >= alreadyAskedFrom) return null;
  return { start: from, end: earliestFetched ?? today };
}
