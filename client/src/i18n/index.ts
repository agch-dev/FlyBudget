import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setDefaultOptions } from 'date-fns';
import { enUS, es as esLocale, type Locale } from 'date-fns/locale';
import { CATALOGS, DEFAULT_NAMESPACE, NAMESPACES, en } from './catalog';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './language';

// The App Language (GLOSSARY.md), set up once for the whole client: i18next with the catalogs
// bundled in (nothing is fetched), English as the source and the fallback.
//
// - Components: `const { t } = useTranslation()` (or `useTranslation('rules')`) from
//   react-i18next, so they re-render when the language changes.
// - Pure helpers that build sentences: `import { t } from '../i18n'`.
// - `setLanguage` is called by utils/applyLanguage.ts, which follows the `language` preference.

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE;
    resources: typeof en;
  }
}

const DATE_LOCALES: Record<Language, Locale> = { en: enUS, es: esLocale };

const i18n = i18next.createInstance();

/**
 * Spanish has a plural form English lacks ("many": a million and up, which reads like the
 * general form). Catalogs only write `_one` and `_other`, so the general form stands in.
 */
function withManyForms(catalog: object): Record<string, unknown> {
  const filled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(catalog)) {
    filled[key] = typeof value === 'string' ? value : withManyForms(value);
    if (typeof value === 'string' && key.endsWith('_other')) {
      filled[key.replace(/_other$/, '_many')] ??= value;
    }
  }
  return filled;
}

void i18n.use(initReactI18next).init({
  resources: { en: CATALOGS.en, es: withManyForms(CATALOGS.es) as typeof CATALOGS.es },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: DEFAULT_NAMESPACE,
  // Everything is bundled, so the language is ready (and switches) synchronously
  initAsync: false,
  // React escapes what it renders; escaping here too would show "&amp;" in names
  interpolation: { escapeValue: false },
  // A missing key shows the English text, never an empty string
  returnNull: false,
  returnEmptyString: false,
});

/** The shared instance, for `I18nextProvider`-free use by react-i18next and for tests. */
export default i18n;

/**
 * Translates a key in the current language. For pure helpers; components use
 * `useTranslation()` so they re-render on a switch. Keys of other namespaces are written
 * `t('rules:editor.addCondition')`.
 */
export const t = i18n.t;

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/**
 * Switches the whole app to a language, at once: the catalogs, month and weekday names
 * (date-fns) and `<html lang>`. Weeks keep starting on Sunday in both languages, since the
 * calendars' columns are laid out that way.
 */
export function setLanguage(language: Language) {
  setDefaultOptions({ locale: DATE_LOCALES[language], weekStartsOn: 0 });
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

setLanguage(DEFAULT_LANGUAGE);
