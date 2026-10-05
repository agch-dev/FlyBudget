import type { NextFunction, Request, Response } from 'express';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts } from '../db/schema.js';
import { backfillRatesForDate, type RateSource } from '../services/exchangeRateService.js';
import { HOME_CURRENCY } from '../utils/currency.js';
import { isoDate } from '../utils/validation.js';

// Runs in front of the transactions router (`app.use('/api/transactions', createRateBackfill(
// source), transactionsRouter)`). A new dollar transaction dated before every stored exchange
// rate needs older rates than the app has: this fetches them before the transaction is saved,
// whatever the 24-hour wait says. It never refuses or changes the request: when the source
// can't be reached the transaction is saved all the same, and its date shows up in
// GET /api/exchange-rates/estimated until a rate covers it.

/** How long a save waits for the source. A slower fetch carries on in the background. */
const MAX_WAIT_MS = 5_000;

const accountId = z.string().min(1).max(64);
const dated = z.object({ date: isoDate });

// Only what is needed to know which accounts and dates the request is about; the routes
// validate the rest. Each entry: the path it is posted to and how to read its body.
const NEW_TRANSACTIONS: Record<
  string,
  (body: unknown) => { accountIds: string[]; dates: string[] }
> = {
  '/': (body) => {
    const tx = dated.extend({ accountId }).parse(body);
    return { accountIds: [tx.accountId], dates: [tx.date] };
  },
  '/transfer': (body) => {
    const t = dated.extend({ fromAccountId: accountId, toAccountId: accountId }).parse(body);
    return { accountIds: [t.fromAccountId, t.toAccountId], dates: [t.date] };
  },
  // One fetch per import, from its earliest row
  '/import/confirm': (body) => {
    const { accountId: id, rows } = z
      .object({ accountId, rows: z.array(z.object({ date: z.unknown() })).max(100_000) })
      .parse(body);
    const dates = rows.map((r) => r.date).filter((d) => isoDate.safeParse(d).success);
    return { accountIds: [id], dates: dates as string[] };
  },
};

/** The earliest date a request adds to a dollar account, if any. */
function earliestDollarDate(path: string, body: unknown): string | null {
  const read = NEW_TRANSACTIONS[path];
  if (!read) return null;
  let request;
  try {
    request = read(body);
  } catch {
    return null; // Not a valid request: the route answers 400
  }
  if (request.dates.length === 0) return null;
  const inDollars = db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(inArray(accounts.id, request.accountIds))
    .all()
    .some((a) => a.currency !== HOME_CURRENCY);
  if (!inDollars) return null;
  // ISO dates sort as text
  return request.dates.reduce((a, b) => (a < b ? a : b));
}

export function createRateBackfill(source: RateSource, { maxWaitMs = MAX_WAIT_MS } = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const date = req.method === 'POST' ? earliestDollarDate(req.path, req.body) : null;
    if (date) {
      const fetching = backfillRatesForDate(date, source).catch((err) =>
        console.error('Exchange rates: could not fetch older rates:', err?.message ?? err),
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waited = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, maxWaitMs);
      });
      await Promise.race([fetching, waited]);
      clearTimeout(timer);
    }
    next();
  };
}
