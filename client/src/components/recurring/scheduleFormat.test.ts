import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatScheduleAmount } from './scheduleFormat';
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
