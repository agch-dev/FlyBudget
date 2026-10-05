import { describe, expect, it } from 'vitest';
import { format, formatDistance } from 'date-fns';
import { currentLanguage, setLanguage, t } from './index';
import { formatCurrency } from '../utils/currency';

describe('the App Language', () => {
  it('is English until something sets it', () => {
    expect(currentLanguage()).toBe('en');
    expect(t('nav.accounts')).toBe('Accounts');
  });

  it('switches every text at once, and back', () => {
    setLanguage('es');
    expect(currentLanguage()).toBe('es');
    expect(t('nav.accounts')).toBe('Cuentas');
    expect(t('auth:signIn')).toBe('Iniciar sesión');
    setLanguage('en');
    expect(t('nav.accounts')).toBe('Accounts');
    expect(t('auth:signIn')).toBe('Sign in');
  });

  it('names months and weekdays in the language', () => {
    const monday = new Date(2026, 9, 5);
    expect(format(monday, 'EEEE d MMMM yyyy')).toBe('Monday 5 October 2026');
    setLanguage('es');
    expect(format(monday, 'EEEE d MMMM yyyy')).toBe('lunes 5 octubre 2026');
    expect(format(monday, 'd MMM yyyy')).toBe('5 oct 2026');
    expect(formatDistance(new Date(2026, 9, 5, 12, 0), new Date(2026, 9, 5, 12, 5))).toBe(
      '5 minutos',
    );
  });

  it('keeps weeks starting on Sunday in both languages', () => {
    const wednesday = new Date(2026, 9, 7);
    expect(format(wednesday, 'e')).toBe('4');
    setLanguage('es');
    expect(format(wednesday, 'e')).toBe('4');
  });

  it('writes amounts the same in both languages', () => {
    const english = [formatCurrency(123456, 'UYU'), formatCurrency(-123456, 'USD')];
    expect(english).toEqual(['$1,234.56', '-US$1,234.56']);
    setLanguage('es');
    expect([formatCurrency(123456, 'UYU'), formatCurrency(-123456, 'USD')]).toEqual(english);
  });

  it('uses plural forms for counts, a million included', () => {
    expect(t('connection:banner.waiting', { count: 1 })).toBe('1 transaction waiting to send');
    expect(t('connection:banner.waiting', { count: 2 })).toBe('2 transactions waiting to send');
    setLanguage('es');
    expect(t('connection:banner.waiting', { count: 1 })).toBe(
      '1 transacción esperando para enviarse',
    );
    expect(t('connection:banner.waiting', { count: 2 })).toBe(
      '2 transacciones esperando para enviarse',
    );
    expect(t('connection:banner.waiting', { count: 1_000_000 })).toBe(
      '1000000 transacciones esperando para enviarse',
    );
  });

  it('does not escape names put into a sentence (React does that)', () => {
    expect(t('undo.undid', { message: 'Deleted "A & B" <x>' })).toBe('Undid: Deleted "A & B" <x>');
  });
});
