import { Link } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { useEstimatedRateDates } from '../../hooks/useExchangeRates';
import { ratesNotice } from '../../utils/exchangeRates';

/**
 * Top-of-page notice about missing exchange rates (the rates couldn't be fetched). While
 * dollar transactions are dated before every stored rate, amounts converted on those dates
 * use the closest rate there is; while no rate is stored at all, dollar amounts are left out
 * of totals. It goes away once a rate, fetched or entered by hand, covers them. A budget in
 * pesos only never sees it.
 */
export function EstimatedRatesBanner() {
  const notice = ratesNotice(useEstimatedRateDates().data);
  if (!notice) return null;
  return (
    <div
      role="status"
      aria-label="Estimated exchange rates"
      className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm bg-caution-subtle text-text border-b border-caution/30"
    >
      <TriangleAlert size={16} className="text-caution shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{notice.title}</span>{' '}
        <span className="text-text-secondary">{notice.detail}</span>
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
