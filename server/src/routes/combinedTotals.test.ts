import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { categories, categoryGroups } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { reportsRouter } from './reports.js';
import { transactionsRouter } from './transactions.js';

// Until net worth converts, it counts pesos accounts only: adding a dollar balance to a pesos
// one would be wrong by the exchange rate. Every other combined total already converts dollar
// accounts at each transaction's rate: see budgetConversion.test.ts (the Budget) and
// reportsConversion.test.ts (reports, cash flow, the calendar, the Recurring summary).

let server: Server;
let base: string;
let pesosId: string;
let dollarsId: string;

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
const today = `${month}-${pad(now.getDate())}`;

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
};
const get = (path: string) => send('GET', path);

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(categoryGroups)
    .values([
      { id: 'spending', name: 'Spending', isIncome: 0 },
      { id: 'income', name: 'Income', isIncome: 1 },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'food', groupId: 'spending', name: 'Food' },
      { id: 'salary', groupId: 'income', name: 'Salary' },
    ])
    .run();

  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const account = (name: string, currency: string, startingBalance: number) =>
    send('POST', '/accounts', { name, type: 'checking', currency, startingBalance });
  pesosId = (await account('Pesos', 'UYU', 100_000)).id;
  dollarsId = (await account('Dollars', 'USD', 7_000)).id;

  const add = (accountId: string, amount: number, categoryId: string) =>
    send('POST', '/transactions', { accountId, date: today, amount, categoryId });
  await add(pesosId, 50_000, 'salary');
  await add(pesosId, -20_000, 'food');
  await add(dollarsId, 3_000, 'salary');
  await add(dollarsId, -1_100, 'food');
});
afterAll(() => server.close());

describe('combined totals leave dollar accounts out', () => {
  it('each account still reports its own native balance', async () => {
    const list = await get('/accounts');
    const balance = (id: string) => list.find((a: { id: string }) => a.id === id).balance;
    expect(balance(pesosId)).toBe(130_000);
    expect(balance(dollarsId)).toBe(8_900);
  });

  it('net worth', async () => {
    const points = await get(`/reports/net-worth?from=${month}&to=${month}`);
    expect(points.at(-1)).toMatchObject({ assets: 130_000, liabilities: 0, netWorth: 130_000 });

    const daily = await get(`/reports/net-worth?granularity=daily&from=${today}&to=${today}`);
    expect(daily.at(-1)).toMatchObject({ netWorth: 130_000 });
  });
});
