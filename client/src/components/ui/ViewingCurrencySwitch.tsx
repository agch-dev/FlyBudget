import { usePreferencesStore } from '../../store/preferencesStore';
import { CURRENCIES } from '../../types';

/**
 * The one switch for the Viewing Currency: pesos or dollars for the combined totals of the
 * dashboard, reports, cash flow and net worth, wherever it is shown. The choice is a
 * preference of this device. The Budget and each account's own amounts don't follow it.
 */
export function ViewingCurrencySwitch({ className = '' }: { className?: string }) {
  const viewing = usePreferencesStore((s) => s.viewingCurrency);
  const setViewing = usePreferencesStore((s) => s.setViewingCurrency);
  return (
    <div
      role="radiogroup"
      aria-label="Viewing currency"
      title="Show totals in pesos or in dollars. The Budget is always in pesos."
      className={`inline-flex shrink-0 rounded-md border border-border bg-surface p-0.5 ${className}`}
    >
      {CURRENCIES.map((c) => {
        const selected = c.value === viewing;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            onClick={() => setViewing(c.value)}
            className={`px-2.5 py-1 max-md:min-h-11 max-md:min-w-11 text-xs rounded tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
              selected
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-text-secondary hover:bg-hover hover:text-text'
            }`}
          >
            {c.symbol}
          </button>
        );
      })}
    </div>
  );
}
