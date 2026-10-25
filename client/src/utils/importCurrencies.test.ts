import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  currencyContext,
  currencyMapping,
  currencyValues,
  findCurrencyColumn,
  markCurrencyColumn,
  followUpAccounts,
} from './importCurrencies';
import type { ColumnRole } from './csv';

const EN = ['en'];

describe('findCurrencyColumn', () => {
  const roles: ColumnRole[] = ['date', 'payee', 'amount', 'skip', 'skip'];

  it('finds a column by its header, even with values FlyBudget can’t read', () => {
    const rows = [
      ['28/09/2026', 'Shop', '10', 'Pesos', 'Otros'],
      ['29/09/2026', 'Apple', '3', 'Dolares', 'Otros'],
    ];
    expect(
      findCurrencyColumn(['Fecha', 'Concepto', 'Importe', 'Moneda', 'Categoría'], rows, roles, EN),
    ).toBe(3);
    expect(
      findCurrencyColumn(['Date', 'Payee', 'Amount', 'Currency', 'Category'], rows, roles, EN),
    ).toBe(3);
  });

  it('finds a column by its values when every one names a currency', () => {
    const rows = [
      ['2026-09-05', 'Hotel', '-120', 'Groceries', 'EUR'],
      ['2026-09-06', 'Taxi', '-18', 'Travel', 'usd'],
      ['2026-09-07', 'Fee', '-1', 'Travel', ''],
    ];
    expect(
      findCurrencyColumn(['Date', 'Description', 'Amount', 'Type', 'Ccy x'], rows, roles, EN),
    ).toBe(4);
  });

  it('is not a currency column when every cell is blank, or it already has a role', () => {
    const rows = [['2026-09-05', 'Hotel', '-120', '', 'x']];
    expect(
      findCurrencyColumn(['Date', 'Payee', 'Amount', 'Currency', 'Notes'], rows, roles, EN),
    ).toBe(-1);
    expect(
      findCurrencyColumn(
        ['Date', 'Currency', 'Amount'],
        [['2026-09-05', 'EUR', '1']],
        ['date', 'payee', 'amount'],
        EN,
      ),
    ).toBe(-1);
  });

  it('needs a header or values that say so', () => {
    const rows = [['2026-09-05', 'Hotel', '-120', 'Travel', 'Paris']];
    expect(findCurrencyColumn(['Date', 'Payee', 'Amount', 'Type', 'City'], rows, roles, EN)).toBe(
      -1,
    );
  });
});

describe('markCurrencyColumn', () => {
  const headers = ['Date', 'Amount', 'Moneda', 'Kind'];
  const rows = [['2026-09-05', '1', 'Pesos', 'USD']];
  const roles: ColumnRole[] = ['date', 'amount', 'skip', 'skip'];

  it('marks the column saved for this account, else the one it finds', () => {
    expect(markCurrencyColumn(headers, rows, roles, 'Kind', EN)).toEqual([
      'date',
      'amount',
      'skip',
      'currency',
    ]);
    expect(markCurrencyColumn(headers, rows, roles, undefined, EN)).toEqual([
      'date',
      'amount',
      'currency',
      'skip',
    ]);
    // A saved column this file doesn't have: found again
    expect(markCurrencyColumn(headers, rows, roles, 'Moneda#2', EN)[2]).toBe('currency');
  });

  it('never takes a column mapped to something else', () => {
    const taken: ColumnRole[] = ['date', 'amount', 'payee', 'notes'];
    expect(markCurrencyColumn(headers, rows, taken, 'Kind', EN)).toEqual(taken);
  });
});

describe('currencyValues', () => {
  it('lists each value once, however it is written, with its rows', () => {
    const rows = [['Pesos'], ['Dolares'], ['PESOS.'], [''], ['pesos']];
    expect(currencyValues(rows, 0)).toEqual([
      { key: 'pesos', text: 'Pesos', count: 3 },
      { key: 'dolares', text: 'Dolares', count: 1 },
    ]);
  });
});

describe('currencyMapping', () => {
  const values = [
    { key: 'pesos', text: 'Pesos', count: 3 },
    { key: 'dolares', text: 'Dolares', count: 1 },
    { key: 'usd', text: 'USD', count: 1 },
  ];

  it('guesses what it can and leaves the rest to the user', () => {
    expect(currencyMapping(values, { context: ['UYU', 'USD'], locales: EN })).toEqual({
      pesos: 'UYU',
      dolares: null,
      usd: 'USD',
    });
  });

  it("prefers what the user chose now, then what they chose for this account's last file", () => {
    expect(
      currencyMapping(values, {
        context: ['UYU'],
        saved: { DOLARES: 'USD', Pesos: 'ARS' },
        chosen: { pesos: 'UYU' },
        locales: EN,
      }),
    ).toEqual({ pesos: 'UYU', dolares: 'USD', usd: 'USD' });
  });

  it('never keeps a saved value that is not a currency', () => {
    expect(
      currencyMapping(values, { context: [], saved: { Dolares: 'XXX' }, locales: EN }).dolares,
    ).toBeNull();
  });
});

type A = { id: string; type: string; currency: string | null; closedAt: string | null };
const acct = (
  id: string,
  type: string,
  currency: string | null,
  closedAt: string | null = null,
): A => ({
  id,
  type,
  currency,
  closedAt,
});

describe('currencyContext', () => {
  it("is the account's currency and its Account Section's", () => {
    const accounts = [
      acct('a', 'credit', 'UYU'),
      acct('b', 'credit', 'USD'),
      acct('c', 'checking', 'EUR'),
    ];
    const sections = { a: 'Visa', b: 'visa', c: 'Bank' };
    expect(currencyContext('a', accounts, sections).sort()).toEqual(['USD', 'UYU']);
    expect(currencyContext('c', accounts, {})).toEqual(['EUR']);
  });
});

describe('followUpAccounts', () => {
  const accounts = [
    acct('pesos', 'credit', 'UYU'),
    acct('dollars', 'credit', 'USD'),
    acct('savings', 'savings', 'USD'),
    acct('old', 'credit', 'USD', '2026-01-01'),
  ];

  it('offers the open accounts in that currency, defaulting to the card’s other side', () => {
    const found = followUpAccounts('pesos', accounts, 'USD', { pesos: 'Visa', dollars: 'Visa' });
    expect(found.options.map((a) => a.id)).toEqual(['dollars', 'savings']);
    expect(found.defaultId).toBe('dollars');
  });

  it('starts empty unless exactly one account fits', () => {
    // No section
    expect(followUpAccounts('pesos', accounts, 'USD', {}).defaultId).toBeNull();
    // Another type in the section
    expect(
      followUpAccounts('pesos', accounts, 'USD', { pesos: 'Bank', savings: 'Bank' }).defaultId,
    ).toBeNull();
    // Two that fit
    const two = [...accounts, acct('dollars2', 'credit', 'USD')];
    expect(
      followUpAccounts('pesos', two, 'USD', { pesos: 'V', dollars: 'V', dollars2: 'V' }).defaultId,
    ).toBeNull();
  });

  it('only ever offers or picks an open account in that currency, never the same one', () => {
    const account = fc.record({
      id: fc.constantFrom('a', 'b', 'c', 'd'),
      type: fc.constantFrom('credit', 'checking'),
      currency: fc.constantFrom('UYU', 'USD', null),
      closedAt: fc.constantFrom(null, '2026-01-01'),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(account, { selector: (a) => a.id }),
        fc.dictionary(fc.constantFrom('a', 'b', 'c', 'd'), fc.constantFrom('S', 's', 'T')),
        (list, sections) => {
          const found = followUpAccounts('a', list, 'USD', sections);
          for (const a of found.options) {
            expect(a).toMatchObject({ currency: 'USD', closedAt: null });
            expect(a.id).not.toBe('a');
          }
          if (found.defaultId) expect(found.options.map((a) => a.id)).toContain(found.defaultId);
        },
      ),
    );
  });
});
