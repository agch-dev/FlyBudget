import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import {
  accounts,
  exchangeRates,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import type { DateRange, RatePoint } from '../services/exchangeRates.js';
import {
  backfillRatesForDate,
  backfillRatesForDollarTransactions,
  resetExchangeRateFetchState,
} from '../services/exchangeRateService.js';
import { accountsRouter } from './accounts.js';
import { createExchangeRatesRouter } from './exchangeRates.js';
import { createRateBackfill, createScheduleRateBackfill } from './rateBackfill.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

// A dollar transaction older than every stored rate fetches the missing history; when that
// can't be done the transaction is saved anyway and its date is reported as estimated.
// `source` stands in for the rate source (never the real one) and records what it was asked.
let asked: DateRange[] = [];
let answer: (range: DateRange) => RatePoint[] | Promise<RatePoint[]> = () => [];
const source = async (range: DateRange) => {
  asked.push(range);
  return answer(range);
};
const unreachable = () => {
  throw new Error('offline');
};

let server: Server;
let base: string;
let pesosId: string;
let dollarsId: string;
let otherDollarsId: string;

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const putRate = (date: string, rate: number) => send('PUT', `/exchange-rates/${date}`, { rate });
const estimatedAnswer = async () => (await send('GET', '/exchange-rates/estimated')).body;
const estimated = async () => ({ dates: (await estimatedAnswer()).dates });
const add = (accountId: string, date: string, amount = -1_000) =>
  send('POST', '/transactions', { accountId, date, amount, payeeName: 'Shop' });
const importRows = (accountId: string, dates: string[]) =>
  send('POST', '/transactions/import/confirm', {
    accountId,
    rows: dates.map((date, i) => ({
      date,
      amount: -500 - i,
      payeeName: `Row ${i}`,
      importedId: `row-${date}-${i}`,
    })),
  });

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/transactions', createRateBackfill(source), transactionsRouter);
  app.use('/api/schedules', createScheduleRateBackfill(source), schedulesRouter);
  app.use('/api/exchange-rates', createExchangeRatesRouter(source));
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const account = async (name: string, currency: string) =>
    (await send('POST', '/accounts', { name, type: 'checking', currency })).body.id as string;
  pesosId = await account('Pesos', 'UYU');
  dollarsId = await account('Dollars', 'USD');
  otherDollarsId = await account('Dollar savings', 'USD');
});
afterAll(() => server.close());

beforeEach(async () => {
  db.delete(scheduleOccurrences).run();
  db.delete(transactions).run();
  db.delete(schedules).run();
  db.delete(exchangeRates).run();
  resetExchangeRateFetchState();
  asked = [];
  answer = () => [];
});

/** Rates as the source stored them, from March 2024 on */
const storeFetched = (points: RatePoint[]) =>
  db
    .insert(exchangeRates)
    .values(points.map((p) => ({ ...p, fetchedAt: '2026-10-01T12:00:00.000Z', isManual: 0 })))
    .run();
const march: RatePoint[] = [
  { date: '2024-03-01', rate: 38.9 },
  { date: '2024-03-04', rate: 39.1 },
];

describe('adding a dollar transaction older than every stored rate', () => {
  it('fetches the missing history, however recently rates were fetched', async () => {
    storeFetched(march);
    answer = () => [{ date: '2023-11-10', rate: 39.8 }];
    const res = await add(dollarsId, '2023-11-10');
    expect(res.status).toBe(201);
    // A week before its date: the rate of a weekend or holiday is the previous business day's
    expect(asked).toEqual([{ start: '2023-11-03', end: '2024-03-01' }]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('uses the previous business day for a transaction on a weekend', async () => {
    storeFetched(march);
    answer = () => [
      { date: '2023-11-10', rate: 39.8 },
      { date: '2023-11-13', rate: 39.9 },
    ];
    await add(dollarsId, '2023-11-12');
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('saves the transaction when the source cannot be reached, and reports its date', async () => {
    storeFetched(march);
    answer = unreachable;
    const res = await add(dollarsId, '2023-11-10');
    expect(res.status).toBe(201);
    expect(res.body.date).toBe('2023-11-10');
    expect(asked).toHaveLength(1);
    expect(await estimated()).toEqual({ dates: ['2023-11-10'] });
  });

  it('asks a source that is down once, not for every save, start or bank sync', async () => {
    storeFetched(march);
    answer = unreachable;
    expect((await add(dollarsId, '2023-11-10')).status).toBe(201);
    expect((await add(dollarsId, '2022-02-02')).status).toBe(201);
    expect((await importRows(dollarsId, ['2021-01-05'])).body.imported).toBe(1);
    await backfillRatesForDollarTransactions(source).catch(() => {});
    expect(asked).toHaveLength(1);
    expect(await estimated()).toEqual({ dates: ['2021-01-05', '2022-02-02', '2023-11-10'] });
  });

  it('tries a source that was down again once an hour has passed', async () => {
    storeFetched(march);
    answer = unreachable;
    const failedAt = new Date('2026-10-05T10:00:00.000Z');
    const later = (minutes: number) => new Date(failedAt.getTime() + minutes * 60_000);
    await backfillRatesForDate('2023-11-10', source, failedAt).catch(() => {});
    answer = () => [{ date: '2023-11-03', rate: 39.8 }];
    expect(await backfillRatesForDate('2023-11-10', source, later(59))).toEqual({
      fetched: false,
      stored: 0,
    });
    expect(asked).toHaveLength(1);
    expect(await backfillRatesForDate('2023-11-10', source, later(61))).toEqual({
      fetched: true,
      stored: 1,
    });
    expect(asked).toHaveLength(2);
  });

  it('asks once for a transaction older than anything the source has', async () => {
    storeFetched(march);
    answer = () => [];
    expect((await add(dollarsId, '2019-05-10')).status).toBe(201);
    expect((await add(dollarsId, '2019-05-10')).status).toBe(201);
    expect((await add(dollarsId, '2020-01-01')).status).toBe(201);
    await backfillRatesForDollarTransactions(source);
    expect(asked).toEqual([{ start: '2019-05-03', end: '2024-03-01' }]);
  });

  it('asks nothing for a date the stored rates already cover', async () => {
    storeFetched(march);
    expect((await add(dollarsId, '2024-03-02')).status).toBe(201);
    expect((await add(dollarsId, '2026-01-15')).status).toBe(201);
    await putRate('2023-06-01', 38.2);
    expect((await add(dollarsId, '2023-06-20')).status).toBe(201);
    expect(asked).toEqual([]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('fetches once for a transfer into a dollar account', async () => {
    storeFetched(march);
    const res = await send('POST', '/transactions/transfer', {
      fromAccountId: pesosId,
      toAccountId: dollarsId,
      date: '2023-12-20',
      amount: 400_000,
      toAmount: 10_000,
    });
    expect(res.status).toBe(201);
    expect(asked).toEqual([{ start: '2023-12-13', end: '2024-03-01' }]);
  });

  it('fetches once for a transfer out of a dollar account, or between two of them', async () => {
    storeFetched(march);
    const out = await send('POST', '/transactions/transfer', {
      fromAccountId: dollarsId,
      toAccountId: pesosId,
      date: '2023-12-20',
      amount: 10_000,
      toAmount: 400_000,
    });
    expect(out.status).toBe(201);
    expect(asked).toEqual([{ start: '2023-12-13', end: '2024-03-01' }]);
    const between = await send('POST', '/transactions/transfer', {
      fromAccountId: dollarsId,
      toAccountId: otherDollarsId,
      date: '2023-10-02',
      amount: 5_000,
    });
    expect(between.status).toBe(201);
    expect(asked).toEqual([
      { start: '2023-12-13', end: '2024-03-01' },
      { start: '2023-09-25', end: '2024-03-01' },
    ]);
  });

  it('saves a transfer when the source cannot be reached', async () => {
    storeFetched(march);
    answer = unreachable;
    const res = await send('POST', '/transactions/transfer', {
      fromAccountId: pesosId,
      toAccountId: dollarsId,
      date: '2023-12-20',
      amount: 400_000,
      toAmount: 10_000,
    });
    expect(res.status).toBe(201);
    expect(asked).toHaveLength(1);
    expect(await estimated()).toEqual({ dates: ['2023-12-20'] });
  });

  it('never fetches for a transfer between pesos accounts', async () => {
    storeFetched(march);
    const other = (await send('POST', '/accounts', { name: 'Savings', type: 'savings' })).body.id;
    const res = await send('POST', '/transactions/transfer', {
      fromAccountId: pesosId,
      toAccountId: other,
      date: '2019-12-20',
      amount: 4_000,
    });
    expect(res.status).toBe(201);
    expect(asked).toEqual([]);
  });

  it('does not keep the save waiting for a slow source', async () => {
    storeFetched(march);
    let release!: (points: RatePoint[]) => void;
    answer = () => new Promise<RatePoint[]>((r) => (release = r));
    const app = express();
    app.use(express.json());
    app.use('/t', createRateBackfill(source, { maxWaitMs: 20 }), transactionsRouter);
    const slow = await new Promise<Server>((r) => {
      const s = app.listen(0, '127.0.0.1', () => r(s));
    });
    try {
      const res = await fetch(`http://127.0.0.1:${(slow.address() as AddressInfo).port}/t`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: dollarsId, date: '2023-11-10', amount: -1 }),
      });
      expect(res.status).toBe(201);
      expect(await estimated()).toEqual({ dates: ['2023-11-10'] });
      // The fetch finishes in the background and its rates still count
      release([{ date: '2023-11-10', rate: 39.8 }]);
      await backfillRatesForDollarTransactions(source);
      expect(await estimated()).toEqual({ dates: [] });
    } finally {
      slow.close();
    }
  });
});

describe('moving a dollar transaction to a date older than every stored rate', () => {
  it('fetches the missing history', async () => {
    storeFetched(march);
    const tx = (await add(dollarsId, '2024-05-02')).body;
    expect(asked).toEqual([]);
    answer = () => [{ date: '2023-11-10', rate: 39.8 }];
    const moved = await send('PUT', `/transactions/${tx.id}`, { date: '2023-11-10' });
    expect(moved.status).toBe(200);
    expect(asked).toEqual([{ start: '2023-11-03', end: '2024-03-01' }]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('fetches for the dollar side of a transfer edited from its pesos side', async () => {
    storeFetched(march);
    const made = await send('POST', '/transactions/transfer', {
      fromAccountId: pesosId,
      toAccountId: dollarsId,
      date: '2024-05-02',
      amount: 400_000,
      toAmount: 10_000,
    });
    expect(made.status).toBe(201);
    const rows: { id: string; accountId: string }[] = (await send('GET', '/transactions')).body;
    const pesosSide = rows.find((t) => t.accountId === pesosId)!;
    const moved = await send('PUT', `/transactions/${pesosSide.id}`, { date: '2023-11-10' });
    expect(moved.status).toBe(200);
    expect(asked).toEqual([{ start: '2023-11-03', end: '2024-03-01' }]);
  });

  it('saves the change when the source cannot be reached, and reports the date', async () => {
    storeFetched(march);
    const tx = (await add(dollarsId, '2024-05-02')).body;
    answer = unreachable;
    const moved = await send('PUT', `/transactions/${tx.id}`, { date: '2023-11-10' });
    expect(moved.status).toBe(200);
    expect(await estimated()).toEqual({ dates: ['2023-11-10'] });
  });

  it('asks nothing for an edit that leaves the date alone, or for a pesos transaction', async () => {
    storeFetched(march);
    const dollars = (await add(dollarsId, '2024-05-02')).body;
    const pesos = (await add(pesosId, '2024-05-02')).body;
    await send('PUT', `/transactions/${dollars.id}`, { notes: 'lunch' });
    await send('PUT', `/transactions/${pesos.id}`, { date: '2019-01-01' });
    await send('PUT', '/transactions/no-such-transaction', { date: '2019-01-01' });
    expect(asked).toEqual([]);
  });
});

describe('marking a recurring item paid in a dollar account', () => {
  const recurring = async (accountId: string) =>
    (
      await send('POST', '/schedules', {
        name: 'Hosting',
        accountId,
        amount: -2_000,
        recurrenceType: 'monthly',
        startDate: '2026-01-10',
      })
    ).body;

  it('fetches the missing history for a payment older than every stored rate', async () => {
    storeFetched(march);
    const item = await recurring(dollarsId);
    answer = () => [{ date: '2023-11-10', rate: 39.8 }];
    const paid = await send('POST', `/schedules/${item.id}/mark-paid`, { date: '2023-11-10' });
    expect(paid.status).toBe(201);
    expect(asked).toEqual([{ start: '2023-11-03', end: '2024-03-01' }]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('asks nothing for a pesos item, a covered date or any other recurring request', async () => {
    storeFetched(march);
    const inPesos = await recurring(pesosId);
    const inDollars = await recurring(dollarsId);
    await send('POST', `/schedules/${inPesos.id}/mark-paid`, { date: '2023-11-10' });
    await send('POST', `/schedules/${inDollars.id}/mark-paid`, { date: '2026-01-10' });
    await send('PUT', `/schedules/${inDollars.id}`, { name: 'Servers' });
    expect(asked).toEqual([]);
  });
});

describe('importing into a dollar account', () => {
  it('fetches once, from the earliest row, however many rows there are', async () => {
    storeFetched(march);
    answer = () => [{ date: '2022-05-02', rate: 40.9 }];
    const dates = ['2023-08-01', '2022-05-03', '2024-06-01', '2022-05-02', '2023-01-15'];
    const res = await importRows(dollarsId, dates);
    expect(res.body).toEqual({ imported: 5, skipped: 0 });
    expect(asked).toEqual([{ start: '2022-04-25', end: '2024-03-01' }]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('imports every row when the source cannot be reached, asking only once', async () => {
    storeFetched(march);
    answer = unreachable;
    const res = await importRows(dollarsId, ['2023-08-01', '2022-05-03', '2024-06-01']);
    expect(res.body).toEqual({ imported: 3, skipped: 0 });
    expect(asked).toHaveLength(1);
    expect(await estimated()).toEqual({ dates: ['2022-05-03', '2023-08-01'] });
  });
});

describe('a budget in pesos only', () => {
  it('never fetches and has no estimated dates, however old its transactions', async () => {
    storeFetched(march);
    expect((await add(pesosId, '2019-02-03')).status).toBe(201);
    expect((await importRows(pesosId, ['2018-01-01', '2020-07-07'])).body.imported).toBe(2);
    await backfillRatesForDollarTransactions(source);
    expect(asked).toEqual([]);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('has no estimated dates even with no rates stored at all', async () => {
    await add(pesosId, '2019-02-03');
    expect(asked).toEqual([]);
    expect(await estimated()).toEqual({ dates: [] });
  });
});

describe('estimated dates', () => {
  beforeEach(() => {
    answer = unreachable;
  });

  it('lists each date once, oldest first, across dollar accounts', async () => {
    storeFetched(march);
    await add(dollarsId, '2023-11-10');
    await add(otherDollarsId, '2023-02-01');
    await add(dollarsId, '2023-11-10', -2_000);
    await add(dollarsId, '2024-03-01');
    await add(pesosId, '2023-05-05');
    expect(await estimated()).toEqual({ dates: ['2023-02-01', '2023-11-10'] });
  });

  it('lists every dollar date while no rate is stored', async () => {
    await add(dollarsId, '2026-09-30');
    expect(await estimated()).toEqual({ dates: ['2026-09-30'] });
  });

  it('says dollar amounts are not counted at all while no rate is stored', async () => {
    await add(pesosId, '2026-09-30');
    // Dollar accounts with nothing in them leave nothing out
    expect(await estimatedAnswer()).toEqual({ dates: [], notCounted: false });
    await add(dollarsId, '2026-09-30');
    expect(await estimatedAnswer()).toEqual({ dates: ['2026-09-30'], notCounted: true });
    // Any rate at all converts every date, the earlier ones as an estimate
    await putRate('2026-10-01', 40);
    expect(await estimatedAnswer()).toEqual({ dates: ['2026-09-30'], notCounted: false });
  });

  it('counts a dollar starting balance as something left out', async () => {
    const { body: savings } = await send('POST', '/accounts', {
      name: 'Colchón',
      type: 'savings',
      currency: 'USD',
      startingBalance: 500_000,
    });
    expect(await estimatedAnswer()).toEqual({ dates: [], notCounted: true });
    await putRate('2026-10-01', 40);
    expect(await estimatedAnswer()).toEqual({ dates: [], notCounted: false });
    db.delete(accounts).where(eq(accounts.id, savings.id)).run();
  });

  it('drops a date once a rate is entered by hand on or before it', async () => {
    storeFetched(march);
    await add(dollarsId, '2023-02-01');
    await add(dollarsId, '2023-11-10');
    await putRate('2023-11-10', 39.8);
    expect(await estimated()).toEqual({ dates: ['2023-02-01'] });
    await putRate('2023-02-01', 38.5);
    expect(await estimated()).toEqual({ dates: [] });
  });

  it('drops the dates a later fetch covers (the next server start)', async () => {
    storeFetched(march);
    await add(dollarsId, '2023-11-10');
    expect(await estimated()).toEqual({ dates: ['2023-11-10'] });
    asked = [];
    answer = () => [{ date: '2023-11-09', rate: 39.7 }];
    // A new server process remembers nothing of the failed attempt
    resetExchangeRateFetchState();
    await backfillRatesForDollarTransactions(source);
    expect(asked).toEqual([{ start: '2023-11-03', end: '2024-03-01' }]);
    expect(await estimated()).toEqual({ dates: [] });
  });
});
