import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { amountIn, convertedNote, listTotal, totalIn } from './conversion';
import type { Currency } from '../types';

const groceries = { amount: -5_000, currency: 'USD' as const, convertedAmount: -200_000 };
const rent = { amount: -30_000, currency: 'UYU' as const, convertedAmount: -750 };

const item = fc.record({
  amount: fc.integer({ min: -1e9, max: 1e9 }),
  currency: fc.constantFrom<Currency | undefined>('UYU', 'USD', undefined),
  convertedAmount: fc.option(fc.integer({ min: -1e11, max: 1e11 }), { nil: null }),
});

describe('amountIn', () => {
  it('is the native amount in its own currency and the converted amount in the other', () => {
    expect(amountIn(groceries, 'USD')).toBe(-5_000);
    expect(amountIn(groceries, 'UYU')).toBe(-200_000);
    expect(amountIn(rent, 'UYU')).toBe(-30_000);
    expect(amountIn(rent, 'USD')).toBe(-750);
  });

  it('treats something with no currency as pesos', () => {
    expect(amountIn({ amount: 12 }, 'UYU')).toBe(12);
  });

  it('has no answer when the server sent no converted amount', () => {
    expect(amountIn({ amount: 100, currency: 'USD', convertedAmount: null }, 'UYU')).toBeNull();
    expect(amountIn({ amount: 100, currency: 'USD' }, 'UYU')).toBeNull();
  });
});

describe('totalIn', () => {
  it('adds native and converted amounts into one currency', () => {
    expect(totalIn([groceries, rent], 'UYU')).toBe(-230_000);
    expect(totalIn([groceries, rent], 'USD')).toBe(-5_750);
    expect(totalIn([], 'UYU')).toBe(0);
  });

  it('leaves out what cannot be converted', () => {
    expect(totalIn([rent, { amount: 100, currency: 'USD', convertedAmount: null }], 'UYU')).toBe(
      -30_000,
    );
  });

  it('is the plain sum for items already in that currency, whatever their converted amount', () => {
    fc.assert(
      fc.property(fc.array(item), (items) => {
        const pesos = items.map((i) => ({ ...i, currency: 'UYU' as const }));
        expect(totalIn(pesos, 'UYU')).toBe(pesos.reduce((sum, i) => sum + i.amount, 0));
      }),
    );
  });
});

describe('convertedNote', () => {
  it('says what the amount is in the currency of the total it feeds', () => {
    expect(convertedNote({ ...groceries, date: '2026-03-03' }, 'UYU')).toBe(
      '$2,000 at the exchange rate of Mar 3, 2026',
    );
    expect(convertedNote({ ...rent, date: '2026-03-10' }, 'USD')).toBe(
      'US$7.50 at the exchange rate of Mar 10, 2026',
    );
  });

  it('says nothing when the amount is already in that currency, or cannot be converted', () => {
    expect(convertedNote({ ...groceries, date: '2026-03-03' }, 'USD')).toBeNull();
    expect(convertedNote({ ...rent, date: '2026-03-10' }, 'UYU')).toBeNull();
    expect(
      convertedNote(
        { amount: 5, currency: 'USD', convertedAmount: null, date: '2026-03-10' },
        'UYU',
      ),
    ).toBeNull();
  });
});

describe('listTotal', () => {
  it('a list in one currency is totalled in that currency, untouched by rates', () => {
    expect(listTotal([groceries, { ...groceries, amount: -250 }], (n) => n)).toEqual({
      currency: 'USD',
      total: -5_250,
    });
    expect(listTotal([rent, { amount: 2_000 }], (n) => n)).toEqual({
      currency: 'UYU',
      total: -28_000,
    });
    expect(listTotal([], (n) => n)).toEqual({ currency: 'UYU', total: 0 });
  });

  it('a list that mixes currencies is totalled in pesos, dollars converted', () => {
    expect(listTotal([groceries, rent], (n) => n)).toEqual({ currency: 'UYU', total: -230_000 });
    expect(listTotal([groceries, rent], Math.abs)).toEqual({ currency: 'UYU', total: 230_000 });
  });
});
