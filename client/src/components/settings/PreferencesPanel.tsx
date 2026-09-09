import { usePreferencesStore, type Theme, type DateFormatOption } from '../../store/preferencesStore';

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const dateFormats: { value: DateFormatOption; label: string; example: string }[] = [
  { value: 'MMM d, yyyy', label: 'MMM d, yyyy', example: 'Jan 5, 2026' },
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy', example: '01/05/2026' },
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy', example: '05/01/2026' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd', example: '2026-01-05' },
];

export function PreferencesPanel() {
  const { theme, currencySymbol, dateFormat, setTheme, setCurrencySymbol, setDateFormat } = usePreferencesStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-text">Preferences</h2>
        <p className="text-xs text-text-tertiary mt-0.5">Settings are saved automatically to your browser.</p>
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
        {theme !== 'light' && (
          <p className="text-xs text-caution">Dark mode styling is coming in a future update. The setting will be remembered.</p>
        )}
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-medium text-text">Currency Symbol</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value.slice(0, 3))}
            maxLength={3}
            className="w-20 text-center text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
          />
          <span className="text-xs text-text-tertiary">Max 3 characters (e.g. $, EUR, &#163;)</span>
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-medium text-text">Date Format</h3>
        <div className="grid grid-cols-2 gap-2">
          {dateFormats.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFormat(opt.value)}
              className={`flex items-center justify-between px-4 py-2.5 text-sm rounded-md border transition-colors ${
                dateFormat === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-border bg-surface text-text-secondary hover:border-border'
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-xs text-text-tertiary">{opt.example}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
