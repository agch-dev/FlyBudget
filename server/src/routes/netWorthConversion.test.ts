import { afterAll, beforeAll, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { exchangeRates } from '../db/schema.js';
import { accountsRouter } from './accounts.js';
import { reportsRouter } from './reports.js';
import { transactionsRouter } from './transactions.js';

// Net worth is one number that includes dollar balances, each converted at the exchange rate
// of the day the point is shown for. Every expected figure below is worked out by hand.

let server: Server;
let base: string;

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const get = async (path: string) => (await send('GET', path)).body;

const setRate = (date: string, rate: number) =>
  db
    .insert(exchangeRates)
    .values({ date, rate, fetchedAt: '2025-01-01T00:00:00.000Z', isManual: 1 })
    .onConflictDoUpdate({ target: exchangeRates.date, set: { rate } })
    .run();

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const account = (name: string, type: string, currency: string, startingBalance: number) =>
    send('POST', '/accounts', { name, type, currency, startingBalance });
  // $ 150,000 and US$ 3,200 in the bank, US$ 200 owed on a card from March 20
  await account('Pesos', 'checking', 'UYU', 15_000_000);
  await account('Dollars', 'savings', 'USD', 320_000);
  const card = (await account('Card', 'credit', 'USD', 0)).body;
  await send('POST', '/transactions', { accountId: card.id, date: '2025-03-20', amount: -20_000 });

  setRate('2025-03-01', 40);
  setRate('2025-03-10', 42);
  setRate('2025-04-30', 45);
});
afterAll(() => server.close());

it('each day of the history uses that day’s rate, for what is owned and what is owed', async () => {
  const points = await get('/reports/net-worth?granularity=daily&from=2025-03-09&to=2025-03-20');
  // 150,000 + 3,200 × 40
  expect(points[0]).toEqual({
    month: '2025-03-09',
    assets: 27_800_000,
    liabilities: 0,
    netWorth: 27_800_000,
    native: { UYU: 15_000_000, USD: 320_000 },
  });
  // No balance changed overnight; the dollar went from 40 to 42
  expect(points[1]).toMatchObject({ month: '2025-03-10', netWorth: 28_440_000 });
  expect(points[1].native).toEqual(points[0].native);
  // The card: US$ 200 × 42 owed
  expect(points.at(-1)).toEqual({
    month: '2025-03-20',
    assets: 28_440_000,
    liabilities: 840_000,
    netWorth: 27_600_000,
    native: { UYU: 15_000_000, USD: 300_000 },
  });
});

it('each month of the history uses the rate of its last day', async () => {
  const points = await get('/reports/net-worth?from=2025-03&to=2025-05');
  expect(points.map((p: { month: string; netWorth: number }) => [p.month, p.netWorth])).toEqual([
    ['2025-03', 15_000_000 + 300_000 * 42],
    ['2025-04', 15_000_000 + 300_000 * 45],
    ['2025-05', 15_000_000 + 300_000 * 45],
  ]);
});

it('the month in progress is shown as of today, like the last daily point', async () => {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const day = `${month}-${pad(today.getDate())}`;
  // A rate entered ahead for tomorrow is not today's
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  setRate(
    `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`,
    90,
  );
  const monthly = await get(`/reports/net-worth?from=${month}&to=${month}`);
  const daily = await get(`/reports/net-worth?granularity=daily&from=${day}&to=${day}`);
  expect(monthly.at(-1).netWorth).toBe(15_000_000 + 300_000 * 45);
  expect(daily.at(-1).netWorth).toBe(monthly.at(-1).netWorth);
});

it('correcting a rate changes the net worth of the days that used it', async () => {
  setRate('2025-03-10', 44);
  const points = await get('/reports/net-worth?granularity=daily&from=2025-03-09&to=2025-03-10');
  expect(points.map((p: { netWorth: number }) => p.netWorth)).toEqual([27_800_000, 29_080_000]);
  setRate('2025-03-10', 42);
});

it('shows it in dollars when asked: pesos balances convert at the same day’s rate', async () => {
  const points = await get(
    '/reports/net-worth?granularity=daily&from=2025-03-09&to=2025-03-10&currency=USD',
  );
  // 150,000 / 40 = 3,750 and 150,000 / 42 = 3,571.43, plus US$ 3,200
  expect(points.map((p: { netWorth: number }) => p.netWorth)).toEqual([695_000, 677_143]);
  expect(points[0].native).toEqual({ UYU: 15_000_000, USD: 320_000 });
});

it('refuses a currency that does not exist', async () => {
  const res = await send('GET', '/reports/net-worth?from=2025-03&to=2025-03&currency=EUR');
  expect(res.status).toBe(400);
});
