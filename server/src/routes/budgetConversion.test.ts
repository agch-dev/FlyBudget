import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import fc from 'fast-check';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  budgetMonths,
  categories,
  categoryGroups,
  exchangeRates,
  transactions,
} from '../db/schema.js';
import { budgetRouter } from './budget.js';
import { createExchangeRatesRouter } from './exchangeRates.js';
import { transactionsRouter } from './transactions.js';

// The Budget is in pesos and counts on-budget dollar accounts, each transaction converted at
// the exchange rate of its own date. Every expected figure below is worked out by hand.

let server: Server;
let base: string;

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
};
const get = (path: string) => send('GET', path);

interface BudgetCategory {
  id: string;
  budgeted: number;
  spent: number;
  carryOver: number;
  balance: number;
}
const budgetCategory = async (month: string, id: string): Promise<BudgetCategory> =>
  (await get(`/budget/${month}`))
    .flatMap((g: { categories: BudgetCategory[] }) => g.categories)
    .find((c: BudgetCategory) => c.id === id);

function clear() {
  db.delete(transactions).run();
  db.delete(budgetMonths).run();
  db.delete(exchangeRates).run();
  db.delete(accounts).run();
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
  app.use('/api/budget', budgetRouter);
  app.use(
    '/api/exchange-rates',
    createExchangeRatesRouter(() => Promise.reject(new Error('never fetched in tests'))),
  );
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

describe('budget with dollar accounts', () => {
  const rate = (date: string, value: number) =>
    send('PUT', `/exchange-rates/${date}`, { rate: value });

  beforeAll(async () => {
    clear();
    db.insert(accounts)
      .values([
        { id: 'pesos', name: 'Pesos', type: 'checking', currency: 'UYU' },
        { id: 'dollars', name: 'Dollars', type: 'checking', currency: 'USD' },
        { id: 'broker', name: 'Broker', type: 'investment', currency: 'USD', isOffBudget: 1 },
      ])
      .run();
    await rate('2026-02-10', 39);
    await rate('2026-03-02', 40);
    await rate('2026-03-16', 41);

    const add = (accountId: string, date: string, amount: number, categoryId: string) =>
      send('POST', '/transactions', { accountId, date, amount, categoryId });
    // February
    await add('pesos', '2026-02-05', 500_000, 'salary');
    await add('dollars', '2026-02-11', 10_000, 'salary'); // US$ 100 at 39 = $ 3,900
    await add('dollars', '2026-02-12', -1_000, 'food'); // US$ 10 at 39 = $ 390
    // March
    await add('dollars', '2026-03-03', -5_000, 'food'); // US$ 50 at 40 = $ 2,000
    await add('pesos', '2026-03-10', -30_000, 'food');
    await add('dollars', '2026-03-20', -1_000, 'food'); // US$ 10 at 41 = $ 410
    await add('dollars', '2026-03-16', 100_000, 'salary'); // US$ 1,000 at 41 = $ 41,000
    await add('broker', '2026-03-04', -9_999, 'food'); // off budget: not counted

    await send('PUT', '/budget/2026-02/food', { budgeted: 100_000 });
    await send('PUT', '/budget/2026-03/food', { budgeted: 300_000 });
  });

  it('category activity, carry-over and balance count dollar purchases at their date’s rate', async () => {
    expect(await budgetCategory('2026-02', 'food')).toMatchObject({
      budgeted: 100_000,
      spent: 39_000,
      carryOver: 0,
      balance: 61_000,
    });
    expect(await budgetCategory('2026-03', 'food')).toMatchObject({
      budgeted: 300_000,
      spent: 271_000,
      carryOver: 61_000,
      balance: 90_000,
    });
  });

  it('dollar income adds to To Be Budgeted at the rate of the day it arrived', async () => {
    expect(await get('/budget/2026-02/summary')).toEqual({
      month: '2026-02',
      income: 890_000,
      totalBudgeted: 100_000,
      carryOver: 0,
      toBeBudgeted: 790_000,
    });
    expect(await get('/budget/2026-03/summary')).toEqual({
      month: '2026-03',
      income: 4_100_000,
      totalBudgeted: 300_000,
      carryOver: 790_000,
      toBeBudgeted: 4_590_000,
    });
  });

  it('the category page agrees with the Budget: history', async () => {
    const food = await get('/budget/category/food/history?months=2&currentMonth=2026-03');
    expect(food.history).toEqual([
      { month: '2026-02', amount: 39_000 },
      { month: '2026-03', amount: 271_000 },
    ]);
    const salary = await get('/budget/category/salary/history?months=2&currentMonth=2026-03');
    expect(salary.history).toEqual([
      { month: '2026-02', amount: 890_000 },
      { month: '2026-03', amount: 4_100_000 },
    ]);
  });

  it('the category page agrees with the Budget: its transactions carry their converted amount', async () => {
    const rows: {
      accountId: string;
      date: string;
      amount: number;
      currency: string;
      convertedAmount: number | null;
    }[] = await get('/transactions?category_id=food&from=2026-03-01&to=2026-03-31');
    const shown = rows
      .map((r) => [r.accountId, r.date, r.currency, r.amount, r.convertedAmount])
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    expect(shown).toEqual([
      ['dollars', '2026-03-03', 'USD', -5_000, -200_000],
      ['broker', '2026-03-04', 'USD', -9_999, -399_960],
      // A pesos amount converts the other way: $ 300 at 40 = US$ 7.50
      ['pesos', '2026-03-10', 'UYU', -30_000, -750],
      ['dollars', '2026-03-20', 'USD', -1_000, -41_000],
    ]);

    const inPesos = rows
      .filter((r) => r.accountId !== 'broker')
      .reduce((sum, r) => sum + (r.currency === 'UYU' ? r.amount : r.convertedAmount!), 0);
    expect(-inPesos).toBe((await budgetCategory('2026-03', 'food')).spent);
  });

  it('planned amounts are stored in pesos as entered', async () => {
    await send('PUT', '/budget/2026-03/fun', { budgeted: 12_345 });
    expect(await budgetCategory('2026-03', 'fun')).toMatchObject({
      budgeted: 12_345,
      balance: 12_345,
    });
    await send('PUT', '/budget/2026-03/fun', { budgeted: 0 });
  });

  it('editing a past date’s rate changes the budget figures that used it', async () => {
    await rate('2026-03-03', 42); // the US$ 50 purchase is now $ 2,100
    try {
      expect(await budgetCategory('2026-03', 'food')).toMatchObject({
        spent: 281_000,
        balance: 80_000,
      });
      const history = await get('/budget/category/food/history?months=1&currentMonth=2026-03');
      expect(history.history).toEqual([{ month: '2026-03', amount: 281_000 }]);
      // February used other dates' rates
      expect(await budgetCategory('2026-02', 'food')).toMatchObject({ spent: 39_000 });
    } finally {
      db.delete(exchangeRates).where(eq(exchangeRates.date, '2026-03-03')).run();
    }
  });

  it('dollar income is never revalued when the dollar moves later', async () => {
    await rate('2026-04-01', 50);
    expect(await get('/budget/2026-03/summary')).toMatchObject({
      income: 4_100_000,
      toBeBudgeted: 4_590_000,
    });
    expect(await get('/budget/2026-04/summary')).toEqual({
      month: '2026-04',
      income: 0,
      totalBudgeted: 0,
      // $ 5,000 + $ 3,900 + $ 41,000 received, $ 4,000 planned
      carryOver: 4_590_000,
      toBeBudgeted: 4_590_000,
    });
  });

  it('nothing converted is stored on a transaction', async () => {
    const stored = db.select().from(transactions).where(eq(transactions.date, '2026-03-03')).get();
    expect(stored?.amount).toBe(-5_000);
    expect(Object.values(stored ?? {})).not.toContain(-200_000);
  });
});

describe('budget with only pesos accounts', () => {
  const months = ['2026-01', '2026-02', '2026-03'];
  const day = fc
    .tuple(fc.constantFrom(...months), fc.integer({ min: 1, max: 28 }))
    .map(([month, d]) => `${month}-${String(d).padStart(2, '0')}`);
  const tx = fc.record({
    accountId: fc.constantFrom('pesos', 'cash', 'house'),
    date: day,
    amount: fc.integer({ min: -5_000_000, max: 5_000_000 }),
    categoryId: fc.constantFrom('food', 'fun', 'salary', null),
  });
  const plan = fc.record({
    month: fc.constantFrom(...months),
    categoryId: fc.constantFrom('food', 'fun'),
    budgeted: fc.integer({ min: 0, max: 5_000_000 }),
  });
  const rates = fc.uniqueArray(
    fc.record({ date: day, rate: fc.integer({ min: 1_000, max: 90_000 }).map((n) => n / 1000) }),
    { selector: (r) => r.date, maxLength: 5 },
  );

  it('gives exactly the plain sums it gave before, whatever the exchange rates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(tx, { maxLength: 25 }),
        fc.uniqueArray(plan, { selector: (p) => p.month + p.categoryId, maxLength: 6 }),
        rates,
        async (txs, plans, rateRows) => {
          clear();
          db.insert(accounts)
            .values([
              { id: 'pesos', name: 'Pesos', type: 'checking' },
              { id: 'cash', name: 'Cash', type: 'cash' },
              { id: 'house', name: 'House', type: 'real_estate', isOffBudget: 1 },
            ])
            .run();
          if (rateRows.length)
            db.insert(exchangeRates)
              .values(rateRows.map((r) => ({ ...r, fetchedAt: '2026-01-01T00:00:00.000Z' })))
              .run();
          if (txs.length)
            db.insert(transactions)
              .values(txs.map((t, i) => ({ id: `t${i}`, ...t })))
              .run();
          if (plans.length)
            db.insert(budgetMonths)
              .values(plans.map((p, i) => ({ id: `b${i}`, ...p })))
              .run();

          const onBudget = txs.filter((t) => t.accountId !== 'house');
          const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);
          const planned = (rows: typeof plans) => rows.reduce((s, p) => s + p.budgeted, 0);

          for (const month of months) {
            const inMonth = (t: { date: string }) => t.date.startsWith(month);
            const before = (t: { date: string }) => t.date < `${month}-01`;

            for (const categoryId of ['food', 'fun']) {
              const mine = onBudget.filter((t) => t.categoryId === categoryId);
              const activity = sum(mine.filter(inMonth));
              const budgeted = planned(
                plans.filter((p) => p.categoryId === categoryId && p.month === month),
              );
              const carryOver =
                planned(plans.filter((p) => p.categoryId === categoryId && p.month < month)) +
                sum(mine.filter(before));
              expect(await budgetCategory(month, categoryId)).toMatchObject({
                budgeted,
                spent: activity < 0 ? -activity : 0,
                carryOver,
                balance: carryOver + budgeted + activity,
              });

              const history = await get(
                `/budget/category/${categoryId}/history?months=1&currentMonth=${month}`,
              );
              expect(history.history).toEqual([
                {
                  month,
                  amount: sum(
                    mine.filter(inMonth).map((t) => ({ amount: t.amount < 0 ? -t.amount : 0 })),
                  ),
                },
              ]);
            }

            const salary = onBudget.filter((t) => t.categoryId === 'salary');
            const income = sum(salary.filter(inMonth));
            const totalBudgeted = planned(plans.filter((p) => p.month === month));
            const carryOver =
              sum(salary.filter(before)) - planned(plans.filter((p) => p.month < month));
            expect(await get(`/budget/${month}/summary`)).toEqual({
              month,
              income,
              totalBudgeted,
              carryOver,
              toBeBudgeted: income + carryOver - totalBudgeted,
            });
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});
