import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  defaultDateFormat,
  usePreferencesStore,
  type Theme,
  type DateFormatOption,
  type SidebarMode,
} from '../../store/preferencesStore';
import { ConfirmModal } from '../ui/ConfirmModal';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { detectLanguage, browserLanguage } from '../../i18n/language';
import { IS_DEMO } from '../../demo/isDemo';

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const sidebarModes: { value: SidebarMode; label: string; description: string }[] = [
  { value: 'persistent', label: 'Pinned', description: 'Always open' },
  { value: 'auto-hide', label: 'Auto-hide', description: 'Collapsed, opens on hover' },
];

const dateFormats: DateFormatOption[] = [
  'MMM d, yyyy',
  'd MMM yyyy',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy-MM-dd',
];
/** The day each format is shown with ("Jan 5, 2026", or "5 ene 2026" in Spanish) */
const EXAMPLE_DAY = new Date(2026, 0, 5);

export function PreferencesPanel() {
  const {
    theme,
    dateFormat,
    sidebarMode,
    showMerchantIcons,
    showCategoryIcons,
    showAccountIcons,
    setTheme,
    setDateFormat,
    setSidebarMode,
    setShowMerchantIcons,
    setShowCategoryIcons,
    setShowAccountIcons,
  } = usePreferencesStore();
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);

  function handleReset() {
    setTheme('light');
    setSidebarMode('persistent');
    // The App Language stays as chosen
    setDateFormat(defaultDateFormat(detectLanguage(browserLanguage())));
    setShowMerchantIcons(true);
    setShowCategoryIcons(true);
    setShowAccountIcons(true);
    setResetOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Preferences</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {IS_DEMO
              ? 'Settings are kept in this tab while you try the demo.'
              : 'Settings are saved automatically to your browser.'}
          </p>
        </div>
        <button
          onClick={() => setResetOpen(true)}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <ConfirmModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title="Reset preferences"
        message="Are you sure you want to reset all preferences to their default values?"
        confirmLabel="Reset"
        danger
      />

      <div className="bg-surface-alt rounded-lg p-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text">{t('language.title')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{t('language.description')}</p>
        </div>
        <LanguageSwitch />
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-medium text-text">Theme</h3>
        <div className="flex gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                theme === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-border bg-surface text-text-secondary hover:border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-medium text-text">Sidebar</h3>
        <div className="flex gap-3">
          {sidebarModes.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSidebarMode(opt.value)}
              className={`flex flex-col px-4 py-2 text-sm rounded-md border transition-colors ${
                sidebarMode === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-border bg-surface text-text-secondary hover:border-border'
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-xs text-text-tertiary font-normal mt-0.5">
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-medium text-text">Icons</h3>
        {(
          [
            {
              label: 'Merchant',
              description: 'Merchant logos (or colored initials) next to merchant names',
              value: showMerchantIcons,
              setter: setShowMerchantIcons,
            },
            {
              label: 'Category',
              description: 'Emoji icons next to category names',
              value: showCategoryIcons,
              setter: setShowCategoryIcons,
            },
            {
              label: 'Account',
              description: 'Account logos (or colored initials) next to account names',
              value: showAccountIcons,
              setter: setShowAccountIcons,
            },
          ] as const
        ).map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-text">{row.label}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{row.description}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              {[
                { v: true, l: 'Show' },
                { v: false, l: 'Hide' },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => row.setter(opt.v)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                    row.value === opt.v
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-border bg-surface text-text-secondary hover:border-border'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-medium text-text">{t('dateFormat.title')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {dateFormats.map((value) => (
            <button
              key={value}
              onClick={() => setDateFormat(value)}
              className={`flex items-center justify-between px-4 py-2.5 text-sm rounded-md border transition-colors ${
                dateFormat === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-border bg-surface text-text-secondary hover:border-border'
              }`}
            >
              <span>{value}</span>
              <span className="text-xs text-text-tertiary">{format(EXAMPLE_DAY, value)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
