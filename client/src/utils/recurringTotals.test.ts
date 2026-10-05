import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { expectedNote, occurrenceTotals, type OccurrenceAmounts } from './recurringTotals';
import type { Currency } from '../types';

const occurrence = (o: Partial<OccurrenceAmounts>): OccurrenceAmounts => ({
  displayStatus: 'upcoming',
  expectedDate: '2026-03-20',
  expectedAmount: 0,
  matchedAmount: null,
  ...o,
});

// Rent in pesos ($ 300 = US$ 7.50 at 40); Netflix in dollars (US$ 15 = $ 600 at 40)
const rent = occurrence({
  expectedAmount: -30_000,
  currency: 'UYU',
  convertedExpectedAmount: -750,
});
const netflix = occurrence({
  expectedAmount: -1_500,
  currency: 'USD',
  convertedExpectedAmount: -60_000,
});

describe('occurrenceTotals', () => {
  it('adds dollar items to a pesos summary at their converted amount', () => {
    expect(occurrenceTotals([rent, netflix], 'UYU')).toEqual({
      total: 90_000,
      paid: 0,
      remaining: 90_000,
    });
  });

  it('gives the same summary in dollars', () => {
    expect(occurrenceTotals([rent, netflix], 'USD')).toEqual({
      total: 2_250,
      paid: 0,
      remaining: 2_250,
    });
  });

  it('counts a paid item at what was paid, converted at the day it was paid', () => {
    const paid = {
      ...netflix,
      displayStatus: 'paid' as const,
      matchedAmount: -1_600,
      convertedMatchedAmount: -65_600,
    };
    expect(occurrenceTotals([rent, paid], 'UYU')).toEqual({
      total: 95_600,
      paid: 65_600,
      remaining: 30_000,
    });
  });

  it('leaves out skipped and cancelled items, and ones that cannot be converted', () => {
    const noRate = { ...netflix, convertedExpectedAmount: null };
    const skipped = { ...rent, displayStatus: 'skipped' as const };
    const cancelled = { ...rent, displayStatus: 'cancelled' as const };
    expect(occurrenceTotals([rent, noRate, skipped, cancelled], 'UYU').total).toBe(30_000);
  });

  it('with pesos items only, is their plain sum whatever converted amounts came along', () => {
    const item = fc.record({
      displayStatus: fc.constantFrom('upcoming' as const, 'due' as const, 'paid' as const),
      expectedDate: fc.constant('2026-03-20'),
      expectedAmount: fc.integer({ min: -1e9, max: 1e9 }),
      matchedAmount: fc.option(fc.integer({ min: -1e9, max: 1e9 }), { nil: null }),
      currency: fc.constantFrom<Currency | undefined>('UYU', undefined),
      convertedExpectedAmount: fc.option(fc.integer(), { nil: null }),
      convertedMatchedAmount: fc.option(fc.integer(), { nil: null }),
    });
    fc.assert(
      fc.property(fc.array(item), (items) => {
        let paid = 0;
        let remaining = 0;
        for (const o of items) {
          if (o.displayStatus === 'paid') paid += Math.abs(o.matchedAmount ?? o.expectedAmount);
          else remaining += Math.abs(o.expectedAmount);
        }
        expect(occurrenceTotals(items, 'UYU')).toEqual({
          total: paid + remaining,
          paid,
          remaining,
        });
      }),
    );
  });
});

describe('expectedNote', () => {
  it("says what a dollar bill still to come is in pesos at today's rate", () => {
    expect(expectedNote(netflix, 'UYU', '2026-03-10')).toBe("$600 at today's exchange rate");
  });

  it('names the date for a bill already due', () => {
    expect(expectedNote(netflix, 'UYU', '2026-03-25')).toBe(
      '$600 at the exchange rate of Mar 20, 2026',
    );
  });

  it('has nothing to add for an item already in the currency, or one without a rate', () => {
    expect(expectedNote(rent, 'UYU', '2026-03-10')).toBeNull();
    expect(
      expectedNote({ ...netflix, convertedExpectedAmount: null }, 'UYU', '2026-03-10'),
    ).toBeNull();
  });
});
