import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import fc from 'fast-check';
import {
  estimatedDatesLabel,
  ratesNotice,
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
    expect(estimatedDatesLabel(['2023-11-10'])).toBe('Nov 10, 2023');
    expect(estimatedDatesLabel(['2023-02-01', '2023-11-10'])).toBe('Feb 1, 2023 and Nov 10, 2023');
    expect(estimatedDatesLabel(['2022-12-31', '2023-02-01', '2023-11-10'])).toBe(
      'Dec 31, 2022, Feb 1, 2023 and Nov 10, 2023',
    );
  });

  it('writes each date the way the App Language does', () => {
    setLanguage('es');
    expect(estimatedDatesLabel(['2023-11-10'])).toBe('10 nov 2023');
  });

  it('gives the range for more, whatever order they come in', () => {
    expect(estimatedDatesLabel(['2023-02-01', '2021-03-12', '2022-07-04', '2023-11-10'])).toBe(
      '4 dates from Mar 12, 2021 to Nov 10, 2023',
    );
  });

  it('counts a repeated date once', () => {
    expect(estimatedDatesLabel(['2023-11-10', '2023-11-10'])).toBe('Nov 10, 2023');
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

describe('ratesNotice', () => {
  it('is silent when every dollar amount has a rate', () => {
    expect(ratesNotice({ dates: [], notCounted: false })).toBeNull();
    expect(ratesNotice(undefined)).toBeNull();
  });

  it('says amounts are estimated when an earlier rate is missing but another one is stored', () => {
    expect(ratesNotice({ dates: ['2023-11-10'], notCounted: false })).toEqual({
      title: 'No exchange rate for Nov 10, 2023.',
      detail:
        'Dollar amounts on that date are converted at the closest rate available, so totals are estimated.',
    });
    expect(ratesNotice({ dates: ['2023-02-01', '2023-11-10'] })?.detail).toContain('those dates');
  });

  it('never promises an estimate when no rate is stored at all', () => {
    fc.assert(
      fc.property(fc.array(isoDay, { maxLength: 6 }), (dates) => {
        const notice = ratesNotice({ dates, notCounted: true })!;
        expect(notice.title).toBe('No exchange rate stored yet.');
        expect(notice.detail).toBe(
          'Totals in pesos leave dollar amounts out, and totals in dollars leave pesos out, until there is one.',
        );
        expect(notice.title + notice.detail).not.toMatch(/closest|estimated/);
      }),
    );
  });
});

describe('the rates notice in Spanish', () => {
  it('names the dates with Spanish months and joins them with "y"', () => {
    setLanguage('es');
    expect(estimatedDatesLabel(['2023-11-10'])).toBe('10 nov 2023');
    expect(estimatedDatesLabel(['2022-12-31', '2023-02-01', '2023-11-10'])).toBe(
      '31 dic 2022, 1 feb 2023 y 10 nov 2023',
    );
    expect(estimatedDatesLabel(['2023-02-01', '2021-03-12', '2022-07-04', '2023-11-10'])).toBe(
      '4 fechas entre el 12 mar 2021 y el 10 nov 2023',
    );
  });

  it('speaks of one date or several', () => {
    setLanguage('es');
    expect(ratesNotice({ dates: ['2023-11-10'] })).toEqual({
      title: 'No hay tipo de cambio para 10 nov 2023.',
      detail:
        'Los montos en dólares de esa fecha se convierten al tipo de cambio más cercano disponible, así que los totales son estimados.',
    });
    expect(ratesNotice({ dates: ['2023-02-01', '2023-11-10'] })?.detail).toContain('esas fechas');
    expect(ratesNotice({ dates: [], notCounted: true })?.title).toBe(
      'Todavía no hay ningún tipo de cambio guardado.',
    );
  });
});
