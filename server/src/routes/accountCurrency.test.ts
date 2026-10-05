import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';
import { goalsRouter } from './goals.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/accounts', accountsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/goals', goalsRouter);
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

describe('account currency', () => {
  it('a new account is in pesos unless dollars are chosen', async () => {
    const pesos = await send('POST', '/accounts', { name: 'Caja de ahorro', type: 'savings' });
    const dollars = await send('POST', '/accounts', {
      name: 'Caja de ahorro USD',
      type: 'savings',
      currency: 'USD',
    });
    expect(pesos.body.currency).toBe('UYU');
    expect(dollars.body.currency).toBe('USD');

    const list = await send('GET', '/accounts');
    const byId = Object.fromEntries(
      list.body.map((a: { id: string; currency: string }) => [a.id, a.currency]),
    );
    expect(byId[pesos.body.id]).toBe('UYU');
    expect(byId[dollars.body.id]).toBe('USD');
  });

  it('refuses a currency other than pesos or dollars', async () => {
    const res = await send('POST', '/accounts', {
      name: 'Euros',
      type: 'savings',
      currency: 'EUR',
    });
    expect(res.status).toBe(400);
  });

  it('can change currency only while the account has no transactions', async () => {
    const { body: account } = await send('POST', '/accounts', { name: 'Tarjeta', type: 'credit' });

    const empty = await send('PUT', `/accounts/${account.id}`, { currency: 'USD' });
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ currency: 'USD', hasTransactions: false });

    await send('POST', '/transactions', {
      accountId: account.id,
      date: '2026-03-01',
      amount: -500,
    });

    const locked = await send('PUT', `/accounts/${account.id}`, { currency: 'UYU' });
    expect(locked.status).toBe(409);
    const list = await send('GET', '/accounts');
    expect(list.body.find((a: { id: string }) => a.id === account.id)).toMatchObject({
      currency: 'USD',
      hasTransactions: true,
    });

    // The edit dialog sends the unchanged currency along with the other fields
    const renamed = await send('PUT', `/accounts/${account.id}`, {
      name: 'Tarjeta dólares',
      currency: 'USD',
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'Tarjeta dólares', currency: 'USD' });
  });

  const newAccount = async (name: string, currency = 'UYU') =>
    (await send('POST', '/accounts', { name, type: 'checking', currency })).body;
  const listed = async (id: string) =>
    (await send('GET', '/accounts')).body.find((a: { id: string }) => a.id === id);

  it('says why the currency is locked, or that it is not', async () => {
    const account = await newAccount('Nueva');
    expect(account.currencyLockedBy).toBeNull();
    expect((await listed(account.id)).currencyLockedBy).toBeNull();
    await send('POST', '/transactions', { accountId: account.id, date: '2026-03-01', amount: -5 });
    expect((await listed(account.id)).currencyLockedBy).toBe('transactions');
  });

  it('cannot change currency while a recurring item uses the account, on either side', async () => {
    const paidFrom = await newAccount('Paga');
    const receives = await newAccount('Recibe');
    const item = await send('POST', '/schedules', {
      name: 'Ahorro',
      accountId: paidFrom.id,
      transferAccountId: receives.id,
      amount: -1_000,
      recurrenceType: 'monthly',
      startDate: '2026-01-10',
    });
    expect(item.status).toBe(201);

    for (const account of [paidFrom, receives]) {
      const refused = await send('PUT', `/accounts/${account.id}`, { currency: 'USD' });
      expect(refused.status).toBe(409);
      expect(refused.body.error).toMatch(/recurring/i);
      expect(await listed(account.id)).toMatchObject({
        currency: 'UYU',
        currencyLockedBy: 'recurring',
      });
    }

    await send('DELETE', `/schedules/${item.body.id}`);
    const freed = await send('PUT', `/accounts/${paidFrom.id}`, { currency: 'USD' });
    expect(freed.status).toBe(200);
    expect(freed.body).toMatchObject({ currency: 'USD', currencyLockedBy: null });
  });

  it('cannot change currency while a goal is linked to the account', async () => {
    const account = await newAccount('Ahorros');
    const goal = await send('POST', '/goals', {
      name: 'Viaje',
      targetAmount: 500_000,
      accountId: account.id,
    });
    expect(goal.status).toBe(201);

    const refused = await send('PUT', `/accounts/${account.id}`, { currency: 'USD' });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/goal/i);
    expect((await listed(account.id)).currencyLockedBy).toBe('goal');
    // Everything else about the account can still change
    const renamed = await send('PUT', `/accounts/${account.id}`, {
      name: 'Viajes',
      currency: 'UYU',
    });
    expect(renamed.status).toBe(200);

    await send('PUT', `/goals/${goal.body.id}`, { accountId: null });
    expect((await send('PUT', `/accounts/${account.id}`, { currency: 'USD' })).status).toBe(200);
  });

  it('refuses to move a transaction to an account of the other currency', async () => {
    const pesos = await newAccount('Pesos');
    const otherPesos = await newAccount('Más pesos');
    const dollars = await newAccount('Dólares', 'USD');
    const tx = await send('POST', '/transactions', {
      accountId: pesos.id,
      date: '2026-03-01',
      amount: -4_000_000,
    });

    const refused = await send('PUT', `/transactions/${tx.body.id}`, { accountId: dollars.id });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/currency/i);
    const unknown = await send('PUT', `/transactions/${tx.body.id}`, { accountId: 'nowhere' });
    expect(unknown.status).toBe(400);

    const moved = await send('PUT', `/transactions/${tx.body.id}`, {
      accountId: otherPesos.id,
      notes: 'moved',
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ accountId: otherPesos.id, amount: -4_000_000 });
  });

  it("lists each transaction with its account's currency, closed accounts included", async () => {
    const { body: account } = await send('POST', '/accounts', {
      name: 'Cuenta vieja',
      type: 'checking',
      currency: 'USD',
    });
    const { body: tx } = await send('POST', '/transactions', {
      accountId: account.id,
      date: '2026-04-02',
      amount: -1_250,
    });
    await send('DELETE', `/accounts/${account.id}`);

    const list = await send('GET', '/transactions?from=2026-04-02&to=2026-04-02');
    expect(list.body.find((t: { id: string }) => t.id === tx.id)).toMatchObject({
      amount: -1_250,
      currency: 'USD',
    });
  });
});

describe('export and backup', () => {
  const freshStart = () =>
    send('POST', '/export/restore', { format: 'flybudget-backup', version: 2, accounts: [] });

  it("the CSV export says which currency each row's amount is in", async () => {
    await freshStart();
    const add = async (name: string, currency: string, amount: number) => {
      const { body: account } = await send('POST', '/accounts', {
        name,
        type: 'checking',
        currency,
      });
      await send('POST', '/transactions', { accountId: account.id, date: '2026-05-10', amount });
    };
    await add('Pesos', 'UYU', -45_000);
    await add('Dollars', 'USD', -1_999);

    const csv = await fetch(`${base}/export/transactions/csv`).then((r) => r.text());
    const [header, ...rows] = csv.split('\n');
    expect(header).toBe('Date,Account,Currency,Payee,Category,Notes,Amount,Reconciled');
    expect(rows.sort()).toEqual([
      '2026-05-10,Dollars,USD,,,,-19.99,No',
      '2026-05-10,Pesos,UYU,,,,-450.00,No',
    ]);
  });

  it("a backup carries each account's currency through a restore", async () => {
    await freshStart();
    await send('POST', '/accounts', { name: 'Dollars', type: 'savings', currency: 'USD' });
    const { body: saved } = await send('GET', '/export/backup');
    expect(saved.accounts[0].currency).toBe('USD');

    await freshStart();
    expect((await send('POST', '/export/restore', saved)).status).toBe(200);
    const list = await send('GET', '/accounts');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: 'Dollars', currency: 'USD' });
  });

  it('restoring a backup made before accounts had a currency makes every account pesos', async () => {
    const older = {
      format: 'flybudget-backup',
      version: 2,
      accounts: [
        { id: 'old-checking', name: 'Checking', type: 'checking', startingBalance: 1_000 },
        { id: 'old-card', name: 'Card', type: 'credit' },
      ],
    };
    expect((await send('POST', '/export/restore', older)).status).toBe(200);
    const list = await send('GET', '/accounts');
    expect(list.body.map((a: { currency: string }) => a.currency)).toEqual(['UYU', 'UYU']);
  });

  it('refuses a backup with a currency that is not pesos or dollars', async () => {
    const res = await send('POST', '/export/restore', {
      format: 'flybudget-backup',
      version: 2,
      accounts: [{ id: 'euros', name: 'Euros', type: 'checking', currency: 'EUR' }],
    });
    expect(res.status).toBe(400);
    // Nothing was replaced
    const list = await send('GET', '/accounts');
    expect(list.body.map((a: { id: string }) => a.id)).toEqual(['old-checking', 'old-card']);
  });
});
