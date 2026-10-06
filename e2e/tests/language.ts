import type { BrowserContext } from '@playwright/test';

export type AppLanguage = 'en' | 'es';

/**
 * Pins the App Language preference for every page of a browser context, whatever the
 * browser's language, so tests read the same text on every machine. It only fills in a
 * language where none is stored, so a test can still switch it and reload. The demo keeps
 * its preferences in sessionStorage; everything else in localStorage.
 */
export async function pinLanguage(
  context: BrowserContext,
  language: AppLanguage,
  storage: 'localStorage' | 'sessionStorage' = 'localStorage',
) {
  await context.addInitScript(
    ([language, storage]) => {
      const KEY = 'budget-preferences';
      try {
        const store = window[storage as 'localStorage'];
        const saved = JSON.parse(store.getItem(KEY) ?? 'null') ?? { state: {}, version: 1 };
        if (saved.state.language) return;
        saved.state.language = language;
        store.setItem(KEY, JSON.stringify(saved));
      } catch {
        // A page with no storage (about:blank): nothing to pin
      }
    },
    [language, storage],
  );
}
