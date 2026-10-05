import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { categories, categoryGroups } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { reportsRouter } from './reports.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

// Until converted totals exist, a total that combines accounts counts pesos accounts only:
// adding a dollar amount to a pesos one would be wrong by the exchange rate. Every figure
// below is what the pesos account alone gives. The Budget already converts (it counts
// dollar accounts at each transaction's rate): see budgetConversion.test.ts. So does net worth
// (each balance at the rate of the day shown): see netWorthConversion.test.ts.

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
  app.use('/api/schedules', schedulesRouter);
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

  it('spending and income by category', async () => {
    const spending = await get(`/reports/spending-by-category?from=${month}&to=${month}`);
    expect(spending).toHaveLength(1);
    expect(spending[0]).toMatchObject({ categoryId: 'food', totalSpent: 20_000 });

    const income = await get(`/reports/income-by-category?from=${month}&to=${month}`);
    expect(income).toHaveLength(1);
    expect(income[0]).toMatchObject({ categoryId: 'salary', totalReceived: 50_000 });
  });

  it('income vs. expenses, cash flow and the daily flow', async () => {
    const [point] = await get(`/reports/income-vs-expenses?from=${month}&to=${month}`);
    expect(point).toMatchObject({ income: 50_000, expenses: 20_000, net: 30_000, expenseCount: 1 });

    expect(await get(`/reports/cash-flow?from=${month}&to=${month}`)).toEqual([
      { month, net: 30_000 },
    ]);

    expect(await get(`/reports/daily-flow?from=${month}&to=${month}`)).toEqual([
      { date: today, income: 50_000, expenses: 20_000, count: 2 },
    ]);
  });

  it('spending trends and the spending comparison', async () => {
    const trends = await get(
      `/reports/spending-trends?category_ids=food&from=${month}&to=${month}`,
    );
    expect(trends).toHaveLength(1);
    expect(trends[0]).toMatchObject({ categoryId: 'food', total: 20_000 });

    for (const mode of [
      'month_vs_last_month',
      'week_vs_last_week',
      'month_vs_last_year',
      'month_vs_average',
      'year_vs_last_year',
    ]) {
      const comparison = await get(`/reports/spending-comparison?mode=${mode}`);
      expect(comparison.currentTotal, mode).toBe(20_000);
    }
  });

  it('custom reports, even when a dollar account is picked', async () => {
    const range = `from=${month}&to=${month}`;
    const byCategory = await get(`/reports/custom?${range}&balance_type=expense`);
    expect(byCategory.data).toEqual([{ name: 'Food', id: 'food', value: 20_000 }]);

    const net = await get(`/reports/custom?${range}&balance_type=net&group_by=month`);
    expect(net.data).toEqual([{ name: month, id: month, value: 30_000 }]);

    const overTime = await get(`/reports/custom?${range}&balance_type=income&mode=time`);
    expect(overTime.data).toEqual([{ month, Salary: 50_000 }]);

    const byAccount = await get(
      `/reports/custom?${range}&group_by=account&account_ids=${pesosId},${dollarsId}`,
    );
    expect(byAccount.data).toEqual([{ name: 'Pesos', id: pesosId, value: 20_000 }]);
  });

  it('recurring summary', async () => {
    const schedule = (name: string, accountId: string, amount: number) =>
      send('POST', '/schedules', {
        name,
        accountId,
        amount,
        recurrenceType: 'monthly',
        startDate: today,
      });
    await schedule('Alquiler', pesosId, -30_000);
    await schedule('Sueldo', pesosId, 90_000);
    await schedule('Netflix', dollarsId, -1_500);
    await schedule('Freelance', dollarsId, 40_000);

    expect(await get(`/schedules/summary?month=${month}`)).toEqual({
      income: 90_000,
      expenses: -30_000,
    });
  });
});
