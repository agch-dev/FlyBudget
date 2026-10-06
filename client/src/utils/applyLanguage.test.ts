import { describe, expect, it, vi } from 'vitest';
import { currentLanguage } from '../i18n';
import { usePreferencesStore } from '../store/preferencesStore';
import { initLanguage, refetchOnLanguageChange } from './applyLanguage';

// The names the server supplies come in the language of the request, so a switch of the App
// Language asks for everything again.

describe('switching the App Language', () => {
  it('refetches every query, once per switch, and not for other preferences', () => {
    initLanguage();
    const invalidateQueries = vi.fn(async () => {});
    usePreferencesStore.setState({ language: 'en' });
    refetchOnLanguageChange({ invalidateQueries });
    expect(invalidateQueries).not.toHaveBeenCalled();

    usePreferencesStore.getState().setLanguage('es');
    expect(currentLanguage()).toBe('es');
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith();

    usePreferencesStore.getState().setLanguage('es');
    usePreferencesStore.setState({ viewingCurrency: 'USD' });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    usePreferencesStore.getState().setLanguage('en');
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
  });
});
