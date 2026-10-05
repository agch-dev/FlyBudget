import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_GROUPS } from '../types';
import {
  accountTypeGroupLabel,
  accountTypeHint,
  accountTypeInfo,
  accountTypeLabel,
} from './accountTypes';

describe('account type names', () => {
  it('are written in the App Language', () => {
    expect(accountTypeLabel('checking')).toBe('Checking');
    expect(accountTypeLabel('credit')).toBe('Credit Card');
    expect(accountTypeLabel('real_estate')).toBe('Real Estate');
    setLanguage('es');
    expect(accountTypeLabel('checking')).toBe('Cuenta corriente');
    expect(accountTypeLabel('credit')).toBe('Tarjeta de crédito');
    expect(accountTypeLabel('real_estate')).toBe('Inmueble');
  });

  it('show a type this version does not know as it is stored', () => {
    expect(accountTypeLabel('spaceship')).toBe('spaceship');
    setLanguage('es');
    expect(accountTypeLabel('spaceship')).toBe('spaceship');
    // ...while it is counted as an other asset
    expect(accountTypeInfo('spaceship').value).toBe('other_asset');
  });

  it('come with an example under the type picker', () => {
    expect(accountTypeHint('cash')).toBe('Wallet or petty cash');
    setLanguage('es');
    expect(accountTypeHint('cash')).toBe('Billetera o caja chica');
  });

  it('name the six groups of account types', () => {
    expect(ACCOUNT_TYPE_GROUPS.map(accountTypeGroupLabel)).toEqual([
      'Cash',
      'Credit',
      'Investments',
      'Property',
      'Loans',
      'Other',
    ]);
    setLanguage('es');
    expect(ACCOUNT_TYPE_GROUPS.map(accountTypeGroupLabel)).toEqual([
      'Efectivo y bancos',
      'Crédito',
      'Inversiones',
      'Bienes',
      'Préstamos',
      'Otros',
    ]);
  });

  it('have a Spanish name and example for every type', () => {
    const english = ACCOUNT_TYPES.map((t) => accountTypeHint(t.value));
    setLanguage('es');
    const spanish = ACCOUNT_TYPES.map((t) => [accountTypeLabel(t.value), accountTypeHint(t.value)]);
    for (const [i, [label, hint]] of spanish.entries()) {
      expect(label).not.toBe(ACCOUNT_TYPES[i].value);
      expect(hint).not.toBe(english[i]);
    }
    expect(new Set(spanish.map(([label]) => label)).size).toBe(ACCOUNT_TYPES.length);
  });
});
