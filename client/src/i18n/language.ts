// The App Language (GLOSSARY.md): the language the app's own text is shown in on this device.
// Pure: no i18next, no store, no DOM. The setup that applies a language is in ./index.ts.

/** The languages the app is written in. Their names are never translated. */
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const;

export type Language = (typeof LANGUAGES)[number]['value'];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.value === value);
}

/**
 * The language of a device that has never chosen one, from the browser's language
 * (`navigator.language`): anything starting with `es` is Spanish, everything else English.
 */
export function detectLanguage(browserLanguage: string | null | undefined): Language {
  return /^es([-_]|$)/i.test(browserLanguage ?? '') ? 'es' : DEFAULT_LANGUAGE;
}

/** The browser's language, or none where there is no browser (tests). */
export function browserLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language;
}
