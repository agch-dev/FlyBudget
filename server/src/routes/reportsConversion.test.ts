import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { addDays, addMonths, format } from 'date-fns';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  exchangeRates,
  scheduleOccurrences,
  schedules,
  transactions,
} from '../db/schema.js';
import { createExchangeRatesRouter } from './exchangeRates.js';
import { reportsRouter } from './reports.js';
import { schedulesRouter } from './schedules.js';
import { transactionsRouter } from './transactions.js';

// Reports, the dashboard's cards, cash flow and the Recurring summary are in pesos and count
// dollar accounts, each transaction converted at the exchange rate of its own date. Every
// expected figure below is worked out by hand.

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
const rate = (date: string, value: number) =>
  send('PUT', `/exchange-rates/${date}`, { rate: value });
const add = (accountId: string, date: string, amount: number, categoryId: string | null) =>
  send('POST', '/transactions', { accountId, date, amount, categoryId });

function reset() {
  db.delete(scheduleOccurrences).run();
  db.delete(schedules).run();
  db.delete(transactions).run();
  db.delete(exchangeRates).run();
  db.delete(accounts).run();
  db.insert(accounts)
    .values([
      { id: 'pesos', name: 'Pesos', type: 'checking', currency: 'UYU' },
      { id: 'dollars', name: 'Dollars', type: 'checking', currency: 'USD' },
      { id: 'broker', name: 'Broker', type: 'investment', currency: 'USD', isOffBudget: 1 },
    ])
    .run();
}

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
      { id: 'fun', groupId: 'spending', name: 'Fun' },
      { id: 'salary', groupId: 'income', name: 'Salary' },
    ])
    .run();

  const app = express();
  app.use(express.json());
  app.use(
    '/api/exchange-rates',
    createExchangeRatesRouter(() => Promise.reject(new Error('never fetched in tests'))),
  );
  app.use('/api/reports', reportsRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

describe('reports with dollar accounts', () => {
  const feb = 'from=2026-02&to=2026-02';
  const mar = 'from=2026-03&to=2026-03';
  const both = 'from=2026-02&to=2026-03';

  beforeAll(async () => {
    reset();
    await rate('2026-02-10', 39);
    await rate('2026-03-02', 40);
    await rate('2026-03-16', 41);

    // February
    await add('pesos', '2026-02-05', 500_000, 'salary');
    await add('dollars', '2026-02-11', 10_000, 'salary'); // US$ 100 at 39 = $ 3,900
    await add('dollars', '2026-02-12', -1_000, 'food'); // US$ 10 at 39 = $ 390
    // March
    await add('dollars', '2026-03-03', -5_000, 'food'); // US$ 50 at 40 = $ 2,000
    await add('broker', '2026-03-04', -999, 'food'); // off budget; US$ 9.99 at 40 = $ 399.60
    await add('pesos', '2026-03-10', -30_000, 'food');
    await add('dollars', '2026-03-16', 100_000, 'salary'); // US$ 1,000 at 41 = $ 41,000
    await add('dollars', '2026-03-20', -1_000, 'fun'); // US$ 10 at 41 = $ 410
  });

  it('spending and income by category', async () => {
    const spending = await get(`/reports/spending-by-category?${both}`);
    const spent = Object.fromEntries(
      spending.map((r: { categoryId: string; totalSpent: number }) => [r.categoryId, r.totalSpent]),
    );
    // Food: 390 + 2,000 + 399.60 + 300 pesos
    expect(spent).toEqual({ food: 308_960, fun: 41_000 });

    const income = await get(`/reports/income-by-category?${both}`);
    expect(income).toHaveLength(1);
    // 5,000 + 3,900 + 41,000
    expect(income[0]).toMatchObject({ categoryId: 'salary', totalReceived: 4_990_000 });
  });

  it('income vs. expenses', async () => {
    expect(await get(`/reports/income-vs-expenses?${both}`)).toEqual([
      {
        month: '2026-02',
        income: 890_000,
        expenses: 39_000,
        net: 851_000,
        expenseNet: -39_000,
        expenseCount: 1,
      },
      {
        month: '2026-03',
        income: 4_100_000,
        expenses: 310_960,
        net: 3_789_040,
        expenseNet: -310_960,
        expenseCount: 4,
      },
    ]);
  });

  it('cash flow counts budget accounts of both currencies', async () => {
    expect(await get(`/reports/cash-flow?${both}`)).toEqual([
      { month: '2026-02', net: 851_000 },
      // 41,000 − 2,000 − 300 − 410; the broker is off budget
      { month: '2026-03', net: 3_829_000 },
    ]);
  });

  it("the calendar's daily in and out", async () => {
    expect(await get(`/reports/daily-flow?${mar}`)).toEqual([
      { date: '2026-03-03', income: 0, expenses: 200_000, count: 1 },
      { date: '2026-03-10', income: 0, expenses: 30_000, count: 1 },
      { date: '2026-03-16', income: 4_100_000, expenses: 0, count: 1 },
      { date: '2026-03-20', income: 0, expenses: 41_000, count: 1 },
    ]);
  });

  it('spending trends, by month and by day', async () => {
    const monthly = await get(`/reports/spending-trends?category_ids=food&${both}`);
    expect(
      monthly.map((r: { month: string; total: number }) => [r.month, r.total]).sort(),
    ).toEqual([
      ['2026-02', 39_000],
      ['2026-03', 269_960],
    ]);

    const daily = await get(`/reports/spending-trends?category_ids=food&${mar}&granularity=daily`);
    expect(daily.map((r: { month: string; total: number }) => [r.month, r.total]).sort()).toEqual([
      ['2026-03-03', 200_000],
      ['2026-03-04', 39_960],
      ['2026-03-10', 30_000],
    ]);
  });

  describe('custom reports', () => {
    const custom = (query: string) => get(`/reports/custom?${query}`);

    it('totals by category, biggest first', async () => {
      const report = await custom(`${both}&balance_type=expense`);
      expect(report.data).toEqual([
        { name: 'Food', id: 'food', value: 308_960 },
        { name: 'Fun', id: 'fun', value: 41_000 },
      ]);
    });

    it('totals by category group, payee and month', async () => {
      const byGroup = await custom(`${both}&balance_type=expense&group_by=categoryGroup`);
      expect(byGroup.data).toEqual([{ name: 'Spending', id: 'spending', value: 349_960 }]);

      const byPayee = await custom(`${both}&balance_type=income&group_by=payee`);
      expect(byPayee.data).toEqual([{ name: 'Unknown', id: null, value: 4_990_000 }]);

      const net = await custom(`${both}&balance_type=net&group_by=month`);
      expect(net.data).toEqual([
        { name: '2026-02', id: '2026-02', value: 851_000 },
        { name: '2026-03', id: '2026-03', value: 3_789_040 },
      ]);
    });

    it('totals by account are each in pesos, and a dollar account can be picked', async () => {
      const byAccount = await custom(`${both}&balance_type=expense&group_by=account`);
      expect(byAccount.data).toEqual([
        { name: 'Dollars', id: 'dollars', value: 280_000 },
        { name: 'Broker', id: 'broker', value: 39_960 },
        { name: 'Pesos', id: 'pesos', value: 30_000 },
      ]);

      const picked = await custom(`${both}&balance_type=expense&account_ids=dollars`);
      expect(picked.data).toEqual([
        { name: 'Food', id: 'food', value: 239_000 },
        { name: 'Fun', id: 'fun', value: 41_000 },
      ]);
    });

    it('over time', async () => {
      const income = await custom(`${both}&balance_type=income&mode=time`);
      expect(income).toEqual({
        mode: 'time',
        groups: ['Salary'],
        data: [
          { month: '2026-02', Salary: 890_000 },
          { month: '2026-03', Salary: 4_100_000 },
        ],
      });

      const spending = await custom(`${feb}&balance_type=expense&mode=time&group_by=account`);
      expect(spending.data).toEqual([{ month: '2026-02', Dollars: 39_000 }]);
    });
  });

  it('the target currency is a parameter: the same reports in dollars', async () => {
    // The pesos transaction of March 10 converts at the rate of March 2: $ 300 / 40 = US$ 7.50
    const spending = await get(`/reports/spending-by-category?${mar}&currency=USD`);
    const spent = Object.fromEntries(
      spending.map((r: { categoryId: string; totalSpent: number }) => [r.categoryId, r.totalSpent]),
    );
    expect(spent).toEqual({ food: 5_000 + 999 + 750, fun: 1_000 });

    expect(await get(`/reports/cash-flow?${mar}&currency=USD`)).toEqual([
      { month: '2026-03', net: 100_000 - 5_000 - 750 - 1_000 },
    ]);
    const custom = await get(`/reports/custom?${mar}&balance_type=expense&currency=USD`);
    expect(custom.data).toEqual([
      { name: 'Food', id: 'food', value: 6_749 },
      { name: 'Fun', id: 'fun', value: 1_000 },
    ]);
    expect(await get(`/reports/daily-flow?${mar}&currency=USD`)).toContainEqual({
      date: '2026-03-10',
      income: 0,
      expenses: 750,
      count: 1,
    });
  });

  it('refuses a currency that is not pesos or dollars', async () => {
    for (const path of [
      `/reports/spending-by-category?${mar}`,
      `/reports/income-by-category?${mar}`,
      `/reports/income-vs-expenses?${mar}`,
      `/reports/cash-flow?${mar}`,
      `/reports/daily-flow?${mar}`,
      `/reports/spending-trends?category_ids=food&${mar}`,
      `/reports/spending-comparison?mode=month_vs_last_month`,
      `/reports/custom?${mar}`,
      `/schedules/summary?month=2026-03`,
    ]) {
      expect((await send('GET', `${path}&currency=EUR`)).status, path).toBe(400);
    }
  });
});

describe('figures around today', () => {
  const now = new Date();
  const day = (d: Date) => format(d, 'yyyy-MM-dd');
  const today = day(now);
  const month = today.slice(0, 7);

  it('the spending comparison converts dollar spending', async () => {
    reset();
    await rate('2026-01-01', 40);
    await add('pesos', today, -20_000, 'food');
    await add('dollars', today, -1_100, 'food'); // US$ 11 at 40 = $ 440
    await add('broker', today, -5_000, 'food'); // off budget

    for (const mode of [
      'month_vs_last_month',
      'week_vs_last_week',
      'month_vs_last_year',
      'month_vs_average',
      'year_vs_last_year',
    ]) {
      const comparison = await get(`/reports/spending-comparison?mode=${mode}`);
      expect(comparison.currentTotal, mode).toBe(64_000);
      expect(comparison.current.at(-1).cumulative, mode).toBe(64_000);
    }
    const inDollars = await get('/reports/spending-comparison?currency=USD');
    expect(inDollars.currentTotal).toBe(1_100 + 500);
  });

  describe('recurring items', () => {
    const nextMonth = format(addMonths(now, 1), 'yyyy-MM');
    const schedule = (name: string, accountId: string | null, amount: number) =>
      send('POST', '/schedules', {
        name,
        accountId,
        amount,
        recurrenceType: 'monthly',
        startDate: today,
      });

    beforeAll(async () => {
      reset();
      await rate('2026-01-01', 40);
      // A rate dated after today (entered by hand): future figures must not use it
      await rate(day(addDays(now, 1)), 50);
      await schedule('Alquiler', 'pesos', -30_000);
      await schedule('Sueldo', 'pesos', 90_000);
      await schedule('Netflix', 'dollars', -1_500); // US$ 15 at 40 = $ 600
      await schedule('Freelance', 'dollars', 40_000); // US$ 400 at 40 = $ 16,000
    });

    it('the month summary counts dollar items at the rate of their date', async () => {
      expect(await get(`/schedules/summary?month=${month}`)).toEqual({
        income: 90_000 + 1_600_000,
        expenses: -30_000 - 60_000,
      });
    });

    it("a future month's summary converts at today's rate", async () => {
      expect(await get(`/schedules/summary?month=${nextMonth}`)).toEqual({
        income: 90_000 + 1_600_000,
        expenses: -30_000 - 60_000,
      });
    });

    it('the summary in dollars', async () => {
      // $ 900 / 40 = US$ 22.50; $ 300 / 40 = US$ 7.50
      expect(await get(`/schedules/summary?month=${month}&currency=USD`)).toEqual({
        income: 40_000 + 2_250,
        expenses: -1_500 - 750,
      });
    });

    it("each occurrence carries its amount in the other currency, at today's rate when it is in the future", async () => {
      const occurrences = await get(
        `/schedules/occurrences?from=${today}&to=${day(addMonths(now, 1))}`,
      );
      const converted = (name: string) =>
        occurrences
          .filter((o: { scheduleName: string }) => o.scheduleName === name)
          .map((o: { convertedExpectedAmount: number }) => o.convertedExpectedAmount);
      expect(converted('Netflix')).toEqual([-60_000, -60_000]);
      expect(converted('Alquiler')).toEqual([-750, -750]);
    });

    it('a paid occurrence carries what was paid, converted at the date it was paid', async () => {
      const [netflix] = (await get(`/schedules/occurrences?from=${today}&to=${today}`)).filter(
        (o: { scheduleName: string }) => o.scheduleName === 'Netflix',
      );
      await send('POST', `/schedules/${netflix.scheduleId}/mark-paid`, {
        date: today,
        occurrenceId: netflix.id,
      });
      const [paid] = (await get(`/schedules/occurrences?from=${today}&to=${today}`)).filter(
        (o: { scheduleName: string }) => o.scheduleName === 'Netflix',
      );
      expect(paid).toMatchObject({
        displayStatus: 'paid',
        currency: 'USD',
        matchedAmount: -1_500,
        convertedMatchedAmount: -60_000,
      });
    });
  });
});

describe('without any exchange rate', () => {
  it('pesos figures are unchanged and dollar amounts are left out', async () => {
    reset();
    await add('pesos', '2026-03-10', -30_000, 'food');
    await add('pesos', '2026-03-11', 50_000, 'salary');
    await add('dollars', '2026-03-12', -1_000, 'food');
    await add('dollars', '2026-03-12', 9_000, 'salary');
    const range = 'from=2026-03&to=2026-03';

    expect(await get(`/reports/income-vs-expenses?${range}`)).toEqual([
      {
        month: '2026-03',
        income: 50_000,
        expenses: 30_000,
        net: 20_000,
        expenseNet: -30_000,
        expenseCount: 1,
      },
    ]);
    expect(await get(`/reports/cash-flow?${range}`)).toEqual([{ month: '2026-03', net: 20_000 }]);
    expect(await get(`/reports/daily-flow?${range}`)).toEqual([
      { date: '2026-03-10', income: 0, expenses: 30_000, count: 1 },
      { date: '2026-03-11', income: 50_000, expenses: 0, count: 1 },
    ]);
    const custom = await get(`/reports/custom?${range}&balance_type=expense&group_by=account`);
    expect(custom.data).toEqual([{ name: 'Pesos', id: 'pesos', value: 30_000 }]);
  });
});
