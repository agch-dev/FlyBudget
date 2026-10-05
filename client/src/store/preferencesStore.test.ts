import { describe, expect, it } from 'vitest';
import { migratePreferences, resetPreferences, usePreferencesStore } from './preferencesStore';

describe('stored preferences', () => {
  it('drops the currency symbol saved by earlier versions and keeps the rest', () => {
    const saved = { theme: 'dark', currencySymbol: '€', dateFormat: 'dd/MM/yyyy' };
    expect(migratePreferences(saved)).toEqual({ theme: 'dark', dateFormat: 'dd/MM/yyyy' });
  });

  it('copes with nothing saved', () => {
    expect(migratePreferences(undefined)).toEqual({});
    expect(migratePreferences(null)).toEqual({});
  });

  it('has no currency symbol preference', () => {
    expect(usePreferencesStore.getState()).not.toHaveProperty('currencySymbol');
    expect(usePreferencesStore.getState()).not.toHaveProperty('setCurrencySymbol');
  });

  it('views combined totals in pesos until the switch is used', () => {
    expect(usePreferencesStore.getState().viewingCurrency).toBe('UYU');
    usePreferencesStore.getState().setViewingCurrency('USD');
    expect(usePreferencesStore.getState().viewingCurrency).toBe('USD');
    resetPreferences();
    expect(usePreferencesStore.getState().viewingCurrency).toBe('UYU');
  });

  it('keeps pesos for preferences saved before the switch existed', () => {
    expect(migratePreferences({ theme: 'dark' })).not.toHaveProperty('viewingCurrency');
  });
});
