import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { TransferSuggestion } from '../api/transferSuggestions';
import { setLanguage } from '../i18n';
import { suggestionCountLabel, suggestionsForAccount } from './transferSuggestions';

const account = fc.constantFrom('checking', 'savings', 'dollars', 'card');
const suggestion = fc
  .tuple(account, account, fc.nat())
  .map(([from, to, n]): TransferSuggestion => ({
    outflow: {
      id: `out${n}`,
      accountId: from,
      date: '2025-03-10',
      amount: -5000,
      currency: 'UYU',
      payeeName: null,
    },
    inflow: {
      id: `in${n}`,
      accountId: to,
      date: '2025-03-11',
      amount: 5000,
      currency: 'UYU',
      payeeName: null,
    },
    rate: null,
  }));

describe('suggestionsForAccount', () => {
  it('keeps every suggestion when no account is given', () => {
    fc.assert(
      fc.property(fc.array(suggestion), (list) => {
        expect(suggestionsForAccount(list)).toEqual(list);
      }),
    );
  });

  it('keeps, in order, exactly the suggestions with a side in the account', () => {
    fc.assert(
      fc.property(fc.array(suggestion), account, (list, accountId) => {
        const shown = suggestionsForAccount(list, accountId);
        for (const s of shown) {
          expect([s.outflow.accountId, s.inflow.accountId]).toContain(accountId);
        }
        const hidden = list.filter((s) => !shown.includes(s));
        for (const s of hidden) {
          expect([s.outflow.accountId, s.inflow.accountId]).not.toContain(accountId);
        }
        expect(shown).toEqual(list.filter((s) => shown.includes(s)));
      }),
    );
  });
});

describe('suggestionCountLabel', () => {
  it('counts in the singular and the plural', () => {
    expect(suggestionCountLabel(1)).toBe('1 possible transfer');
    expect(suggestionCountLabel(3)).toBe('3 possible transfers');
  });

  it('counts in Spanish', () => {
    setLanguage('es');
    expect(suggestionCountLabel(1)).toBe('1 posible transferencia');
    expect(suggestionCountLabel(3)).toBe('3 posibles transferencias');
  });
});
