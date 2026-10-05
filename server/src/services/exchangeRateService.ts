import { asc, desc, eq, sql } from 'drizzle-orm';
import { format } from 'date-fns';
import { db } from '../db/index.js';
import { exchangeRates } from '../db/schema.js';
import {
  backfillRange,
  rateLookup,
  refreshRange,
  type DateRange,
  type RatePoint,
} from './exchangeRates.js';

// The stored exchange rates (pesos per dollar, one per date) and keeping them up to date.
// The pure rules are in exchangeRates.ts. The source is passed in (`RateSource`), so this
// module has no network code: the server gives it exchangeRateSource.ts, the in-browser demo
// and the tests give it something that never leaves the machine.
//
// The source is a personal API. Everything here is built to ask it as little as possible:
// one request per call at most, none when the stored rates already answer the question.

/** Fetches the rates published for a range of dates (both inclusive). */
export type RateSource = (range: DateRange) => Promise<RatePoint[]>;

export interface StoredRate extends RatePoint {
  /** When it was fetched, or typed in (ISO timestamp) */
  fetchedAt: string;
  /** Entered by hand: fetches leave it alone */
  manual: boolean;
}

export interface ExchangeRatesOverview {
  /** Every stored rate, oldest first */
  rates: StoredRate[];
  /** The rate in effect today: today's, or the closest earlier one */
  current: RatePoint | null;
  /** When rates last came from the source */
  lastFetchedAt: string | null;
}

export interface FetchResult {
  /** Whether the source was asked */
  fetched: boolean;
  /** Rates added or updated */
  stored: number;
}

const NOT_FETCHED: FetchResult = { fetched: false, stored: 0 };

const localDate = (now: Date) => format(now, 'yyyy-MM-dd');

const toStored = (row: typeof exchangeRates.$inferSelect): StoredRate => ({
  date: row.date,
  rate: row.rate,
  fetchedAt: row.fetchedAt,
  manual: row.isManual === 1,
});

/** Every stored rate, oldest first. Feed it to `rateLookup` to convert amounts. */
export function listRates(): StoredRate[] {
  return db.select().from(exchangeRates).orderBy(asc(exchangeRates.date)).all().map(toStored);
}

export function ratesOverview(now = new Date()): ExchangeRatesOverview {
  const rates = listRates();
  const current = rateLookup(rates)(localDate(now));
  const fetchTimes = rates.filter((r) => !r.manual).map((r) => r.fetchedAt);
  return {
    rates,
    current: current && { date: current.date, rate: current.rate },
    // ISO timestamps sort as text
    lastFetchedAt: fetchTimes.length ? fetchTimes.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/** Enters or corrects one date's rate by hand. No fetch overwrites it afterwards. */
export function saveManualRate(date: string, rate: number, now = new Date()): StoredRate {
  const row = { date, rate, fetchedAt: now.toISOString(), isManual: 1 };
  db.insert(exchangeRates)
    .values(row)
    .onConflictDoUpdate({ target: exchangeRates.date, set: row })
    .run();
  return toStored(row);
}

/** The oldest or newest rate that came from the source (hand-entered ones don't count). */
function fetchedEdge(edge: 'oldest' | 'newest') {
  return db
    .select({ date: exchangeRates.date, fetchedAt: exchangeRates.fetchedAt })
    .from(exchangeRates)
    .where(eq(exchangeRates.isManual, 0))
    .orderBy(edge === 'oldest' ? asc(exchangeRates.date) : desc(exchangeRates.date))
    .limit(1)
    .get();
}

async function fetchAndStore(source: RateSource, range: DateRange, now: Date): Promise<number> {
  const fetched = await source(range);
  // The source isn't trusted to stay inside what it was asked for
  const rows = fetched.filter((r) => r.date >= range.start && r.date <= range.end);
  const fetchedAt = now.toISOString();
  let stored = 0;
  db.transaction((tx) => {
    for (const { date, rate } of rows) {
      stored += tx
        .insert(exchangeRates)
        .values({ date, rate, fetchedAt, isManual: 0 })
        .onConflictDoUpdate({
          target: exchangeRates.date,
          set: { rate, fetchedAt },
          // A hand-entered rate stays as the user left it
          setWhere: sql`${exchangeRates.isManual} = 0`,
        })
        .run().changes;
    }
  });
  return stored;
}

let refreshing: Promise<FetchResult> | null = null;

/**
 * Brings rates up to date: from the last fetched date (inclusive) through today, or from
 * `FIRST_RATE_DATE` on a first run. Without `force` (server start) it asks the source only
 * when the newest fetched rate is more than 24 hours old; `force` is the Refresh button.
 * Rejects when the source fails or answers nonsense, having stored nothing. A call made
 * while another is still fetching shares its request.
 */
export function refreshRates(
  source: RateSource,
  { force = false, now = new Date() }: { force?: boolean; now?: Date } = {},
): Promise<FetchResult> {
  if (refreshing) return refreshing;
  const range = refreshRange({
    newestFetched: fetchedEdge('newest') ?? null,
    now: now.getTime(),
    today: localDate(now),
    force,
  });
  if (!range) return Promise.resolve(NOT_FETCHED);
  const run = fetchAndStore(source, range, now)
    .then((stored) => ({ fetched: true, stored }))
    .finally(() => {
      refreshing = null;
    });
  refreshing = run;
  return run;
}

// Backfills run one after another, so each sees what the one before it stored
let backfilling: Promise<unknown> = Promise.resolve();
// The earliest date already asked of the source since this server started. The source may
// have nothing that old, and asking again for every old transaction would hammer it.
let askedFrom: string | null = null;

/**
 * Makes rates reach back to `date`: for a dollar transaction dated before every stored
 * rate. Fetches from `date` up to the earliest fetched rate, whatever the 24-hour wait
 * says, and does nothing when the stored rates already reach that far (so it is cheap to
 * call for every new dollar transaction). Rejects when the source fails; the caller should
 * still save its transaction.
 */
export function backfillRatesFrom(
  date: string,
  source: RateSource,
  now = new Date(),
): Promise<FetchResult> {
  const run = backfilling.then(async () => {
    const range = backfillRange({
      from: date,
      earliestFetched: fetchedEdge('oldest')?.date ?? null,
      alreadyAskedFrom: askedFrom,
      today: localDate(now),
    });
    if (!range) return NOT_FETCHED;
    const stored = await fetchAndStore(source, range, now);
    askedFrom = range.start;
    return { fetched: true, stored };
  });
  backfilling = run.catch(() => {});
  return run;
}

/** Tests only: forget what was fetched in this process. */
export function resetExchangeRateFetchState() {
  refreshing = null;
  backfilling = Promise.resolve();
  askedFrom = null;
}
