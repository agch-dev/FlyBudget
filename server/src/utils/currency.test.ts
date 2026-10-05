import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { impliedRate } from './currency.js';

const cents = fc.integer({ min: 1, max: 1e11 });
const sign = fc.constantFrom(1, -1);

describe('implied rate of two native amounts', () => {
  it('is pesos per dollar: $ 40,000 for US$ 1,000 is 40', () => {
    expect(
      impliedRate({ amount: -4_000_000, currency: 'UYU' }, { amount: 100_000, currency: 'USD' }),
    ).toBe(40);
    expect(
      impliedRate({ amount: -25_000, currency: 'USD' }, { amount: 1_003_125, currency: 'UYU' }),
    ).toBe(40.125);
  });

  it('does not depend on the order or the direction of the two sides', () => {
    fc.assert(
      fc.property(cents, cents, sign, sign, (pesos, dollars, s1, s2) => {
        const a = { amount: pesos * s1, currency: 'UYU' };
        const b = { amount: dollars * s2, currency: 'USD' };
        const rate = impliedRate(a, b)!;
        expect(rate).toBeGreaterThan(0);
        expect(impliedRate(b, a)).toBe(rate);
        // More pesos for the same dollars is a higher rate
        expect(impliedRate({ ...a, amount: a.amount * 2 }, b)).toBeGreaterThan(rate);
      }),
    );
  });

  it('is nothing between amounts of the same currency, or when a side is zero', () => {
    fc.assert(
      fc.property(cents, cents, fc.constantFrom('UYU', 'USD'), (x, y, currency) => {
        expect(impliedRate({ amount: x, currency }, { amount: -y, currency })).toBeNull();
      }),
    );
    expect(impliedRate({ amount: 0, currency: 'UYU' }, { amount: 5, currency: 'USD' })).toBeNull();
    expect(impliedRate({ amount: 5, currency: 'UYU' }, { amount: 0, currency: 'USD' })).toBeNull();
  });
});
