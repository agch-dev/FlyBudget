import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { useEstimatedRateDates } from '../../hooks/useExchangeRates';
import { estimatedDatesLabel } from '../../utils/exchangeRates';

/**
 * Top-of-page notice while dollar transactions are dated before every stored exchange rate
 * (the rates couldn't be fetched): amounts converted on those dates use the closest rate
 * there is. It goes away once a rate, fetched or entered by hand, covers them. A budget in
 * pesos only never sees it.
 */
export function EstimatedRatesBanner() {
  const dates = useEstimatedRateDates().data?.dates;
  if (!dates?.length) return null;
  return (
    <div
      role="status"
      aria-label="Estimated exchange rates"
      className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm bg-caution-subtle text-text border-b border-caution/30"
    >
      <TriangleAlert size={16} className="text-caution shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">No exchange rate for {estimatedDatesLabel(dates)}.</span>{' '}
        <span className="text-text-secondary">
          Dollar amounts on {dates.length === 1 ? 'that date' : 'those dates'} are converted at the
          closest rate available, so totals are estimated.
        </span>
      </span>
      <Link
        to="/settings?tab=rates"
        className="ml-auto inline-flex items-center justify-center px-2.5 py-1 max-md:min-h-11 text-xs font-medium rounded-md border border-border bg-surface text-text-secondary hover:text-text hover:bg-surface-alt transition-colors whitespace-nowrap"
      >
        Enter rates
      </Link>
    </div>
  );
}
