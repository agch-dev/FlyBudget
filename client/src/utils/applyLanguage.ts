import { setLanguage } from '../i18n';
import { DEFAULT_LANGUAGE, isLanguage } from '../i18n/language';
import { usePreferencesStore } from '../store/preferencesStore';

/**
 * Applies the App Language preference before the first render, and again whenever it changes
 * (the switch, or the demo's "Start over"), with no reload.
 */
export function initLanguage() {
  const apply = (language: unknown) =>
    setLanguage(isLanguage(language) ? language : DEFAULT_LANGUAGE);
  apply(usePreferencesStore.getState().language);
  usePreferencesStore.subscribe((state) => apply(state.language));
}

/**
 * The names the server supplies (Default Categories, the "Overview" dashboard) come in the
 * language of each request, so a switch asks for everything again. Call after `initLanguage`,
 * so the requests go out in the new language. While the server can't be reached, names stay
 * in the old language until it answers.
 */
export function refetchOnLanguageChange(queryClient: { invalidateQueries: () => Promise<void> }) {
  usePreferencesStore.subscribe((state, previous) => {
    if (state.language !== previous.language) void queryClient.invalidateQueries();
  });
}
