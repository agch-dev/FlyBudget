import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { converter } from './currencyConversion.js';
import type { RatePoint } from './exchangeRates.js';
import {
  dayShown,
  netWorthSeries,
  type BalanceChange,
  type NetWorthAccount,
  type NetWorthPeriod,
} from './netWorth.js';
import { ACCOUNT_TYPES, isLiabilityType } from '../utils/accountTypes.js';
import { CURRENCIES, type Currency } from '../utils/currency.js';

const days = (first: string, count: number): NetWorthPeriod[] =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.parse(first) + i * 86_400_000).toISOString().slice(0, 10);
    return { key: d, date: d };
  });

const checking = (id: string, currency: Currency, startingBalance: number): NetWorthAccount => ({
  id,
  type: 'checking',
  currency,
  startingBalance,
});

describe('dayShown', () => {
  it('a day is shown for itself, a month for its last day', () => {
    expect(dayShown('2026-03-10', '2026-10-05')).toBe('2026-03-10');
    expect(dayShown('2026-02', '2026-10-05')).toBe('2026-02-28');
    expect(dayShown('2024-02', '2026-10-05')).toBe('2024-02-29');
  });

  it('never a day after today: the month in progress and future days are shown for today', () => {
    expect(dayShown('2026-10', '2026-10-05')).toBe('2026-10-05');
    expect(dayShown('2026-10-20', '2026-10-05')).toBe('2026-10-05');
    expect(dayShown('2027-01', '2026-10-05')).toBe('2026-10-05');
  });
});

describe('netWorthSeries', () => {
  const rates: RatePoint[] = [
    { date: '2026-03-01', rate: 40 },
    { date: '2026-03-03', rate: 42 },
  ];

  it('adds dollar balances to pesos ones at the rate of each day shown', () => {
    const points = netWorthSeries({
      accounts: [checking('pesos', 'UYU', 15_000_000), checking('dollars', 'USD', 320_000)],
      changes: [],
      periods: days('2026-03-01', 4),
      target: 'UYU',
      convert: converter(rates),
    });
    // $ 150,000 + US$ 3,200 at 40, 40 (carried forward), 42, 42
    expect(points.map((p) => p.netWorth)).toEqual([27_800_000, 27_800_000, 28_440_000, 28_440_000]);
    expect(points[0]).toEqual({
      month: '2026-03-01',
      assets: 27_800_000,
      liabilities: 0,
      netWorth: 27_800_000,
      native: { UYU: 15_000_000, USD: 320_000 },
      leftOut: [],
    });
  });

  it('shows the same balances in dollars when asked', () => {
    const [point] = netWorthSeries({
      accounts: [checking('pesos', 'UYU', 15_000_000), checking('dollars', 'USD', 320_000)],
      changes: [],
      periods: days('2026-03-01', 1),
      target: 'USD',
      convert: converter(rates),
    });
    // $ 150,000 at 40 = US$ 3,750, plus US$ 3,200
    expect(point).toMatchObject({ assets: 695_000, netWorth: 695_000 });
    expect(point.native).toEqual({ UYU: 15_000_000, USD: 320_000 });
  });

  it('converts what is owed too, and follows each account as its balance changes', () => {
    const points = netWorthSeries({
      accounts: [
        checking('pesos', 'UYU', 100_000),
        { id: 'card', type: 'credit', currency: 'USD', startingBalance: 0 },
      ],
      changes: [
        { accountId: 'card', period: '2026-03-02', total: -5_000 },
        { accountId: 'pesos', period: '2026-03-04', total: 1_000 },
      ],
      periods: days('2026-03-01', 4),
      target: 'UYU',
      convert: converter(rates),
    });
    expect(points.map((p) => [p.assets, p.liabilities, p.netWorth])).toEqual([
      [100_000, 0, 100_000],
      [100_000, 200_000, -100_000], // US$ 50 owed at 40
      [100_000, 210_000, -110_000], // the same debt at 42
      [101_000, 210_000, -109_000],
    ]);
    expect(points[3].native).toEqual({ UYU: 101_000, USD: -5_000 });
  });

  it('leaves a balance out of the total when no rate is stored, but still lists it', () => {
    const [point] = netWorthSeries({
      accounts: [checking('pesos', 'UYU', 100_000), checking('dollars', 'USD', 7_000)],
      changes: [],
      periods: days('2026-03-01', 1),
      target: 'UYU',
      convert: converter([]),
    });
    expect(point).toMatchObject({ assets: 100_000, netWorth: 100_000 });
    expect(point.native).toEqual({ UYU: 100_000, USD: 7_000 });
    expect(point.leftOut).toEqual(['USD']);
  });

  // Generators
  const accountIds = ['a', 'b', 'c', 'd'];
  const cents = fc.integer({ min: -1e9, max: 1e9 });
  const accountsOf = (currency: fc.Arbitrary<Currency>) =>
    fc.tuple(
      ...accountIds.map((id) =>
        fc.record({
          id: fc.constant(id),
          type: fc.constantFrom(...ACCOUNT_TYPES),
          currency,
          startingBalance: cents,
        }),
      ),
    );
  const periods = days('2026-03-01', 10);
  const changes = fc.uniqueArray(
    fc.record({
      accountId: fc.constantFrom(...accountIds),
      // Some before the range, some after it
      period: fc.constantFrom(...days('2026-02-25', 20).map((p) => p.key)),
      total: cents,
    }),
    { selector: (c) => c.accountId + c.period, maxLength: 25 },
  );
  const rate = fc.integer({ min: 1_000, max: 200_000 }).map((n) => n / 1000);
  const rateTable = fc
    .uniqueArray(fc.constantFrom(...days('2026-02-20', 30).map((p) => p.key)), { maxLength: 12 })
    .chain((dates) => fc.tuple(...dates.map((date) => rate.map((r) => ({ date, rate: r })))));

  /** Net worth as it was computed before currencies existed: plain sums of balances */
  function singleCurrencyNetWorth(accounts: NetWorthAccount[], all: BalanceChange[], day: string) {
    let assets = 0;
    let liabilities = 0;
    for (const account of accounts) {
      const balance = all
        .filter((c) => c.accountId === account.id && c.period <= day)
        .reduce((sum, c) => sum + c.total, account.startingBalance);
      if (isLiabilityType(account.type)) liabilities += Math.abs(Math.min(balance, 0));
      else assets += Math.max(balance, 0);
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }

  it('a budget with only pesos accounts gives exactly the figures it gave before, whatever the rates', () => {
    fc.assert(
      fc.property(accountsOf(fc.constant('UYU')), changes, rateTable, (accounts, all, table) => {
        const points = netWorthSeries({
          accounts,
          changes: all,
          periods,
          target: 'UYU',
          convert: converter(table),
        });
        expect(
          points.map(({ assets, liabilities, netWorth }) => ({ assets, liabilities, netWorth })),
        ).toEqual(periods.map((p) => singleCurrencyNetWorth(accounts, all, p.key)));
        for (const p of points) expect(p.native).toEqual({ UYU: p.netWorth, USD: 0 });
      }),
    );
  });

  it('the breakdown lists each currency as if it were the only one', () => {
    fc.assert(
      fc.property(
        accountsOf(fc.constantFrom(...CURRENCIES)),
        changes,
        rateTable,
        fc.constantFrom(...CURRENCIES),
        (accounts, all, table, target) => {
          const points = netWorthSeries({
            accounts,
            changes: all,
            periods,
            target,
            convert: converter(table),
          });
          points.forEach((point, i) => {
            for (const currency of CURRENCIES) {
              const own = accounts.filter((a) => a.currency === currency);
              expect(point.native[currency]).toBe(
                singleCurrencyNetWorth(own, all, periods[i].key).netWorth,
              );
            }
            expect(point.netWorth).toBe(point.assets - point.liabilities);
            expect(point.assets).toBeGreaterThanOrEqual(0);
            expect(point.liabilities).toBeGreaterThanOrEqual(0);
          });
        },
      ),
    );
  });

  it('says which currencies a total leaves out: none with any rate stored, the others with none', () => {
    fc.assert(
      fc.property(
        accountsOf(fc.constantFrom(...CURRENCIES)),
        changes,
        rateTable,
        fc.constantFrom(...CURRENCIES),
        (accounts, all, table, target) => {
          const series = (rates: RatePoint[]) =>
            netWorthSeries({ accounts, changes: all, periods, target, convert: converter(rates) });
          // One rate is enough: a day before it uses it as an estimate
          if (table.length > 0) for (const p of series(table)) expect(p.leftOut).toEqual([]);
          series([]).forEach((point, i) => {
            const own = accounts.filter((a) => a.currency === target);
            // The total is the target currency's accounts alone
            expect(point.netWorth).toBe(singleCurrencyNetWorth(own, all, periods[i].key).netWorth);
            expect(point.leftOut).not.toContain(target);
            for (const currency of CURRENCIES) {
              // A currency listed in the breakdown and missing from the total is named
              if (currency !== target && point.native[currency] !== 0) {
                expect(point.leftOut).toContain(currency);
              }
            }
          });
        },
      ),
    );
  });

  it('with no change in any balance, a higher rate means more pesos for the same dollars', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e9 }),
        cents,
        rate,
        rate,
        fc.boolean(),
        (dollars, pesos, r1, r2, owed) => {
          fc.pre(r1 !== r2);
          const points = netWorthSeries({
            accounts: [
              checking('pesos', 'UYU', pesos),
              owed
                ? { id: 'usd', type: 'credit', currency: 'USD', startingBalance: -dollars }
                : checking('usd', 'USD', dollars),
            ],
            changes: [],
            periods: days('2026-03-01', 2),
            target: 'UYU',
            convert: converter([
              { date: '2026-03-01', rate: r1 },
              { date: '2026-03-02', rate: r2 },
            ]),
          });
          expect(points[0].native).toEqual(points[1].native);
          const moved = points[1].netWorth - points[0].netWorth;
          // Dollars held gain with the dollar, dollars owed lose (a cent of rounding aside)
          const expected = (owed ? -1 : 1) * dollars * (r2 - r1);
          expect(Math.abs(moved - expected)).toBeLessThanOrEqual(1);
          if (Math.abs(expected) > 1.001) expect(moved).not.toBe(0);
        },
      ),
    );
  });
});
