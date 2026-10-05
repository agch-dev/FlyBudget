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
