import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n/language';
import { usePreferencesStore } from '../../store/preferencesStore';

/**
 * The switch for the App Language (GLOSSARY.md): English or Español, a preference of this
 * device that applies at once. It is in Settings → Preferences and on the screens reachable
 * before Settings (sign-in, set a password, reconnecting, /welcome).
 */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  return (
    <div
      role="radiogroup"
      aria-label={t('language.title')}
      className={`inline-flex shrink-0 rounded-md border border-border bg-surface p-0.5 ${className}`}
    >
      {LANGUAGES.map((l) => {
        const selected = l.value === language;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Each name is in its own language, whatever the app is in
            lang={l.value}
            onClick={() => setLanguage(l.value)}
            className={`px-2.5 py-1 max-md:min-h-11 max-md:min-w-11 text-xs rounded whitespace-nowrap transition-colors cursor-pointer ${
              selected
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-text-secondary hover:bg-hover hover:text-text'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
