import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { createExchangeRatesRouter } from './exchangeRates.js';
import { exportRouter } from './export.js';
import { transactionsRouter } from './transactions.js';
import { transferSuggestionsRouter } from './transferSuggestions.js';

// After an import the two sides of a transfer sit in two accounts as an unrelated outflow and
// inflow. The app proposes such pairs; only the user makes one a transfer, or dismisses it.

let server: Server;
let base: string;

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  // The restore route parses its own body
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/accounts', accountsRouter);
  app.use(
    '/api/exchange-rates',
    createExchangeRatesRouter(() => Promise.reject(new Error('no network in tests'))),
  );
  app.use('/api/export', exportRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/transfer-suggestions', transferSuggestionsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  // 40 pesos per dollar from March 2025 on; nothing before
  await send('PUT', '/exchange-rates/2025-03-01', { rate: 40 });
});
afterAll(() => server.close());

let accountCount = 0;
const newAccount = async (currency: 'UYU' | 'USD' = 'UYU') =>
  (
    await send('POST', '/accounts', {
      name: `Account ${++accountCount}`,
      type: 'checking',
      currency,
    })
  ).body.id as string;

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
      payeeName: 'Bank text',
      ...extra,
    })
  ).body.id as string;

interface Side {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  currency: string;
  payeeName: string | null;
}
interface Suggestion {
  outflow: Side;
  inflow: Side;
  rate: number | null;
}
const suggestions = async () => (await send('GET', '/transfer-suggestions')).body as Suggestion[];
/** The suggestion this transaction is in, if any */
const suggestionOf = async (id: string) =>
  (await suggestions()).find((s) => s.outflow.id === id || s.inflow.id === id);
const dismiss = (transactionId: string, otherTransactionId: string) =>
  send('POST', '/transfer-suggestions/dismiss', { transactionId, otherTransactionId });

type Linked = { id: string; transferTransactionId: string | null };
const transferOf = async (accountId: string, id: string) =>
  ((await send('GET', `/transactions?account_id=${accountId}`)).body as Linked[]).find(
    (t) => t.id === id,
  )!.transferTransactionId;

// Every test uses its own amount, so its transactions can only pair with each other
let nextAmount = 100_000;
async function twoSides(opts: { inDate?: string } = {}) {
  const amount = (nextAmount += 100);
  const from = await newAccount();
  const to = await newAccount();
  const out = await newTransaction(from, -amount, { payeeName: 'TRASPASO A CAJA' });
  const into = await newTransaction(to, amount, {
    payeeName: 'TRASPASO DE CUENTA',
    date: opts.inDate ?? '2025-03-11',
  });
  return { from, to, out, into, amount };
}

describe('transfer suggestions', () => {
  it('propose an outflow and an inflow of the same amount in two accounts', async () => {
    const { from, to, out, into, amount } = await twoSides();
    expect(await suggestionOf(out)).toEqual({
      outflow: {
        id: out,
        accountId: from,
        date: '2025-03-10',
        amount: -amount,
        currency: 'UYU',
        payeeName: 'TRASPASO A CAJA',
      },
      inflow: {
        id: into,
        accountId: to,
        date: '2025-03-11',
        amount,
        currency: 'UYU',
        payeeName: 'TRASPASO DE CUENTA',
      },
      rate: null,
    });
  });

  it('propose pesos leaving and dollars arriving near the exchange rate of the day', async () => {
    // $ 40,400 for US$ 1,000: 40.4 pesos per dollar against a rate of 40
    const from = await newAccount();
    const to = await newAccount('USD');
    const out = await newTransaction(from, -4_040_000);
    const into = await newTransaction(to, 100_000);
    expect(await suggestionOf(out)).toMatchObject({
      outflow: { id: out, currency: 'UYU' },
      inflow: { id: into, currency: 'USD', amount: 100_000 },
      rate: 40.4,
    });
  });

  it('do not pair currencies when the amounts are far from the exchange rate', async () => {
    const from = await newAccount();
    const to = await newAccount('USD');
    const out = await newTransaction(from, -4_500_000, { date: '2025-03-20' });
    await newTransaction(to, 100_000, { date: '2025-03-20' });
    expect(await suggestionOf(out)).toBeUndefined();
  });

  it('do not pair currencies on a date with no exchange rate', async () => {
    const from = await newAccount();
    const to = await newAccount('USD');
    const out = await newTransaction(from, -4_000_000, { date: '2025-01-10' });
    await newTransaction(to, 100_000, { date: '2025-01-10' });
    expect(await suggestionOf(out)).toBeUndefined();
  });

  it('do not pair transactions more than 3 days apart', async () => {
    const { out } = await twoSides({ inDate: '2025-03-14' });
    expect(await suggestionOf(out)).toBeUndefined();
  });

  it('leave out reconciled transactions', async () => {
    const { to, out, into } = await twoSides();
    await send('PUT', `/accounts/${to}/reconcile`, { transactionIds: [into] });
    expect(await suggestionOf(out)).toBeUndefined();
  });

  it('leave out split transactions and their parts', async () => {
    const amount = (nextAmount += 100);
    const from = await newAccount();
    const to = await newAccount();
    const out = await newTransaction(from, -amount);
    const whole = await newTransaction(from, -amount * 2);
    const split = (
      await send('POST', '/transactions', {
        accountId: to,
        date: '2025-03-10',
        amount: amount * 2,
        payeeName: 'Split',
        splits: [
          { categoryId: null, amount },
          { categoryId: null, amount },
        ],
      })
    ).body;
    expect(split.children).toHaveLength(2);
    expect(await suggestionOf(out)).toBeUndefined();
    expect(await suggestionOf(whole)).toBeUndefined();
  });

  it('leave out balance adjustments', async () => {
    const amount = (nextAmount += 100);
    const account = await newAccount();
    const other = await newAccount();
    const spent = await newTransaction(account, -amount);
    await newTransaction(other, amount, { adjustment: true });
    expect(await suggestionOf(spent)).toBeUndefined();
  });

  it('never link anything by themselves', async () => {
    const { from, out } = await twoSides();
    expect(await suggestionOf(out)).toBeDefined();
    expect(await transferOf(from, out)).toBeNull();
  });
});

describe('confirming a suggestion', () => {
  it('links the pair as a transfer, and it is no longer suggested', async () => {
    const { from, out, into } = await twoSides();
    const res = await send('POST', `/transactions/${out}/link-transfer`, {
      otherTransactionId: into,
    });
    expect(res.status).toBe(200);
    expect(await transferOf(from, out)).toBe(into);
    expect(await suggestionOf(out)).toBeUndefined();
    expect(await suggestionOf(into)).toBeUndefined();
  });
});

describe('dismissing a suggestion', () => {
  it('means that pair is not suggested again, whichever side is named first', async () => {
    const first = await twoSides();
    expect((await dismiss(first.out, first.into)).status).toBe(204);
    expect(await suggestionOf(first.out)).toBeUndefined();

    const second = await twoSides();
    expect((await dismiss(second.into, second.out)).status).toBe(204);
    expect(await suggestionOf(second.out)).toBeUndefined();
  });

  it('can be repeated', async () => {
    const { out, into } = await twoSides();
    expect((await dismiss(out, into)).status).toBe(204);
    expect((await dismiss(into, out)).status).toBe(204);
  });

  it('leaves both transactions free for another pair', async () => {
    const { to, out, into, amount } = await twoSides();
    await dismiss(out, into);
    const other = await newTransaction(to, amount, { date: '2025-03-12' });
    expect(await suggestionOf(out)).toMatchObject({ inflow: { id: other } });
  });

  it('is refused for unknown transactions and for a pair of one transaction', async () => {
    const { out } = await twoSides();
    expect((await dismiss(out, 'no-such-transaction')).status).toBe(404);
    expect((await dismiss(out, out)).status).toBe(400);
    expect((await send('POST', '/transfer-suggestions/dismiss', {})).status).toBe(400);
  });

  it('is forgotten when one of the transactions is deleted', async () => {
    const { out, into } = await twoSides();
    await dismiss(out, into);
    expect((await send('DELETE', `/transactions/${into}`)).status).toBeLessThan(300);
    const backup = (await send('GET', '/export/backup')).body as {
      transferSuggestionDismissals: { transactionId: string; otherTransactionId: string }[];
    };
    expect(
      backup.transferSuggestionDismissals.some(
        (d) => d.transactionId === out || d.otherTransactionId === out,
      ),
    ).toBe(false);
  });

  it('survives a backup and restore', async () => {
    const { out, into } = await twoSides();
    await dismiss(out, into);
    const backup = (await send('GET', '/export/backup')).body;
    expect((await send('POST', '/export/restore', backup)).status).toBe(200);
    expect(await suggestionOf(out)).toBeUndefined();
  });
});
