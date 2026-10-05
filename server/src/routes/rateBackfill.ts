import type { NextFunction, Request, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accounts, schedules, transactions } from '../db/schema.js';
import { backfillRatesForDate, type RateSource } from '../services/exchangeRateService.js';
import { HOME_CURRENCY } from '../utils/currency.js';
import { isoDate } from '../utils/validation.js';

// Runs in front of the routers that save transactions (`app.use('/api/transactions',
// createRateBackfill(source), transactionsRouter)`, and `createScheduleRateBackfill` for
// `/api/schedules`). A dollar transaction dated before every stored exchange rate needs older
// rates than the app has: this fetches them before the transaction is saved, whatever the
// 24-hour wait says. It never refuses or changes the request: when the source can't be
// reached the transaction is saved all the same, and its date shows up in
// GET /api/exchange-rates/estimated until a rate covers it.

/** How long a save waits for the source. A slower fetch carries on in the background. */
const MAX_WAIT_MS = 5_000;

const accountId = z.string().min(1).max(64);
const dated = z.object({ date: isoDate });

/** The accounts and dates a request is about to write transactions for */
interface Writes {
  accountIds: (string | null)[];
  dates: string[];
}

/** Reads a request for the transactions it will save: null when it saves none. May throw. */
type WritesReader = (req: Request) => Writes | null;

// Only what is needed to know which accounts and dates a request is about; the routes
// validate the rest. Each entry: the path it is posted to and how to read its body.
const NEW_TRANSACTIONS: Record<string, (body: unknown) => Writes> = {
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

const ONE_ID = /^\/([^/]+)$/;
const MARK_PAID = /^\/([^/]+)\/mark-paid$/;

/** PUT /transactions/:id with a new date: the transaction's account and, for a transfer, the other side's */
function movedTransaction(req: Request): Writes | null {
  const txId = ONE_ID.exec(req.path)?.[1];
  if (!txId) return null;
  const { date, accountId: movedTo } = z
    .object({ date: isoDate.optional(), accountId: accountId.optional() })
    .parse(req.body);
  if (!date) return null;
  const other = alias(transactions, 'other');
  const existing = db
    .select({
      date: transactions.date,
      accountId: transactions.accountId,
      otherAccountId: other.accountId,
    })
    .from(transactions)
    .leftJoin(other, eq(other.id, transactions.transferTransactionId))
    .where(eq(transactions.id, txId))
    .get();
  if (!existing || existing.date === date) return null;
  return { accountIds: [movedTo ?? existing.accountId, existing.otherAccountId], dates: [date] };
}

const inTransactions: WritesReader = (req) => {
  if (req.method === 'PUT') return movedTransaction(req);
  if (req.method !== 'POST') return null;
  return NEW_TRANSACTIONS[req.path]?.(req.body) ?? null;
};

/** POST /schedules/:id/mark-paid creates a transaction in the recurring item's account */
const inSchedules: WritesReader = (req) => {
  const scheduleId = req.method === 'POST' ? MARK_PAID.exec(req.path)?.[1] : undefined;
  if (!scheduleId) return null;
  const { date } = dated.parse(req.body);
  const schedule = db
    .select({ accountId: schedules.accountId })
    .from(schedules)
    .where(eq(schedules.id, scheduleId))
    .get();
  return schedule ? { accountIds: [schedule.accountId], dates: [date] } : null;
};

/** The earliest date a request writes in a dollar account, if any. */
function earliestDollarDate(req: Request, read: WritesReader): string | null {
  let writes;
  try {
    writes = read(req);
  } catch {
    return null; // Not a valid request: the route answers 400
  }
  if (!writes || writes.dates.length === 0) return null;
  const ids = writes.accountIds.filter((id): id is string => !!id);
  if (ids.length === 0) return null;
  const inDollars = db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(inArray(accounts.id, ids))
    .all()
    .some((a) => a.currency !== HOME_CURRENCY);
  if (!inDollars) return null;
  // ISO dates sort as text
  return writes.dates.reduce((a, b) => (a < b ? a : b));
}

function rateBackfill(read: WritesReader, source: RateSource, maxWaitMs: number) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const date = earliestDollarDate(req, read);
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

/** For `/api/transactions`: new transactions, transfers, imports, and a date moved earlier */
export function createRateBackfill(source: RateSource, { maxWaitMs = MAX_WAIT_MS } = {}) {
  return rateBackfill(inTransactions, source, maxWaitMs);
}

/** For `/api/schedules`: marking an occurrence of a recurring item paid */
export function createScheduleRateBackfill(source: RateSource, { maxWaitMs = MAX_WAIT_MS } = {}) {
  return rateBackfill(inSchedules, source, maxWaitMs);
}
