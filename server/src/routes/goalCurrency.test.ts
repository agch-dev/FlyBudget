import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, exchangeRates, goals } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';
import { goalsRouter } from './goals.js';

// A goal has a currency: its linked account's, or the one chosen when it has no account.
// The amounts each goal sends in pesos (for the page's summary) are worked out by hand below.

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
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

beforeEach(() => {
  db.delete(goals).run();
  db.delete(exchangeRates).run();
  db.delete(accounts).run();
});

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

const newAccount = async (name: string, currency: 'UYU' | 'USD') =>
  (await send('POST', '/accounts', { name, type: 'savings', currency })).body;

const newGoal = async (data: Record<string, unknown>) =>
  (await send('POST', '/goals', { name: 'House', targetAmount: 100_000, ...data })).body;

const listed = async (id: string) =>
  (await send('GET', '/goals')).body.find((g: { id: string }) => g.id === id);

const storeRate = (date: string, rate: number) =>
  db
    .insert(exchangeRates)
    .values({ date, rate, fetchedAt: `${date}T12:00:00.000Z` })
    .run();

describe("a goal's currency", () => {
  it('is pesos for a goal with no linked account, unless dollars are chosen', async () => {
    const pesos = await newGoal({});
    const dollars = await newGoal({ currency: 'USD' });
    expect(pesos.currency).toBe('UYU');
    expect(dollars.currency).toBe('USD');
    expect((await listed(pesos.id)).currency).toBe('UYU');
    expect((await listed(dollars.id)).currency).toBe('USD');
  });

  it('refuses a currency that is neither pesos nor dollars', async () => {
    const res = await send('POST', '/goals', { name: 'Trip', targetAmount: 1, currency: 'EUR' });
    expect(res.status).toBe(400);
  });

  it("is the linked account's, whatever currency was sent", async () => {
    const usd = await newAccount('Dollar savings', 'USD');
    const uyu = await newAccount('Peso savings', 'UYU');
    const a = await newGoal({ accountId: usd.id });
    const b = await newGoal({ accountId: usd.id, currency: 'UYU' });
    const c = await newGoal({ accountId: uyu.id, currency: 'USD' });
    expect([a.currency, b.currency, c.currency]).toEqual(['USD', 'USD', 'UYU']);
  });

  it('follows the account when the goal is linked to one of the other currency', async () => {
    const usd = await newAccount('Dollar savings', 'USD');
    const goal = await newGoal({});
    const linked = await send('PUT', `/goals/${goal.id}`, { accountId: usd.id });
    expect(linked.body.currency).toBe('USD');
    expect((await listed(goal.id)).currency).toBe('USD');
  });

  it('cannot be chosen while the goal is linked to an account', async () => {
    const usd = await newAccount('Dollar savings', 'USD');
    const goal = await newGoal({ accountId: usd.id });
    const res = await send('PUT', `/goals/${goal.id}`, { currency: 'UYU' });
    expect(res.body.currency).toBe('USD');
  });

  it('stays what it was when the account is unlinked, and can then be chosen', async () => {
    const usd = await newAccount('Dollar savings', 'USD');
    const goal = await newGoal({ accountId: usd.id });
    const unlinked = await send('PUT', `/goals/${goal.id}`, { accountId: null });
    expect(unlinked.body).toMatchObject({ accountId: null, currency: 'USD' });
    const chosen = await send('PUT', `/goals/${goal.id}`, { currency: 'UYU' });
    expect(chosen.body.currency).toBe('UYU');
    const both = await send('PUT', `/goals/${goal.id}`, { accountId: null, currency: 'USD' });
    expect(both.body.currency).toBe('USD');
  });

  it('refuses to link an account that does not exist', async () => {
    const goal = await newGoal({});
    expect((await send('PUT', `/goals/${goal.id}`, { accountId: 'nope' })).status).toBe(400);
    expect(
      (await send('POST', '/goals', { name: 'x', targetAmount: 1, accountId: 'nope' })).status,
    ).toBe(400);
  });

  it("follows the linked account's currency when that changes", async () => {
    const account = await newAccount('Savings', 'UYU');
    const goal = await newGoal({ accountId: account.id });
    await send('PUT', `/accounts/${account.id}`, { currency: 'USD' });
    expect((await listed(goal.id)).currency).toBe('USD');
  });
});

describe('goal amounts in pesos', () => {
  it("are the goal's own amounts for a pesos goal", async () => {
    const goal = await newGoal({ targetAmount: 500_000, currentAmount: 120_000 });
    expect((await listed(goal.id)).inPesos).toEqual({
      target: 500_000,
      saved: 120_000,
      remaining: 380_000,
    });
  });

  it("convert a dollar goal at today's rate (the latest one stored)", async () => {
    storeRate('2024-01-02', 38);
    storeRate('2024-06-03', 40.5);
    // US$1,000.00 target, US$250.50 saved, at 40.5 pesos per dollar
    const goal = await newGoal({ currency: 'USD', targetAmount: 100_000, currentAmount: 25_050 });
    expect((await listed(goal.id)).inPesos).toEqual({
      target: 4_050_000,
      saved: 1_014_525,
      remaining: 3_035_475,
    });
  });

  it('never leave a negative amount to save when more than the target is saved', async () => {
    storeRate('2024-01-02', 40);
    const goal = await newGoal({ currency: 'USD', targetAmount: 10_000, currentAmount: 12_000 });
    expect((await listed(goal.id)).inPesos).toEqual({
      target: 400_000,
      saved: 480_000,
      remaining: 0,
    });
  });

  it('are missing for a dollar goal while no exchange rate is stored', async () => {
    const goal = await newGoal({ currency: 'USD' });
    expect((await listed(goal.id)).inPesos).toBeNull();
  });
});

describe('backup and restore', () => {
  it("carry a goal's currency", async () => {
    const goal = await newGoal({ currency: 'USD' });
    const { body: backup } = await send('GET', '/export/backup');
    expect(backup.goals[0].currency).toBe('USD');

    await send('DELETE', `/goals/${goal.id}`);
    expect((await send('POST', '/export/restore', backup)).status).toBe(200);
    expect((await listed(goal.id)).currency).toBe('USD');
  });

  it('refuse a goal in an unknown currency', async () => {
    await newGoal({});
    const { body: backup } = await send('GET', '/export/backup');
    backup.goals[0].currency = 'EUR';
    expect((await send('POST', '/export/restore', backup)).status).toBe(400);
  });

  it('read a goal from an older backup in its linked account currency, else pesos', async () => {
    const usd = await newAccount('Dollar savings', 'USD');
    const linked = await newGoal({ accountId: usd.id });
    const free = await newGoal({});
    const { body: backup } = await send('GET', '/export/backup');
    for (const g of backup.goals) delete g.currency;

    expect((await send('POST', '/export/restore', backup)).status).toBe(200);
    expect((await listed(linked.id)).currency).toBe('USD');
    expect((await listed(free.id)).currency).toBe('UYU');
  });
});

describe('migration 0025', () => {
  it("gives existing goals their linked account's currency, else pesos", () => {
    const dir = 'src/db/migrations';
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const sqlite = new Database(':memory:');
    const run = (file: string) => {
      for (const statement of readFileSync(`${dir}/${file}`, 'utf8').split(
        '--> statement-breakpoint',
      )) {
        if (statement.trim()) sqlite.exec(statement);
      }
    };
    const mine = files.find((f) => f.startsWith('0025_'))!;
    for (const file of files.filter((f) => f < mine)) run(file);
    sqlite.exec(`
      INSERT INTO accounts (id, name, type, currency) VALUES ('usd', 'Dollars', 'savings', 'USD');
      INSERT INTO accounts (id, name, type, currency) VALUES ('uyu', 'Pesos', 'savings', 'UYU');
      INSERT INTO goals (id, name, target_amount, account_id) VALUES ('car', 'Car', 100, 'usd');
      INSERT INTO goals (id, name, target_amount, account_id) VALUES ('trip', 'Trip', 100, 'uyu');
      INSERT INTO goals (id, name, target_amount) VALUES ('fund', 'Fund', 100);
    `);
    run(mine);
    expect(sqlite.prepare('SELECT id, currency FROM goals ORDER BY id').all()).toEqual([
      { id: 'car', currency: 'USD' },
      { id: 'fund', currency: 'UYU' },
      { id: 'trip', currency: 'UYU' },
    ]);
  });
});
