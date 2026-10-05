import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, exchangeRates, transactions } from '../db/schema.js';
import { CURRENCIES, type Currency } from '../utils/currency.js';
import { converter } from './currencyConversion.js';
import { convertedAmount, convertedSum } from './convertedAmounts.js';
import type { RatePoint } from './exchangeRates.js';

// Queries convert in SQL; the rule itself is the pure `converter`. Whatever the amounts,
// dates and rates, the two must give the same cents.

const isoDay = fc
  .integer({ min: 0, max: 400 })
  .map((n) => new Date(Date.UTC(2025, 0, 1 + n)).toISOString().slice(0, 10));
const rate = fc.integer({ min: 1_000, max: 200_000 }).map((n) => n / 1000);
const rateTable = fc
  .uniqueArray(isoDay, { maxLength: 12 })
  .chain((dates) =>
    fc.tuple(...dates.map((date) => rate.map((r): RatePoint => ({ date, rate: r })))),
  );
const transaction = fc.record({
  currency: fc.constantFrom(...CURRENCIES),
  date: isoDay,
  amount: fc.integer({ min: -1e9, max: 1e9 }),
});

const accountOf: Record<Currency, string> = { UYU: 'pesos', USD: 'dollars' };

function store(rates: RatePoint[], rows: { currency: Currency; date: string; amount: number }[]) {
  db.delete(transactions).run();
  db.delete(exchangeRates).run();
  if (rates.length) {
    db.insert(exchangeRates)
      .values(rates.map((r) => ({ ...r, fetchedAt: '2026-01-01T00:00:00.000Z' })))
      .run();
  }
  if (rows.length) {
    db.insert(transactions)
      .values(
        rows.map((row, i) => ({
          id: `t${i}`,
          accountId: accountOf[row.currency],
          date: row.date,
          amount: row.amount,
        })),
      )
      .run();
  }
}

beforeAll(() => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  db.insert(accounts)
    .values([
      { id: 'pesos', name: 'Pesos', type: 'checking', currency: 'UYU' },
      { id: 'dollars', name: 'Dollars', type: 'checking', currency: 'USD' },
    ])
    .run();
});

describe('convertedAmount (SQL)', () => {
  it('US$ 50 on a day the rate was 40 is $ 2,000', () => {
    store(
      [{ date: '2026-03-02', rate: 40 }],
      [{ currency: 'USD', date: '2026-03-03', amount: -5_000 }],
    );
    const row = db
      .select({ pesos: convertedAmount('UYU'), dollars: convertedAmount('USD') })
      .from(transactions)
      .get();
    expect(row).toEqual({ pesos: -200_000, dollars: -5_000 });
  });

  it('gives every transaction the cents the pure rule gives, in either currency', () => {
    fc.assert(
      fc.property(rateTable, fc.array(transaction, { maxLength: 15 }), (rates, rows) => {
        store(rates, rows);
        const convert = converter(rates);
        for (const target of CURRENCIES) {
          const found = db
            .select({ id: transactions.id, converted: convertedAmount(target) })
            .from(transactions)
            .all();
          const byId = Object.fromEntries(found.map((r) => [r.id, r.converted]));
          rows.forEach((row, i) => {
            expect(byId[`t${i}`]).toBe(convert(row.amount, row.currency, target, row.date));
          });
        }
      }),
      { numRuns: 60 },
    );
  });

  it('works in a query that joins other tables and filters', () => {
    store(
      [{ date: '2026-03-02', rate: 40 }],
      [
        { currency: 'USD', date: '2026-03-03', amount: -5_000 },
        { currency: 'UYU', date: '2026-03-03', amount: -300 },
      ],
    );
    const row = db
      .select({ total: convertedSum('UYU') })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(sql`${transactions.date} >= '2026-03-01'`)
      .get();
    expect(row?.total).toBe(-200_300);
  });
});

describe('convertedSum (SQL)', () => {
  it('adds each transaction converted at its own date, and is 0 for no rows', () => {
    fc.assert(
      fc.property(rateTable, fc.array(transaction, { maxLength: 15 }), (rates, rows) => {
        fc.pre(rates.length > 0);
        store(rates, rows);
        const convert = converter(rates);
        for (const target of CURRENCIES) {
          const expected = rows.reduce(
            (sum, row) => sum + convert(row.amount, row.currency, target, row.date)!,
            0,
          );
          const total = db
            .select({ total: convertedSum(target) })
            .from(transactions)
            .get();
          expect(total?.total).toBe(expected);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('leaves out what cannot be converted while there are no rates at all', () => {
    store(
      [],
      [
        { currency: 'USD', date: '2026-03-03', amount: -5_000 },
        { currency: 'UYU', date: '2026-03-03', amount: -300 },
      ],
    );
    const row = db
      .select({ total: convertedSum('UYU') })
      .from(transactions)
      .get();
    expect(row?.total).toBe(-300);
  });
});
