import { formatRate, impliedRate } from '../../utils/currency';
import type { Currency } from '../../types';

interface Side {
  amount: number;
  currency?: Currency;
}

/**
 * The exchange rate a transfer between a pesos and a dollars account implies ("Rate: US$1 =
 * $40.25"). Shows nothing between accounts of the same currency, or until both amounts are in.
 */
export function TransferRate({ a, b, className = '' }: { a: Side; b: Side; className?: string }) {
  const rate = impliedRate(a, b);
  if (rate === null) return null;
  return (
    <p className={`text-xs text-text-tertiary tabular-nums ${className}`} aria-live="polite">
      Rate: {formatRate(rate)}
    </p>
  );
}
