import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Currency } from '../types';
import {
  accountGroupNames,
  groupTotal,
  listAccountsByGroup,
  toggleGroupOpen,
  type GroupableAccount,
} from './accountGroups';

const account = (
  id: string,
  groupName: string | null,
  balance = 0,
  currency: Currency = 'UYU',
): GroupableAccount => ({ id, groupName, balance, currency });

const anAccount = fc.record({
  id: fc.uuid(),
  groupName: fc.option(fc.constantFrom('Visa', 'Itaú', 'BROU'), { nil: null }),
  balance: fc.integer({ min: -10_000_000, max: 10_000_000 }),
  currency: fc.constantFrom<Currency>('UYU', 'USD'),
});
const accounts = fc.uniqueArray(anAccount, { selector: (a) => a.id, maxLength: 12 });

describe('listAccountsByGroup', () => {
  it('collapses a group into one entry where its first account was, ungrouped ones stay', () => {
    const list = [
      account('cash', null),
      account('visa-uyu', 'Visa'),
      account('savings', null),
      account('visa-usd', 'Visa'),
    ];
    expect(listAccountsByGroup(list)).toEqual([
      { kind: 'account', account: list[0] },
      { kind: 'group', name: 'Visa', accounts: [list[1], list[3]] },
      { kind: 'account', account: list[2] },
    ]);
  });

  it('a group with a single account is still a group', () => {
    const only = account('visa-uyu', 'Visa');
    expect(listAccountsByGroup([only])).toEqual([
      { kind: 'group', name: 'Visa', accounts: [only] },
    ]);
  });

  it('accounts written before groups existed (no group field) are ungrouped', () => {
    const old = { id: 'a', balance: 5, currency: 'UYU' as const };
    expect(listAccountsByGroup([old])).toEqual([{ kind: 'account', account: old }]);
  });

  it('shows every account exactly once, in its group or on its own', () => {
    fc.assert(
      fc.property(accounts, (list) => {
        const entries = listAccountsByGroup(list);
        const shown = entries.flatMap((e) => (e.kind === 'group' ? e.accounts : [e.account]));
        expect(shown.map((a) => a.id).sort()).toEqual(list.map((a) => a.id).sort());
        for (const entry of entries) {
          if (entry.kind === 'group') {
            expect(entry.accounts.length).toBeGreaterThan(0);
            expect(entry.accounts.every((a) => a.groupName === entry.name)).toBe(true);
          } else {
            expect(entry.account.groupName ?? null).toBeNull();
          }
        }
        const names = entries.flatMap((e) => (e.kind === 'group' ? [e.name] : []));
        expect(new Set(names).size).toBe(names.length);
      }),
    );
  });
});

describe('accountGroupNames', () => {
  it('lists each group in use once, in alphabetical order', () => {
    const list = [
      account('1', 'Visa'),
      account('2', null),
      account('3', 'brou'),
      account('4', 'Visa'),
      account('5', 'Itaú'),
    ];
    expect(accountGroupNames(list)).toEqual(['brou', 'Itaú', 'Visa']);
  });

  it('has no groups when no account names one', () => {
    expect(accountGroupNames([account('1', null), account('2', null)])).toEqual([]);
  });
});

describe('groupTotal', () => {
  it('adds dollar balances at the given rate to the pesos ones', () => {
    // US$100.00 at 40 pesos per dollar = $4,000.00, plus $1,500.00
    const list = [account('uyu', 'Visa', 150_000), account('usd', 'Visa', 10_000, 'USD')];
    expect(groupTotal(list, 40)).toEqual({ currency: 'UYU', total: 550_000, complete: true });
  });

  it('rounds a converted balance to whole cents, halves away from zero', () => {
    // One dollar cent at 40.5 is 40.5 peso cents → 41; at 0.5 it is half a cent → 1 (or -1)
    expect(groupTotal([account('a', 'G', 1, 'USD')], 40.5).total).toBe(41);
    expect(groupTotal([account('a', 'G', 1, 'USD')], 0.5).total).toBe(1);
    expect(groupTotal([account('a', 'G', -1, 'USD')], 0.5).total).toBe(-1);
  });

  it('with no rate it leaves dollar balances out and says the total is incomplete', () => {
    const list = [account('uyu', 'Visa', 150_000), account('usd', 'Visa', 10_000, 'USD')];
    expect(groupTotal(list, null)).toEqual({ currency: 'UYU', total: 150_000, complete: false });
  });

  it('a pesos-only group needs no rate', () => {
    expect(groupTotal([account('a', 'G', 100), account('b', 'G', -30)], null)).toEqual({
      currency: 'UYU',
      total: 70,
      complete: true,
    });
  });

  it('a debt converts to minus what the same credit converts to', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.double({ min: 0.001, max: 1000, noNaN: true }),
        (cents, rate) => {
          const credit = groupTotal([account('a', 'G', cents, 'USD')], rate).total;
          const debt = groupTotal([account('a', 'G', -cents, 'USD')], rate).total;
          expect(debt).toBe(credit === 0 ? 0 : -credit);
          expect(Number.isInteger(credit)).toBe(true);
        },
      ),
    );
  });
});

describe('toggleGroupOpen', () => {
  it('opens a closed group and closes an open one', () => {
    expect(toggleGroupOpen([], 'Visa')).toEqual(['Visa']);
    expect(toggleGroupOpen(['Visa', 'Itaú'], 'Visa')).toEqual(['Itaú']);
  });

  it('toggling twice leaves the same groups open', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom('Visa', 'Itaú', 'BROU')),
        fc.constantFrom('Visa', 'Itaú', 'BROU', 'Oca'),
        (open, name) => {
          const twice = toggleGroupOpen(toggleGroupOpen(open, name), name);
          expect([...twice].sort()).toEqual([...open].sort());
        },
      ),
    );
  });
});
