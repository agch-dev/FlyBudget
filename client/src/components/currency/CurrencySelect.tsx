import { useMemo } from 'react';
import { CURRENCY_CODES } from '../../utils/currencies';
import { currencyName } from '../../utils/currency';

/** Asked for most: shown first, after the ones already in use */
const COMMON = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'CAD', 'AUD', 'JPY'];

interface Props {
  value: string;
  onChange: (currency: string) => void;
  /** Shown at the top: the budget's currency and the ones accounts already use */
  first?: string[];
  disabled?: boolean;
  /** Shown while no currency is chosen (`value` ''), as the first option */
  placeholder?: string;
  /** `sm`: as small as the import dialog's other options */
  size?: 'md' | 'sm';
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

/** A currency picker: "EUR · Euro", the ones in use and common ones first, then all by name */
export function CurrencySelect({
  value,
  onChange,
  first = [],
  disabled,
  placeholder,
  size = 'md',
  id,
  'aria-label': ariaLabel = 'Currency',
  'aria-describedby': describedBy,
  className = '',
}: Props) {
  // Callers pass a new array each render: keyed on its contents, so ~150 names are looked up
  // and sorted once
  const firstKey = first.join(',');
  const groups = useMemo(() => {
    const top = [...new Set([...firstKey.split(',').filter(Boolean), ...COMMON])].filter((c) =>
      CURRENCY_CODES.includes(c),
    );
    const rest = CURRENCY_CODES.filter((c) => !top.includes(c))
      .map((code) => ({ code, name: currencyName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { top: top.map((code) => ({ code, name: currencyName(code) })), rest };
  }, [firstKey]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={`block w-full border border-border bg-surface text-text focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 ${size === 'sm' ? 'rounded px-1.5 py-1 text-xs' : 'rounded-lg px-3 py-2 text-sm'} ${className}`}
    >
      {placeholder !== undefined && !value && <option value="">{placeholder}</option>}
      <optgroup label="Common">
        {groups.top.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="All currencies">
        {groups.rest.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
