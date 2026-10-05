import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { budgetRouter } from './budget.js';
import { categoriesRouter } from './categories.js';
import { reportsRouter } from './reports.js';
import { transactionsRouter } from './transactions.js';

// The two sides of a movement often arrive in separate CSV imports, as an unrelated outflow
// and inflow. Linking them by hand makes them a transfer; unlinking undoes it.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/reports', reportsRouter);
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

let accountCount = 0;
const newAccount = async (currency: 'UYU' | 'USD' = 'UYU') =>
  (
    await send('POST', '/accounts', {
      name: `Account ${++accountCount}`,
      type: 'checking',
      currency,
    })
  ).body.id as string;

async function newCategory(name: string, isIncome = 0) {
  const group = await send('POST', '/categories/groups', { name: `Group ${name}`, isIncome });
  return (await send('POST', '/categories', { name, groupId: group.body.id })).body.id as string;
}

const newTransaction = async (
  accountId: string,
  amount: number,
  extra: Record<string, unknown> = {},
) =>
  (
    await send('POST', '/transactions', {
      accountId,
      date: '2025-03-10',
      amount,
      payeeName: `Bank text ${Math.random()}`,
      ...extra,
    })
  ).body.id as string;

type Listed = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  categoryId: string | null;
  transferTransactionId: string | null;
  currency: string;
  transfer?: { accountId: string; amount: number; currency: string; rate: number | null };
};
const listed = async (accountId: string) =>
  (await send('GET', `/transactions?account_id=${accountId}`)).body as Listed[];
const find = async (accountId: string, id: string) =>
  (await listed(accountId)).find((t) => t.id === id)!;

const link = (id: string, otherTransactionId: string) =>
  send('POST', `/transactions/${id}/link-transfer`, { otherTransactionId });
const unlink = (id: string) => send('POST', `/transactions/${id}/unlink-transfer`);
const candidates = async (id: string) =>
  (await send('GET', `/transactions/${id}/transfer-candidates`)).body as Listed[];

/** An outflow in one new account and an inflow in another, as two imports would leave them */
async function twoSides(
  opts: {
    from?: 'UYU' | 'USD';
    to?: 'UYU' | 'USD';
    out?: number;
    in?: number;
    date?: string;
    categorized?: boolean;
  } = {},
) {
  const from = await newAccount(opts.from);
  const to = await newAccount(opts.to);
  const date = opts.date ?? '2025-03-10';
  const spending = opts.categorized ? await newCategory(`Spending ${Math.random()}`) : null;
  const income = opts.categorized ? await newCategory(`Income ${Math.random()}`, 1) : null;
  const out = await newTransaction(from, opts.out ?? -50_000, { date, categoryId: spending });
  const into = await newTransaction(to, opts.in ?? 50_000, { date, categoryId: income });
  return { from, to, out, into };
}

describe('linking two transactions as a transfer', () => {
  it('links an outflow to an inflow in another account of the same currency', async () => {
    const { from, to, out, into } = await twoSides();
    const res = await link(out, into);
    expect(res.status).toBe(200);
    expect(res.body.map((t: Listed) => t.id)).toEqual([out, into]);
    expect(await find(from, out)).toMatchObject({
      amount: -50_000,
      transferTransactionId: into,
      transfer: { accountId: to, amount: 50_000, currency: 'UYU', rate: null },
    });
    expect(await find(to, into)).toMatchObject({ amount: 50_000, transferTransactionId: out });
  });

  it('works starting from the inflow too', async () => {
    const { from, out, into } = await twoSides();
    expect((await link(into, out)).status).toBe(200);
    expect((await find(from, out)).transferTransactionId).toBe(into);
  });

  it('keeps each side its own amount between a pesos and a dollars account', async () => {
    const { from, to, out, into } = await twoSides({ to: 'USD', out: -4_000_000, in: 100_000 });
    expect((await link(out, into)).status).toBe(200);
    expect(await find(from, out)).toMatchObject({
      amount: -4_000_000,
      transfer: { accountId: to, amount: 100_000, currency: 'USD', rate: 40 },
    });
    expect((await find(to, into)).amount).toBe(100_000);
  });

  it('keeps each side its own date', async () => {
    const { from, to, out } = await twoSides();
    const later = await newTransaction(to, 50_000, { date: '2025-03-12' });
    await link(out, later);
    expect((await find(from, out)).date).toBe('2025-03-10');
    expect((await find(to, later)).date).toBe('2025-03-12');
  });

  it('removes both categories, so neither side counts as spending or income', async () => {
    const month = '2032-04';
    const figures = async () => ({
      flow: (await send('GET', `/reports/income-vs-expenses?from=${month}&to=${month}`)).body,
      spending: (await send('GET', `/reports/spending-by-category?from=${month}&to=${month}`)).body,
      income: (await send('GET', `/reports/income-by-category?from=${month}&to=${month}`)).body,
      daily: (await send('GET', `/reports/daily-flow?from=${month}&to=${month}`)).body,
      summary: (await send('GET', `/budget/${month}/summary`)).body,
    });
    const before = await figures();
    const { from, to, out, into } = await twoSides({ date: `${month}-15`, categorized: true });
    expect(await figures()).not.toEqual(before);

    await link(out, into);
    expect((await find(from, out)).categoryId).toBeNull();
    expect((await find(to, into)).categoryId).toBeNull();
    expect(await figures()).toEqual(before);
  });
});

describe('what cannot be linked', () => {
  const refused = async (res: { status: number; body: { error: string } }, message: RegExp) => {
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  };

  it('two same-currency transactions whose amounts differ, with a clear message', async () => {
    const { from, out, into } = await twoSides({ out: -50_000, in: 49_000 });
    await refused(await link(out, into), /same currency.*same amount/i);
    expect((await find(from, out)).transferTransactionId).toBeNull();
  });

  it('two transactions in the same account', async () => {
    const account = await newAccount();
    const out = await newTransaction(account, -1000);
    const into = await newTransaction(account, 1000);
    await refused(await link(out, into), /different accounts/i);
  });

  it('two outflows, or two inflows', async () => {
    const { from, to, out, into } = await twoSides();
    await refused(await link(out, await newTransaction(to, -50_000)), /leaving.*arriving/i);
    await refused(await link(into, await newTransaction(from, 50_000)), /leaving.*arriving/i);
  });

  it('a transaction that is already a transfer', async () => {
    const { to, out, into } = await twoSides();
    await link(out, into);
    await refused(await link(out, await newTransaction(to, 50_000)), /already.*transfer/i);
  });

  it('a reconciled transaction', async () => {
    const { to, out, into } = await twoSides();
    await send('PUT', `/accounts/${to}/reconcile`, { transactionIds: [into] });
    const res = await link(out, into);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/reconciled/i);
  });

  it('a split transaction or one of its parts', async () => {
    const { to, out } = await twoSides();
    const split = (
      await send('POST', '/transactions', {
        accountId: to,
        date: '2025-03-10',
        amount: 50_000,
        payeeName: 'Split',
        splits: [
          { categoryId: null, amount: 20_000 },
          { categoryId: null, amount: 30_000 },
        ],
      })
    ).body as { id: string; children: { id: string }[] };
    await refused(await link(out, split.id), /split/i);
    await refused(await link(out, split.children[0].id), /split/i);
    await refused(await link(split.id, out), /split/i);
  });

  it('a transaction that does not exist', async () => {
    const { out } = await twoSides();
    expect((await link(out, 'nope')).status).toBe(404);
    expect((await link('nope', out)).status).toBe(404);
  });
});

describe('candidates for the other side of a transfer', () => {
  it('are unlinked transactions of the opposite direction in other accounts, nearest in date first', async () => {
    const from = await newAccount();
    const to = await newAccount('USD');
    const other = await newAccount();
    const out = await newTransaction(from, -50_000, { date: '2040-05-10' });

    const twoDaysBefore = await newTransaction(to, 1_200, { date: '2040-05-08' });
    const sameDay = await newTransaction(other, 50_000, { date: '2040-05-10' });
    const fiveDaysAfter = await newTransaction(other, 70_000, { date: '2040-05-15' });

    // Not offered: same account, same direction, already a transfer, reconciled, split
    await newTransaction(from, 50_000, { date: '2040-05-10' });
    await newTransaction(other, -50_000, { date: '2040-05-10' });
    const reconciled = await newTransaction(other, 50_000, { date: '2040-05-10' });
    await send('PUT', `/accounts/${other}/reconcile`, { transactionIds: [reconciled] });
    await send('POST', '/transactions/transfer', {
      fromAccountId: to,
      toAccountId: other,
      date: '2040-05-10',
      amount: 500,
      toAmount: 20_000,
    });
    await send('POST', '/transactions', {
      accountId: other,
      date: '2040-05-10',
      amount: 50_000,
      splits: [
        { categoryId: null, amount: 20_000 },
        { categoryId: null, amount: 30_000 },
      ],
    });

    const offered = (await candidates(out)).filter((t) => t.date.startsWith('2040-05'));
    expect(offered.map((t) => t.id)).toEqual([sameDay, twoDaysBefore, fiveDaysAfter]);
    expect(offered[1]).toMatchObject({ accountId: to, amount: 1_200, currency: 'USD' });

    // And the reverse: from an inflow, outflows elsewhere
    expect((await candidates(sameDay)).map((t) => t.id)).toContain(out);
  });

  it('are none for a transaction that cannot be linked itself', async () => {
    const { out, into } = await twoSides();
    await link(out, into);
    expect(await candidates(out)).toEqual([]);
    expect((await send('GET', '/transactions/nope/transfer-candidates')).status).toBe(404);
  });
});

describe('unlinking a transfer', () => {
  it('makes both sides ordinary, uncategorized transactions again', async () => {
    const { from, to, out, into } = await twoSides({ to: 'USD', in: 1_250, categorized: true });
    await link(out, into);
    const res = await unlink(into);
    expect(res.status).toBe(200);
    for (const side of [await find(from, out), await find(to, into)]) {
      expect(side.transferTransactionId).toBeNull();
      expect(side.categoryId).toBeNull();
      expect(side.transfer).toBeUndefined();
    }
    expect((await find(from, out)).amount).toBe(-50_000);
    expect((await find(to, into)).amount).toBe(1_250);
    // Ordinary again: they can be categorized and linked once more
    const category = await newCategory(`Again ${Math.random()}`);
    expect((await send('PUT', `/transactions/${out}`, { categoryId: category })).status).toBe(200);
    expect((await link(out, into)).status).toBe(200);
  });

  it('works on a transfer that was added as a transfer', async () => {
    const from = await newAccount();
    const to = await newAccount();
    const { body } = await send('POST', '/transactions/transfer', {
      fromAccountId: from,
      toAccountId: to,
      date: '2025-03-10',
      amount: 2500,
    });
    expect((await unlink(body[0].id)).status).toBe(200);
    expect((await find(to, body[1].id)).transferTransactionId).toBeNull();
  });

  it('is refused for a transaction that is not a transfer, or has a reconciled side', async () => {
    const { to, out, into } = await twoSides();
    expect((await unlink(out)).status).toBe(400);
    expect((await unlink('nope')).status).toBe(404);
    await link(out, into);
    await send('PUT', `/accounts/${to}/reconcile`, { transactionIds: [into] });
    const res = await unlink(out);
    expect(res.status).toBe(403);
    expect((await find(to, into)).transferTransactionId).toBe(out);
  });
});
