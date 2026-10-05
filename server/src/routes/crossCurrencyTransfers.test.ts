import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { budgetRouter } from './budget.js';
import { reportsRouter } from './reports.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

// Buying dollars: $ 40,000 leaves a pesos account and US$ 1,000 arrives in a dollars account.
// Each side keeps its own native amount.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use(errorHandler);
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

const newAccount = async (currency: 'UYU' | 'USD') =>
  (await send('POST', '/accounts', { name: `Account ${currency}`, type: 'checking', currency }))
    .body.id as string;

const balanceOf = async (accountId: string) =>
  ((await send('GET', '/accounts')).body as { id: string; balance: number }[]).find(
    (a) => a.id === accountId,
  )!.balance;

const listed = async (accountId: string) =>
  (await send('GET', `/transactions?account_id=${accountId}`)).body as {
    id: string;
    date: string;
    amount: number;
    transfer?: { accountId: string; amount: number; currency: string; rate: number | null };
  }[];

/** $ 40,000 out of a new pesos account, US$ 1,000 into a new dollars account */
async function buyDollars(extra: Record<string, unknown> = {}) {
  const pesos = await newAccount('UYU');
  const dollars = await newAccount('USD');
  const res = await send('POST', '/transactions/transfer', {
    fromAccountId: pesos,
    toAccountId: dollars,
    date: '2025-03-10',
    amount: 4_000_000,
    toAmount: 100_000,
    ...extra,
  });
  return { pesos, dollars, res };
}

describe('a transfer between a pesos and a dollars account', () => {
  it('saves each side with its own native amount', async () => {
    const { pesos, dollars, res } = await buyDollars();
    expect(res.status).toBe(201);
    expect(res.body.map((t: { amount: number }) => t.amount)).toEqual([-4_000_000, 100_000]);
    expect(await balanceOf(pesos)).toBe(-4_000_000);
    expect(await balanceOf(dollars)).toBe(100_000);
  });

  it('needs the amount arriving', async () => {
    const pesos = await newAccount('UYU');
    const dollars = await newAccount('USD');
    const res = await send('POST', '/transactions/transfer', {
      fromAccountId: pesos,
      toAccountId: dollars,
      date: '2025-03-10',
      amount: 4_000_000,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount arriving/i);
    expect(await balanceOf(pesos)).toBe(0);
    expect(await balanceOf(dollars)).toBe(0);
  });

  it('lists each side with the other side and the implied rate in pesos per dollar', async () => {
    const { pesos, dollars } = await buyDollars();
    expect((await listed(pesos))[0].transfer).toEqual({
      accountId: dollars,
      amount: 100_000,
      currency: 'USD',
      rate: 40,
    });
    // Selling dollars later reads the same way: always pesos per dollar
    expect((await listed(dollars))[0].transfer).toEqual({
      accountId: pesos,
      amount: -4_000_000,
      currency: 'UYU',
      rate: 40,
    });
  });

  it("leaves the other side's amount alone when one side's amount is edited", async () => {
    const { pesos, dollars, res } = await buyDollars();
    const edit = await send('PUT', `/transactions/${res.body[0].id}`, { amount: -4_100_000 });
    expect(edit.status).toBe(200);
    expect(await balanceOf(pesos)).toBe(-4_100_000);
    expect(await balanceOf(dollars)).toBe(100_000);
    await send('PUT', `/transactions/${res.body[1].id}`, { amount: 99_000 });
    expect(await balanceOf(pesos)).toBe(-4_100_000);
    expect(await balanceOf(dollars)).toBe(99_000);
  });

  it('moves both sides when the date is edited', async () => {
    const { pesos, dollars, res } = await buyDollars();
    await send('PUT', `/transactions/${res.body[1].id}`, { date: '2025-03-12', amount: 98_000 });
    expect((await listed(pesos))[0]).toMatchObject({ date: '2025-03-12', amount: -4_000_000 });
    expect((await listed(dollars))[0]).toMatchObject({ date: '2025-03-12', amount: 98_000 });
  });

  it('keeps money leaving one account and arriving in the other when an amount is edited', async () => {
    const { pesos, res } = await buyDollars();
    const edit = await send('PUT', `/transactions/${res.body[0].id}`, { amount: 4_000_000 });
    expect(edit.status).toBe(400);
    expect(await balanceOf(pesos)).toBe(-4_000_000);
  });

  it('is not saved twice when it is sent again with the same id', async () => {
    const id = 'offline-fx-transfer-0001';
    const { pesos, dollars, res } = await buyDollars({ id });
    expect(res.status).toBe(201);
    const again = await send('POST', '/transactions/transfer', {
      id,
      fromAccountId: pesos,
      toAccountId: dollars,
      date: '2025-03-10',
      amount: 4_000_000,
      toAmount: 100_000,
    });
    expect(again.status).toBe(200);
    expect(again.body.map((t: { amount: number }) => t.amount)).toEqual([-4_000_000, 100_000]);
    expect(await balanceOf(pesos)).toBe(-4_000_000);
    expect(await balanceOf(dollars)).toBe(100_000);
  });

  it('counts as neither spending nor income', async () => {
    const month = '2031-06';
    const figures = async () => ({
      flow: (await send('GET', `/reports/income-vs-expenses?from=${month}&to=${month}`)).body,
      spending: (await send('GET', `/reports/spending-by-category?from=${month}&to=${month}`)).body,
      income: (await send('GET', `/reports/income-by-category?from=${month}&to=${month}`)).body,
      daily: (await send('GET', `/reports/daily-flow?from=${month}&to=${month}`)).body,
      budget: (await send('GET', `/budget/${month}`)).body,
      summary: (await send('GET', `/budget/${month}/summary`)).body,
    });
    const before = await figures();
    const { res } = await buyDollars({ date: `${month}-15` });
    expect(res.status).toBe(201);
    expect(await figures()).toEqual(before);
  });
});

describe('a transfer between accounts of the same currency', () => {
  it('takes one amount, and editing one side updates the other', async () => {
    const from = await newAccount('USD');
    const to = await newAccount('USD');
    const { body } = await send('POST', '/transactions/transfer', {
      fromAccountId: from,
      toAccountId: to,
      date: '2025-01-05',
      amount: 2500,
    });
    expect(body.map((t: { amount: number }) => t.amount)).toEqual([-2500, 2500]);
    await send('PUT', `/transactions/${body[1].id}`, { amount: 4000 });
    expect(await balanceOf(from)).toBe(-4000);
    expect(await balanceOf(to)).toBe(4000);
    expect((await listed(from))[0].transfer).toEqual({
      accountId: to,
      amount: 4000,
      currency: 'USD',
      rate: null,
    });
  });

  it('refuses a different amount arriving', async () => {
    const from = await newAccount('UYU');
    const to = await newAccount('UYU');
    const res = await send('POST', '/transactions/transfer', {
      fromAccountId: from,
      toAccountId: to,
      date: '2025-01-05',
      amount: 2500,
      toAmount: 2400,
    });
    expect(res.status).toBe(400);
    expect(await balanceOf(to)).toBe(0);
  });
});

describe('recurring transfers between a pesos and a dollars account', () => {
  const schedule = (accountId: string, transferAccountId: string | null) => ({
    name: 'Buy dollars',
    amount: -4_000_000,
    recurrenceType: 'monthly',
    startDate: '2025-01-05',
    accountId,
    transferAccountId,
  });

  it('are refused with a clear message', async () => {
    const pesos = await newAccount('UYU');
    const dollars = await newAccount('USD');
    const res = await send('POST', '/schedules', schedule(pesos, dollars));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pesos.*dollars/i);
  });

  it('are refused when an existing recurring item is pointed at the other currency', async () => {
    const pesos = await newAccount('UYU');
    const otherPesos = await newAccount('UYU');
    const dollars = await newAccount('USD');
    const created = await send('POST', '/schedules', schedule(pesos, otherPesos));
    expect(created.status).toBe(201);
    const res = await send('PUT', `/schedules/${created.body.id}`, { transferAccountId: dollars });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pesos.*dollars/i);
    expect((await send('GET', `/schedules/${created.body.id}`)).body.transferAccountId).toBe(
      otherPesos,
    );
  });
});
