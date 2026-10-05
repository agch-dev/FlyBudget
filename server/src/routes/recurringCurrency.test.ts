import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { addDays, format, subMonths } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  payees,
  scheduleMatchDismissals,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

// A recurring item belongs to an account, so its amounts are native amounts in that
// account's currency: nothing about it may be compared with, or paid by, the other currency.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const get = async (path: string) => (await send('GET', path)).body;

const day = (d: Date) => format(d, 'yyyy-MM-dd');
const today = day(new Date());
const PESOS = 'acct-uyu';
const DOLLARS = 'acct-usd';

beforeEach(() => {
  db.delete(scheduleMatchDismissals).run();
  db.delete(scheduleOccurrences).run();
  db.delete(transactions).run();
  db.delete(schedules).run();
  db.delete(payees).run();
  db.delete(accounts).run();
  db.insert(accounts)
    .values([
      { id: PESOS, name: 'Caja de ahorro', type: 'savings', currency: 'UYU' },
      { id: DOLLARS, name: 'Caja de ahorro USD', type: 'savings', currency: 'USD' },
    ])
    .run();
  db.insert(payees).values({ id: 'netflix', name: 'Netflix' }).run();
});

const addSchedule = async (name: string, accountId: string | null, amount: number) =>
  (
    await send('POST', '/schedules', {
      name,
      accountId,
      amount,
      payeeId: 'netflix',
      recurrenceType: 'monthly',
      startDate: today,
    })
  ).body;

const addTransaction = async (accountId: string, date: string, amount: number) =>
  (await send('POST', '/transactions', { accountId, date, amount, payeeName: 'Netflix' })).body;

const occurrencesOf = async (scheduleId: string) =>
  (await get(`/schedules/occurrences?from=${today}&to=${day(addDays(new Date(), 40))}`)).filter(
    (o: { scheduleId: string }) => o.scheduleId === scheduleId,
  );

describe("a recurring item has its account's currency", () => {
  it('in the list of recurring items, on its own and on each of its occurrences', async () => {
    const dollars = await addSchedule('Netflix', DOLLARS, -15_99);
    const pesos = await addSchedule('Alquiler', PESOS, -30_000_00);
    const unassigned = await addSchedule('Sin cuenta', null, -500_00);
    expect(dollars.currency).toBe('USD');
    expect(pesos.currency).toBe('UYU');

    const list = await get('/schedules');
    const currencyOf = (id: string) => list.find((s: { id: string }) => s.id === id).currency;
    expect(currencyOf(dollars.id)).toBe('USD');
    expect(currencyOf(pesos.id)).toBe('UYU');
    // With no account there is nothing to say otherwise: the home currency
    expect(currencyOf(unassigned.id)).toBe('UYU');

    expect((await get(`/schedules/${dollars.id}`)).currency).toBe('USD');

    const [occurrence] = await occurrencesOf(dollars.id);
    expect(occurrence).toMatchObject({ expectedAmount: -15_99, currency: 'USD' });
    expect((await occurrencesOf(pesos.id))[0].currency).toBe('UYU');
  });

  it('even after the account is closed', async () => {
    const dollars = await addSchedule('Netflix', DOLLARS, -15_99);
    db.update(accounts).set({ closedAt: today }).run();

    const list = await get('/schedules');
    expect(list.find((s: { id: string }) => s.id === dollars.id).currency).toBe('USD');
    expect((await occurrencesOf(dollars.id))[0].currency).toBe('USD');
  });

  it("follows the item to another account when it's moved", async () => {
    const item = await addSchedule('Netflix', PESOS, -15_99);
    const moved = await send('PUT', `/schedules/${item.id}`, { accountId: DOLLARS });
    expect(moved.body.currency).toBe('USD');
  });
});

describe('marking an occurrence paid', () => {
  it("creates a transaction in the item's account with the native amount", async () => {
    const item = await addSchedule('Netflix', DOLLARS, -15_99);
    const paid = await send('POST', `/schedules/${item.id}/mark-paid`, { date: today });
    expect(paid.status).toBe(201);

    const rows = await get('/transactions');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accountId: DOLLARS, amount: -15_99, currency: 'USD' });

    const balance = (id: string, list: Array<{ id: string; balance: number }>) =>
      list.find((a) => a.id === id)!.balance;
    const list = await get('/accounts');
    expect(balance(DOLLARS, list)).toBe(-15_99);
    expect(balance(PESOS, list)).toBe(0);
  });

  it('keeps an amount typed when paying as a native amount too', async () => {
    const item = await addSchedule('Netflix', DOLLARS, -15_99);
    await send('POST', `/schedules/${item.id}/mark-paid`, { date: today, amount: -17_49 });
    const [occurrence] = await occurrencesOf(item.id);
    expect(occurrence).toMatchObject({ matchedAmount: -17_49, currency: 'USD' });
  });
});

describe('find recurring', () => {
  const months = (n: number) => day(subMonths(new Date(), n));

  it('finds an item paid three months running from one account, in that currency', async () => {
    for (const n of [3, 2, 1]) await addTransaction(DOLLARS, months(n), -15_99);

    const found = await get('/schedules/discover');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ accountId: DOLLARS, amount: -15_99, currency: 'USD' });
  });

  it('never matches across currencies: the same amount split between a pesos and a dollars account is no pattern', async () => {
    await addTransaction(DOLLARS, months(3), -15_99);
    await addTransaction(PESOS, months(2), -15_99);
    await addTransaction(DOLLARS, months(1), -15_99);

    expect(await get('/schedules/discover')).toEqual([]);
  });
});

describe('matching a transaction to an occurrence', () => {
  it('only suggests transactions in the same currency as the recurring item', async () => {
    const item = await addSchedule('Netflix', DOLLARS, -15_99);
    await addTransaction(PESOS, today, -15_99);
    expect(await get('/schedules/match-suggestions')).toEqual([]);

    const inDollars = await addTransaction(DOLLARS, today, -15_99);
    const suggestions = await get('/schedules/match-suggestions');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ scheduleId: item.id, currency: 'USD' });
    expect(
      suggestions[0].candidates.map((c: { transactionId: string }) => c.transactionId),
    ).toEqual([inDollars.id]);
  });

  it('suggests pesos transactions for an item with no account', async () => {
    await addSchedule('Netflix', null, -15_99);
    await addTransaction(DOLLARS, today, -15_99);
    expect(await get('/schedules/match-suggestions')).toEqual([]);

    const inPesos = await addTransaction(PESOS, today, -15_99);
    const [suggestion] = await get('/schedules/match-suggestions');
    expect(suggestion.currency).toBe('UYU');
    expect(suggestion.candidates.map((c: { transactionId: string }) => c.transactionId)).toEqual([
      inPesos.id,
    ]);
  });

  it('refuses to link a transaction of the other currency by hand', async () => {
    const item = await addSchedule('Netflix', DOLLARS, -15_99);
    const [occurrence] = await occurrencesOf(item.id);
    const inPesos = await addTransaction(PESOS, today, -15_99);
    const inDollars = await addTransaction(DOLLARS, today, -15_99);

    const refused = await send('POST', `/schedules/occurrences/${occurrence.id}/match`, {
      transactionId: inPesos.id,
    });
    expect(refused.status).toBe(400);
    expect((await occurrencesOf(item.id))[0].matchedTransactionId).toBeNull();

    const linked = await send('POST', `/schedules/occurrences/${occurrence.id}/match`, {
      transactionId: inDollars.id,
    });
    expect(linked.status).toBe(200);
    expect((await occurrencesOf(item.id))[0].matchedTransactionId).toBe(inDollars.id);
  });
});
