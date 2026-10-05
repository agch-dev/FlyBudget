import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formCurrency, goalsSummary, progressOf, targetNeedsConfirming } from './goals';
import type { Currency } from '../types';

const house = {
  currency: 'USD' as const,
  targetAmount: 100_000,
  currentAmount: 25_050,
  inPesos: { target: 4_050_000, saved: 1_014_525, remaining: 3_035_475 },
};
const trip = {
  currency: 'UYU' as const,
  targetAmount: 500_000,
  currentAmount: 120_000,
  inPesos: { target: 500_000, saved: 120_000, remaining: 380_000 },
};
const accounts = [
  { id: 'caja', currency: 'UYU' as const },
  { id: 'dolares', currency: 'USD' as const },
];

describe('progressOf', () => {
  it("is in the goal's own currency", () => {
    expect(progressOf(house)).toEqual({ pct: 25.05, remaining: 74_950 });
  });

  it('never leaves a negative amount or goes past 100%', () => {
    expect(progressOf({ targetAmount: 100, currentAmount: 250 })).toEqual({
      pct: 100,
      remaining: 0,
    });
  });
});

describe('goalsSummary', () => {
  it('adds every goal up in pesos', () => {
    expect(goalsSummary([house, trip])).toEqual({
      saved: 1_134_525,
      target: 4_550_000,
      leftToSave: 3_415_475,
      percent: 24,
      notCounted: 0,
    });
  });

  it('leaves out a dollar goal that could not be converted, and says how many', () => {
    expect(goalsSummary([{ ...house, inPesos: null }, trip])).toEqual({
      saved: 120_000,
      target: 500_000,
      leftToSave: 380_000,
      percent: 24,
      notCounted: 1,
    });
  });

  it('counts a pesos goal that came without converted amounts as it is', () => {
    const { inPesos: _, ...saved } = trip;
    expect(goalsSummary([saved, { ...saved, currency: undefined }]).saved).toBe(240_000);
  });

  it('is empty for no goals', () => {
    expect(goalsSummary([])).toEqual({
      saved: 0,
      target: 0,
      leftToSave: 0,
      percent: 0,
      notCounted: 0,
    });
  });

  it('does not depend on the order of the goals (property-based)', () => {
    const goal = fc.record({
      currency: fc.constantFrom<Currency>('UYU', 'USD'),
      targetAmount: fc.integer({ min: 0, max: 1e9 }),
      currentAmount: fc.integer({ min: 0, max: 1e9 }),
      inPesos: fc.option(
        fc.record({
          target: fc.integer({ min: 0, max: 1e11 }),
          saved: fc.integer({ min: 0, max: 1e11 }),
          remaining: fc.integer({ min: 0, max: 1e11 }),
        }),
        { nil: null },
      ),
    });
    fc.assert(
      fc.property(fc.array(goal), (goals) => {
        const summary = goalsSummary(goals);
        expect(goalsSummary([...goals].reverse())).toEqual(summary);
        expect(summary.notCounted).toBeLessThanOrEqual(goals.length);
        expect(summary.percent).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('formCurrency', () => {
  it('lets the user choose when no account is linked', () => {
    expect(formCurrency('', accounts, 'USD')).toEqual({ currency: 'USD', locked: false });
    expect(formCurrency('', accounts, 'UYU')).toEqual({ currency: 'UYU', locked: false });
  });

  it("is the linked account's currency, locked, whatever was chosen", () => {
    expect(formCurrency('dolares', accounts, 'UYU')).toEqual({ currency: 'USD', locked: true });
    expect(formCurrency('caja', accounts, 'USD')).toEqual({ currency: 'UYU', locked: true });
  });

  it('keeps the chosen currency for an account that is not in the list', () => {
    expect(formCurrency('closed', accounts, 'USD')).toEqual({ currency: 'USD', locked: true });
  });
});

describe('targetNeedsConfirming', () => {
  const goal = { currency: 'UYU' as const, accountId: 'caja' };

  it('asks when the linked account changes the currency of an existing goal', () => {
    expect(targetNeedsConfirming(goal, { accountId: 'dolares', currency: 'USD' })).toBe(true);
    expect(
      targetNeedsConfirming(
        { currency: 'USD', accountId: null },
        { accountId: 'caja', currency: 'UYU' },
      ),
    ).toBe(true);
  });

  it('does not ask when the currency stays the same', () => {
    expect(targetNeedsConfirming(goal, { accountId: 'other', currency: 'UYU' })).toBe(false);
    expect(targetNeedsConfirming(goal, { accountId: '', currency: 'UYU' })).toBe(false);
  });

  it('does not ask for a new goal, or when the user picked the currency by hand', () => {
    expect(targetNeedsConfirming(null, { accountId: 'dolares', currency: 'USD' })).toBe(false);
    expect(
      targetNeedsConfirming(
        { currency: 'UYU', accountId: null },
        { accountId: '', currency: 'USD' },
      ),
    ).toBe(false);
  });
});
