import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  byNearestDate,
  daysApart,
  isTransferCandidate,
  linkRefusal,
  type LinkSide,
} from './transferLink.js';

const side = fc.record<LinkSide>({
  id: fc.constantFrom('a', 'b', 'c'),
  accountId: fc.constantFrom('one', 'two'),
  date: fc.integer({ min: 1, max: 28 }).map((d) => `2025-03-${String(d).padStart(2, '0')}`),
  amount: fc.constantFrom(-5000, -4000, 0, 4000, 5000),
  currency: fc.constantFrom('UYU', 'USD'),
  reconciled: fc.constantFrom(0, 0, 1),
  isParent: fc.constantFrom(0, 0, 1),
  parentTransactionId: fc.constantFrom(null, null, 'p'),
  transferTransactionId: fc.constantFrom(null, null, 't'),
});

describe('linking rules', () => {
  it('do not depend on which side is named first', () => {
    fc.assert(
      fc.property(side, side, (a, b) => {
        expect(linkRefusal(a, b) === null).toBe(linkRefusal(b, a) === null);
        expect(isTransferCandidate(a, b)).toBe(isTransferCandidate(b, a));
      }),
    );
  });

  it('accept a pair only when it is a clean outflow and inflow in two accounts', () => {
    fc.assert(
      fc.property(side, side, (a, b) => {
        if (linkRefusal(a, b) !== null) return;
        for (const t of [a, b]) {
          expect(t.reconciled).toBe(0);
          expect(t.isParent).toBe(0);
          expect(t.parentTransactionId).toBeNull();
          expect(t.transferTransactionId).toBeNull();
        }
        expect(a.accountId).not.toBe(b.accountId);
        expect(a.amount * b.amount).toBeLessThan(0);
        if (a.currency === b.currency) expect(a.amount + b.amount).toBe(0);
      }),
    );
  });

  it('refuse a candidate only because same-currency amounts differ', () => {
    fc.assert(
      fc.property(side, side, (a, b) => {
        if (linkRefusal(a, b) === null) expect(isTransferCandidate(a, b)).toBe(true);
        if (isTransferCandidate(a, b) && linkRefusal(a, b) !== null) {
          expect(a.currency).toBe(b.currency);
          expect(a.amount).not.toBe(-b.amount);
        }
      }),
    );
  });

  it('sort candidates nearest in date first', () => {
    expect(daysApart('2025-03-01', '2025-02-27')).toBe(2);
    fc.assert(
      fc.property(fc.array(side), side, (list, of) => {
        const gaps = [...list].sort(byNearestDate(of.date)).map((t) => daysApart(t.date, of.date));
        expect(gaps).toEqual([...gaps].sort((x, y) => x - y));
      }),
    );
  });
});
