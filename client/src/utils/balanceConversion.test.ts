import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  balanceIn,
  balancesTotal,
  breakdownLine,
  rateOn,
  totalAndChange,
} from './balanceConversion';
import type { Currency } from '../types';

const isoDay = fc
  .integer({ min: 0, max: 2000 })
  .map((n) => new Date(Date.UTC(2022, 0, 1 + n)).toISOString().slice(0, 10));
const rate = fc.integer({ min: 1_000, max: 200_000 }).map((n) => n / 1000);
const rateTable = fc
  .uniqueArray(isoDay, { maxLength: 20 })
  .chain((dates) => fc.tuple(...dates.map((date) => rate.map((r) => ({ date, rate: r })))));
const cents = fc.integer({ min: -1e9, max: 1e9 });
const currency = fc.constantFrom<Currency>('UYU', 'USD');
const account = fc.record({
  balance: cents,
  currency: fc.constantFrom<Currency | undefined>('UYU', 'USD', undefined),
});

const rates = [
  { date: '2026-03-03', rate: 42 },
  { date: '2026-03-01', rate: 40 },
];

describe('rateOn', () => {
  it('is the rate of that day, else the closest earlier one', () => {
    expect(rateOn(rates, '2026-03-01')).toBe(40);
    expect(rateOn(rates, '2026-03-02')).toBe(40);
    expect(rateOn(rates, '2026-03-03')).toBe(42);
    expect(rateOn(rates, '2026-12-31')).toBe(42);
  });

  it('before every rate it is the earliest one; with no rates there is none', () => {
    expect(rateOn(rates, '2020-01-01')).toBe(40);
    expect(rateOn([], '2026-03-01')).toBeNull();
  });
});

describe('balanceIn', () => {
  it('shows a dollar balance in pesos at the rate of the day it is shown for', () => {
    // US$ 3,200 at 40, then at 42: the balance did not change, its value in pesos did
    expect(balanceIn(320_000, 'USD', 'UYU', '2026-03-02', rates)).toBe(12_800_000);
    expect(balanceIn(320_000, 'USD', 'UYU', '2026-03-03', rates)).toBe(13_440_000);
  });

  it('shows a pesos balance in dollars', () => {
    // $ 150,000 at 42 = US$ 3,571.43
    expect(balanceIn(15_000_000, 'UYU', 'USD', '2026-03-03', rates)).toBe(357_143);
  });

  it('rounds halves away from zero, so what is owed mirrors what is owned', () => {
    const half = [{ date: '2026-01-01', rate: 40.5 }];
    expect(balanceIn(1, 'USD', 'UYU', '2026-01-01', half)).toBe(41);
    expect(balanceIn(-1, 'USD', 'UYU', '2026-01-01', half)).toBe(-41);
  });

  it('has no answer for another currency when no rate is stored', () => {
    expect(balanceIn(100, 'USD', 'UYU', '2026-03-01', [])).toBeNull();
    expect(balanceIn(100, 'USD', 'USD', '2026-03-01', [])).toBe(100);
  });

  it('leaves a balance already in the currency untouched, whatever the rates', () => {
    fc.assert(
      fc.property(cents, currency, isoDay, rateTable, (balance, c, day, table) => {
        expect(balanceIn(balance, c, c, day, table)).toBe(balance);
      }),
    );
  });

  it('gives whole cents within half a cent of the exact amount, mirrored for a negative balance', () => {
    fc.assert(
      fc.property(cents, isoDay, rateTable, (balance, day, table) => {
        fc.pre(table.length > 0);
        const r = rateOn(table, day)!;
        const pesos = balanceIn(balance, 'USD', 'UYU', day, table)!;
        const dollars = balanceIn(balance, 'UYU', 'USD', day, table)!;
        expect(Number.isInteger(pesos)).toBe(true);
        expect(Number.isInteger(dollars)).toBe(true);
        expect(Math.abs(pesos - balance * r)).toBeLessThanOrEqual(0.5 + 1e-3);
        expect(Math.abs(dollars - balance / r)).toBeLessThanOrEqual(0.5 + 1e-3);
        expect(balanceIn(-balance, 'USD', 'UYU', day, table)).toBe(pesos === 0 ? 0 : -pesos);
      }),
    );
  });
});

describe('balancesTotal', () => {
  it('adds dollar accounts to pesos ones at the day’s rate', () => {
    const accounts = [
      { balance: 15_000_000, currency: 'UYU' as const },
      { balance: 320_000, currency: 'USD' as const },
      { balance: -5_000, currency: 'USD' as const },
    ];
    expect(balancesTotal(accounts, 'UYU', '2026-03-02', rates)).toBe(27_600_000);
    expect(balancesTotal(accounts, 'UYU', '2026-03-03', rates)).toBe(28_230_000);
  });

  it('with only pesos accounts it is exactly their plain sum, as before, whatever the rates', () => {
    fc.assert(
      fc.property(fc.array(cents), isoDay, rateTable, (balances, day, table) => {
        const accounts = balances.map((balance, i) =>
          i % 2 ? { balance, currency: 'UYU' as const } : { balance },
        );
        expect(balancesTotal(accounts, 'UYU', day, table)).toBe(
          balances.reduce((sum, b) => sum + b, 0),
        );
      }),
    );
  });

  it('is the sum of what each account shows, leaving out what cannot be converted', () => {
    fc.assert(
      fc.property(fc.array(account), currency, isoDay, rateTable, (accounts, to, day, table) => {
        let expected = 0;
        for (const a of accounts) {
          expected += balanceIn(a.balance, a.currency ?? 'UYU', to, day, table) ?? 0;
        }
        expect(balancesTotal(accounts, to, day, table)).toBe(expected);
      }),
    );
  });
});

describe('totalAndChange', () => {
  const accounts = [
    { id: 'caja', balance: 15_000_000, currency: 'UYU' as const },
    { id: 'usd', balance: 320_000, currency: 'USD' as const },
  ];
  // A month ago: $140,000 and US$3,000
  const ago = { caja: 14_000_000, usd: 300_000 };
  const days = { today: '2026-03-03', ago: '2026-03-01' };

  it('converts today’s balances at today’s rate and the earlier ones at that day’s rate', () => {
    // Today at 42: $150,000 + US$3,200 × 42 = $284,400. Then at 40: $140,000 + US$3,000 × 40 = $260,000
    expect(totalAndChange(accounts, ago, 'UYU', days, rates)).toEqual({
      total: 28_440_000,
      change: 2_440_000,
      before: 26_000_000,
    });
  });

  it('in dollars, converts the pesos balances instead', () => {
    // Today: US$3,200 + $150,000 / 42 = US$6,771.43. Then: US$3,000 + $140,000 / 40 = US$6,500
    expect(totalAndChange(accounts, ago, 'USD', days, rates)).toEqual({
      total: 677_143,
      change: 27_143,
      before: 650_000,
    });
  });

  it('an account with no earlier balance known counts as unchanged', () => {
    expect(totalAndChange([accounts[0]], {}, 'UYU', days, rates)).toEqual({
      total: 15_000_000,
      change: 0,
      before: 15_000_000,
    });
  });

  it('a dollar balance that did not move still changes the pesos total when the rate did', () => {
    const still = [{ id: 'usd', balance: 100_000, currency: 'USD' as const }];
    expect(totalAndChange(still, { usd: 100_000 }, 'UYU', days, rates).change).toBe(200_000);
    expect(totalAndChange(still, { usd: 100_000 }, 'USD', days, rates).change).toBe(0);
  });
});

describe('breakdownLine', () => {
  it('lists the pesos total and the dollars total in their own amounts', () => {
    expect(breakdownLine({ UYU: 15_000_000, USD: 320_000 })).toBe('$150,000 + US$3,200');
    expect(breakdownLine({ UYU: 0, USD: 320_050 })).toBe('$0 + US$3,200.50');
  });

  it('subtracts a currency that is owed overall', () => {
    expect(breakdownLine({ UYU: 15_000_000, USD: -320_000 })).toBe('$150,000 − US$3,200');
    expect(breakdownLine({ UYU: -15_000_000, USD: 320_000 })).toBe('-$150,000 + US$3,200');
  });

  it('puts the currency the total is shown in first', () => {
    expect(breakdownLine({ UYU: 15_000_000, USD: 320_000 }, 'USD')).toBe('US$3,200 + $150,000');
  });

  it('says nothing when there is only the currency of the total, or nothing to go by', () => {
    expect(breakdownLine({ UYU: 15_000_000, USD: 0 })).toBeNull();
    expect(breakdownLine({ UYU: 0, USD: 320_000 }, 'USD')).toBeNull();
    expect(breakdownLine(undefined)).toBeNull();
  });
});
