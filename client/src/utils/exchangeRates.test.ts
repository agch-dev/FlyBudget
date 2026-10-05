import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  estimatedDatesLabel,
  formatRate,
  groupRatesByMonth,
  parseRateInput,
} from './exchangeRates';

const isoDay = fc
  .integer({ min: 0, max: 3000 })
  .map((n) => new Date(Date.UTC(2022, 0, 1 + n)).toISOString().slice(0, 10));

const rates = fc
  .uniqueArray(isoDay, { maxLength: 60 })
  .map((dates) => dates.map((date, i) => ({ date, rate: 38 + i / 10 })));

describe('groupRatesByMonth', () => {
  it('puts every rate in its month exactly once, newest first (property-based)', () => {
    fc.assert(
      fc.property(rates, (list) => {
        const months = groupRatesByMonth(list);
        const flat = months.flatMap((m) => m.rates);
        expect(flat).toHaveLength(list.length);
        expect(new Set(flat)).toEqual(new Set(list));
        expect(flat.map((r) => r.date)).toEqual(
          list
            .map((r) => r.date)
            .sort()
            .reverse(),
        );
        for (const { month, rates: inMonth } of months) {
          expect(inMonth.length).toBeGreaterThan(0);
          for (const r of inMonth) expect(r.date.slice(0, 7)).toBe(month);
        }
        expect(new Set(months.map((m) => m.month)).size).toBe(months.length);
      }),
    );
  });

  it('groups a few days', () => {
    expect(
      groupRatesByMonth([
        { date: '2026-09-30', rate: 40.286 },
        { date: '2026-10-01', rate: 40.463 },
        { date: '2026-10-02', rate: 40.342 },
      ]),
    ).toEqual([
      {
        month: '2026-10',
        rates: [
          { date: '2026-10-02', rate: 40.342 },
          { date: '2026-10-01', rate: 40.463 },
        ],
      },
      { month: '2026-09', rates: [{ date: '2026-09-30', rate: 40.286 }] },
    ]);
  });
});

describe('formatRate', () => {
  it('shows at least two decimals and keeps the third', () => {
    expect(formatRate(40.4)).toBe('40.40');
    expect(formatRate(40.342)).toBe('40.342');
    expect(formatRate(40)).toBe('40.00');
    expect(formatRate(1234.5)).toBe('1,234.50');
  });
});

describe('parseRateInput', () => {
  it('reads what formatRate wrote (property-based)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99_999_999 }), (thousandths) => {
        const rate = thousandths / 1000;
        expect(parseRateInput(formatRate(rate))).toBeCloseTo(rate, 6);
      }),
    );
  });

  it.each(['', ' ', 'abc', '0', '0.00', '-40', '40.3.1', '1e3', '40,35', '999999999'])(
    'refuses %j',
    (text) => {
      expect(parseRateInput(text)).toBeNull();
    },
  );

  it('reads plain decimals', () => {
    expect(parseRateInput(' 40.35 ')).toBe(40.35);
    expect(parseRateInput('41')).toBe(41);
    expect(parseRateInput('1,234.5')).toBe(1234.5);
  });
});

describe('estimatedDatesLabel', () => {
  it('names up to three dates', () => {
    expect(estimatedDatesLabel(['2023-11-10'])).toBe('10 Nov 2023');
    expect(estimatedDatesLabel(['2023-02-01', '2023-11-10'])).toBe('1 Feb 2023 and 10 Nov 2023');
    expect(estimatedDatesLabel(['2022-12-31', '2023-02-01', '2023-11-10'])).toBe(
      '31 Dec 2022, 1 Feb 2023 and 10 Nov 2023',
    );
  });

  it('gives the range for more, whatever order they come in', () => {
    expect(estimatedDatesLabel(['2023-02-01', '2021-03-12', '2022-07-04', '2023-11-10'])).toBe(
      '4 dates from 12 Mar 2021 to 10 Nov 2023',
    );
  });

  it('counts a repeated date once', () => {
    expect(estimatedDatesLabel(['2023-11-10', '2023-11-10'])).toBe('10 Nov 2023');
  });

  it('always mentions the first and last date (property-based)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(isoDay, { minLength: 1, maxLength: 30 }), (dates) => {
        const sorted = [...dates].sort();
        const label = estimatedDatesLabel(dates);
        expect(label).toContain(estimatedDatesLabel([sorted[0]]));
        expect(label).toContain(estimatedDatesLabel([sorted[sorted.length - 1]]));
      }),
    );
  });
});
