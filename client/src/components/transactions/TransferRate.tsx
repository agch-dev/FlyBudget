import { formatRate } from '../../utils/exchangeRates';

/**
 * The exchange rate a transfer between a pesos and a dollars account implies, written like
 * Settings → Exchange rates ("Rate: $ 40.25 per US$ 1"). Pass `impliedRate(…)` of its two
 * sides: nothing is shown while that is null (same currency, or an amount still missing).
 */
export function TransferRate({
  rate,
  className = '',
}: {
  rate: number | null;
  className?: string;
}) {
  if (rate === null) return null;
  return (
    <p className={`text-xs text-text-tertiary tabular-nums ${className}`} aria-live="polite">
      Rate: $ {formatRate(rate)} per US$ 1
    </p>
  );
}
