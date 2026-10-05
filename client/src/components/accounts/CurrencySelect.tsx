import { CURRENCIES, type Currency } from '../../types';

interface Props {
  value: Currency;
  onChange: (currency: Currency) => void;
  /** The account already has transactions: its currency is shown but can't change */
  locked?: boolean;
}

/** Pesos or dollars, for the add and edit account dialogs. */
export function CurrencySelect({ value, onChange, locked = false }: Props) {
  return (
    <div>
      <span
        id="account-currency-label"
        className="block text-sm font-medium text-text-secondary mb-1"
      >
        Currency
      </span>
      <div role="radiogroup" aria-labelledby="account-currency-label" className="flex gap-2">
        {CURRENCIES.map((c) => {
          const selected = c.value === value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked && !selected}
              onClick={() => onChange(c.value)}
              className={`flex-1 px-3 py-2 max-md:min-h-11 text-sm rounded-lg border transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                  : 'border-border bg-surface text-text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface'
              }`}
            >
              {c.label} <span className="tabular-nums">({c.symbol})</span>
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="mt-1 text-xs text-text-tertiary">
          The currency can&apos;t change once the account has transactions.
        </p>
      )}
    </div>
  );
}
