import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { amountNeedsConfirming, formatScheduleAmount } from './scheduleFormat';
import { formatCurrency } from '../../utils/currency';

const arbAmount = fc.integer({ min: -1_000_000_00, max: 1_000_000_00 });
const arbAmountType = fc.constantFrom('exact', 'approximate', 'variable');

describe("a recurring item's amount", () => {
  it("is written in its account's currency", () => {
    expect(formatScheduleAmount(-15_99, 'exact', 'USD')).toBe('US$15.99');
    expect(formatScheduleAmount(-15_99, 'exact', 'UYU')).toBe('$15.99');
    expect(formatScheduleAmount(1_200_00, 'approximate', 'USD')).toBe('~+US$1,200');
    expect(formatScheduleAmount(-2_500_00, 'variable', 'UYU')).toBe('~$2,500');
  });

  it('counts as pesos when no currency is known', () => {
    fc.assert(
      fc.property(arbAmount, arbAmountType, (amount, type) => {
        expect(formatScheduleAmount(amount, type)).toBe(formatScheduleAmount(amount, type, 'UYU'));
      }),
    );
  });

  it('differs between currencies only by the sign: dollars read US$ where pesos read $', () => {
    fc.assert(
      fc.property(arbAmount, arbAmountType, (amount, type) => {
        const pesos = formatScheduleAmount(amount, type, 'UYU');
        const dollars = formatScheduleAmount(amount, type, 'USD');
        expect(dollars).toBe(pesos.replace('$', 'US$'));
        expect(dollars).toContain(formatCurrency(Math.abs(amount), 'USD'));
      }),
    );
  });
});

describe('moving a recurring item to another account', () => {
  const arbCurrency = fc.constantFrom('UYU' as const, 'USD' as const, undefined);

  it('asks to confirm the amount when the account is in the other currency', () => {
    expect(amountNeedsConfirming({ currency: 'USD' }, 'UYU')).toBe(true);
    expect(amountNeedsConfirming({ currency: 'UYU' }, 'USD')).toBe(true);
    // No account, or an item from before currencies existed, counts as pesos
    expect(amountNeedsConfirming({ currency: 'USD' }, undefined)).toBe(true);
    expect(amountNeedsConfirming({}, 'USD')).toBe(true);
    expect(amountNeedsConfirming({}, undefined)).toBe(false);
  });

  it('asks exactly when the same number would mean a different sum of money', () => {
    fc.assert(
      fc.property(arbCurrency, arbCurrency, (was, now) => {
        expect(amountNeedsConfirming({ currency: was }, now)).toBe(
          (was ?? 'UYU') !== (now ?? 'UYU'),
        );
      }),
    );
  });

  it('never asks about a new item: its amount was typed in the currency shown', () => {
    fc.assert(
      fc.property(arbCurrency, (now) => {
        expect(amountNeedsConfirming(null, now)).toBe(false);
        expect(amountNeedsConfirming(undefined, now)).toBe(false);
      }),
    );
  });
});
