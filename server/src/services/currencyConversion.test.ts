import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { convertCents, conversionRates, converter } from './currencyConversion.js';
import type { RatePoint } from './exchangeRates.js';
import { CURRENCIES } from '../utils/currency.js';

const isoDay = fc
  .integer({ min: 0, max: 4000 })
  .map((n) => new Date(Date.UTC(2020, 0, 1 + n)).toISOString().slice(0, 10));

/** A plausible pesos-per-dollar rate, with up to 3 decimals like the source publishes */
const rate = fc.integer({ min: 1_000, max: 200_000 }).map((n) => n / 1000);

/** Rates on distinct dates, in no particular order */
const rateTable = fc
  .uniqueArray(isoDay, { maxLength: 30 })
  .chain((dates) =>
    fc.tuple(...dates.map((date) => rate.map((r): RatePoint => ({ date, rate: r })))),
  );

const cents = fc.integer({ min: -1e9, max: 1e9 });
const currency = fc.constantFrom(...CURRENCIES);

describe('convertCents', () => {
  it('worked examples', () => {
    // US$ 50 on a day the rate was 40 is $ 2,000
    expect(convertCents(-5_000, 'USD', 'UYU', 40)).toBe(-200_000);
    expect(convertCents(200_000, 'UYU', 'USD', 40)).toBe(5_000);
    // US$ 12.34 at 40.342 = $ 497.82028
    expect(convertCents(1_234, 'USD', 'UYU', 40.342)).toBe(49_782);
    // $ 1,000 at 40.342 = US$ 24.788…
    expect(convertCents(100_000, 'UYU', 'USD', 40.342)).toBe(2_479);
    // Halves round away from zero, the same for money in and money out
    expect(convertCents(1, 'USD', 'UYU', 40.5)).toBe(41);
    expect(convertCents(-1, 'USD', 'UYU', 40.5)).toBe(-41);
  });

  it('passes a same-currency amount through unchanged, whatever the rate', () => {
    fc.assert(
      fc.property(cents, currency, rate, (amount, c, r) => {
        expect(convertCents(amount, c, c, r)).toBe(amount);
      }),
    );
  });

  it('gives whole cents, within half a cent of the exact product or quotient', () => {
    fc.assert(
      fc.property(cents, rate, (amount, r) => {
        const pesos = convertCents(amount, 'USD', 'UYU', r);
        const dollars = convertCents(amount, 'UYU', 'USD', r);
        expect(Number.isSafeInteger(pesos)).toBe(true);
        expect(Number.isSafeInteger(dollars)).toBe(true);
        // In thousandths, so the check is exact integer arithmetic (no float rounding)
        const thousandths = BigInt(Math.round(r * 1000));
        const exact = BigInt(amount) * thousandths;
        const off = BigInt(pesos) * 1000n - exact;
        expect(off >= -500n && off <= 500n).toBe(true);
        const back = BigInt(dollars) * thousandths - BigInt(amount) * 1000n;
        expect(back * 2n >= -thousandths && back * 2n <= thousandths).toBe(true);
      }),
    );
  });

  it('converts money out as the mirror of money in, and keeps the sign', () => {
    fc.assert(
      fc.property(cents, currency, currency, rate, (amount, from, to, r) => {
        const converted = convertCents(amount, from, to, r);
        // `+ 0` so a negative zero reads as zero
        expect(convertCents(-amount, from, to, r) + 0).toBe(-converted + 0);
        expect(Math.sign(converted) === Math.sign(amount) || converted === 0).toBe(true);
      }),
    );
  });
});

describe('conversionRates', () => {
  it("uses the date's own rate, else the closest earlier one", () => {
    const on = conversionRates([
      { date: '2026-03-06', rate: 41 },
      { date: '2026-03-02', rate: 40 },
    ]);
    expect(on('2026-03-02')).toBe(40);
    expect(on('2026-03-05')).toBe(40);
    expect(on('2026-03-06')).toBe(41);
    expect(on('2030-01-01')).toBe(41);
  });

  it('uses the earliest rate for a date before every rate, and has none without rates', () => {
    expect(conversionRates([{ date: '2026-03-02', rate: 40 }])('2020-01-01')).toBe(40);
    expect(conversionRates([])('2026-03-02')).toBeNull();
  });

  it('always answers with a stored rate dated on or before the date when one exists', () => {
    fc.assert(
      fc.property(rateTable, isoDay, (rates, date) => {
        const found = conversionRates(rates)(date);
        if (rates.length === 0) {
          expect(found).toBeNull();
          return;
        }
        const newestFirst = [...rates].sort((a, b) => (a.date < b.date ? 1 : -1));
        const earlier = newestFirst.find((r) => r.date <= date);
        expect(found).toBe((earlier ?? newestFirst[newestFirst.length - 1]).rate);
      }),
    );
  });
});

describe('converter', () => {
  const convert = converter([
    { date: '2026-03-02', rate: 40 },
    { date: '2026-03-06', rate: 41 },
  ]);

  it("converts a transaction at its own date's rate, in either direction", () => {
    expect(convert(-5_000, 'USD', 'UYU', '2026-03-03')).toBe(-200_000);
    expect(convert(-5_000, 'USD', 'UYU', '2026-03-06')).toBe(-205_000);
    expect(convert(205_000, 'UYU', 'USD', '2026-03-07')).toBe(5_000);
  });

  it('needs no rate for a same-currency amount', () => {
    fc.assert(
      fc.property(cents, currency, isoDay, (amount, c, date) => {
        expect(converter([])(amount, c, c, date)).toBe(amount);
      }),
    );
  });

  it('cannot convert between currencies without any rate', () => {
    expect(converter([])(100, 'USD', 'UYU', '2026-03-02')).toBeNull();
  });
});
