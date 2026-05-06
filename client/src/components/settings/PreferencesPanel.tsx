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
        <h2 className="text-sm font-semibold text-gray-900">Preferences</h2>
        <p className="text-xs text-gray-400 mt-0.5">Settings are saved automatically to your browser.</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-800">Theme</h3>
        <div className="flex gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                theme === opt.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {theme !== 'light' && (
          <p className="text-xs text-amber-600">Dark mode styling is coming in a future update. The setting will be remembered.</p>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-800">Currency Symbol</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value.slice(0, 3))}
            maxLength={3}
            className="w-20 text-center text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">Max 3 characters (e.g. $, EUR, &#163;)</span>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-800">Date Format</h3>
        <div className="grid grid-cols-2 gap-2">
          {dateFormats.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFormat(opt.value)}
              className={`flex items-center justify-between px-4 py-2.5 text-sm rounded-lg border transition-colors ${
                dateFormat === opt.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-xs text-gray-400">{opt.example}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
