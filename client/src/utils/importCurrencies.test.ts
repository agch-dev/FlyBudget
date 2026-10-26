import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  amountColumnCurrencies,
  columnCurrenciesByKey,
  currencyContext,
  currencyMapping,
  currencyValues,
  findCurrencyColumn,
  headerCurrencies,
  markCurrencyColumn,
  markCurrencyColumns,
  followUpAccounts,
} from './importCurrencies';
import type { ColumnRole } from './csv';
import { CURRENCY_CODES } from './currencies';
import type { ImportAccount } from './importCurrencies';
import type { AccountType } from '../types';

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

  it('without a header, only takes values written as codes, symbols or whole names', () => {
    // Words that are also part of currency names ("New Zealand Dollar", "Central African…")
    const rows = [
      ['2026-09-05', 'Hotel', '-120', 'New', 'Pesos'],
      ['2026-09-06', 'Taxi', '-18', 'Central', 'Pesos'],
    ];
    expect(findCurrencyColumn(['Date', 'Payee', 'Amount', 'Status', 'Kind'], rows, roles, EN)).toBe(
      -1,
    );
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

describe('headerCurrencies', () => {
  const ES = ['en', 'es'];

  it('reads a currency word, alone or with an amount word', () => {
    expect(headerCurrencies('Amount (EUR)', EN)).toEqual(['EUR']);
    expect(headerCurrencies('Importe US$', EN)).toEqual(['USD']);
    expect(headerCurrencies('Imp. U$S', EN)).toEqual(['USD']);
    expect(headerCurrencies('USD', EN)).toEqual(['USD']);
    expect(headerCurrencies('Pesos', EN)).toContain('UYU');
    expect(headerCurrencies('Pesos', EN)).toContain('ARS');
    // Spanish names on a Spanish-speaking device
    expect(headerCurrencies('Dólares', ES)).toContain('USD');
    expect(headerCurrencies('Dólares', EN)).toEqual([]);
  });

  it('reads every currency code back, however the header puts it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CURRENCY_CODES),
        fc.constantFrom('Amount (%)', 'Importe %', '% amount', '%', 'imp. %', 'Betrag in %'),
        (code, shape) => {
          const header = shape.replace('%', code);
          const read = headerCurrencies(header, EN);
          // "in" is no amount word: that header isn't one
          expect(read).toEqual(shape.includes(' in ') ? [] : [code]);
        },
      ),
    );
  });

  it('needs the header to be only that', () => {
    for (const header of [
      'Amount',
      'Importe original',
      'Saldo US$',
      'Balance (EUR)',
      'Fecha',
      'Descripción',
      'Currency',
      'Moneda',
      'Amount in USD paid',
      '',
    ]) {
      expect(headerCurrencies(header, ES), header).toEqual([]);
    }
  });
});

describe('markCurrencyColumns', () => {
  const headers = ['Fecha', 'Descripción', 'Importe original', 'Pesos', 'Dólares', 'Moneda'];
  const rows = [
    ['04/09/2026', 'Streaming', '0,00', '0,00', '9,99', 'USD'],
    ['19/09/2026', 'Super', '0,00', '1.343,28', '', 'UYU'],
  ];
  const roles: ColumnRole[] = ['date', 'payee', 'skip', 'skip', 'skip', 'skip'];
  const ES = ['en', 'es'];

  it('makes the columns named after a currency amounts, and leaves the currency column out', () => {
    expect(markCurrencyColumns(headers, rows, roles, null, ES)).toEqual([
      'date',
      'payee',
      'skip',
      'amount',
      'amount',
      'skip',
    ]);
    // In English, "Dólares" is the user's to map: until then the currency column stays
    expect(markCurrencyColumns(headers, rows, roles, null, EN)).toEqual([
      'date',
      'payee',
      'skip',
      'amount',
      'skip',
      'currency',
    ]);
  });

  it('keeps a currency column next to a lone column named after a currency (only a check)', () => {
    const lone = ['Date', 'Payee', 'Amount (USD)', 'x', 'y', 'Moneda'];
    expect(markCurrencyColumns(lone, rows, roles, null, EN)).toEqual([
      'date',
      'payee',
      'amount',
      'skip',
      'skip',
      'currency',
    ]);
  });

  it('finds the currency column when no column is named after a currency', () => {
    const plain = ['Fecha', 'Descripción', 'Importe original', 'Importe', 'Otro', 'Moneda'];
    expect(markCurrencyColumns(plain, rows, roles, null, ES)[5]).toBe('currency');
  });

  it('only takes columns of amounts that the saved settings left alone', () => {
    const words = [['2026-09-04', 'x', '', 'many', '', '']];
    expect(markCurrencyColumns(headers, words, roles, null, ES)[3]).toBe('skip');
    const saved = { columns: { Pesos: 'skip' as const }, columnCurrencies: {} };
    expect(markCurrencyColumns(headers, rows, roles, saved, ES)[3]).toBe('skip');
  });
});

describe('amountColumnCurrencies', () => {
  const headers = ['Fecha', 'Pesos', 'Dólares', 'Importe'];
  const roles: ColumnRole[] = ['date', 'amount', 'amount', 'skip'];

  it("reads each amount column's currency, settling shared words by the accounts around", () => {
    expect(
      amountColumnCurrencies(headers, roles, { context: ['UYU', 'USD'], locales: ['en', 'es'] }),
    ).toEqual({ 1: 'UYU', 2: 'USD' });
    // In English "Dólares" isn't read, and with no peso around neither is "Pesos"
    expect(amountColumnCurrencies(headers, roles, { context: ['EUR'], locales: EN })).toEqual({
      1: null,
      2: null,
    });
  });

  it('prefers what the user chose now, then what was saved for that column', () => {
    expect(
      amountColumnCurrencies(headers, roles, {
        context: ['UYU'],
        saved: { Pesos: 'ARS', Dólares: 'USD' },
        chosen: { Pesos: 'UYU' },
        locales: EN,
      }),
    ).toEqual({ 1: 'UYU', 2: 'USD' });
    // A saved value that isn't a currency is not kept
    expect(
      amountColumnCurrencies(headers, roles, {
        context: [],
        saved: { Dólares: 'XXX' },
        locales: EN,
      }),
    ).toEqual({ 1: null, 2: null });
  });

  it('asks for every amount column once one is named after a currency', () => {
    const plainToo: ColumnRole[] = ['date', 'amount', 'skip', 'amount'];
    expect(amountColumnCurrencies(headers, plainToo, { context: ['UYU'], locales: EN })).toEqual({
      1: 'UYU',
      3: null,
    });
  });

  it('leaves a lone named column to a currency column', () => {
    const lone = ['Date', 'Amount (USD)', 'Moneda'];
    expect(
      amountColumnCurrencies(lone, ['date', 'amount', 'currency'], { context: [], locales: EN }),
    ).toBeNull();
    expect(
      amountColumnCurrencies(lone, ['date', 'amount', 'skip'], { context: [], locales: EN }),
    ).toEqual({ 1: 'USD' });
  });

  it('keys the known currencies by column, as they are saved', () => {
    expect(columnCurrenciesByKey(['Pesos', 'Fecha', 'Pesos'], { 0: 'UYU', 2: null })).toEqual({
      Pesos: 'UYU',
    });
  });

  it('is null for a file whose amount columns name no currency', () => {
    const plain = ['Date', 'Amount', 'Inflow'];
    expect(
      amountColumnCurrencies(plain, ['date', 'amount', 'inflow'], {
        context: ['UYU'],
        locales: EN,
      }),
    ).toBeNull();
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

type A = ImportAccount;
const acct = (
  id: string,
  type: AccountType,
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
      type: fc.constantFrom<AccountType>('credit', 'checking'),
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
