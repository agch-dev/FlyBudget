import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useDismissTransferSuggestion,
  useLinkTransfer,
  useTransferSuggestions,
} from '../../hooks/useTransactions';
import { useCanSave } from '../../hooks/useConnection';
import { formatCurrency } from '../../utils/currency';
import { suggestionCountLabel, suggestionsForAccount } from '../../utils/transferSuggestions';
import type { TransferSuggestionSide } from '../../api/transferSuggestions';
import { Button } from '../ui/Button';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { TransferRate } from './TransferRate';

interface Props {
  /** The account whose register this is (all accounts when absent) */
  accountId?: string;
  accountName: (id: string) => string | undefined;
}

/**
 * Transfer suggestions, above the register: pairs of transactions that look like the two
 * sides of a transfer (typically after importing both accounts). Nothing is linked until the
 * user says so; "Not a transfer" stops that pair from being suggested again.
 */
export function TransferSuggestions({ accountId, accountName }: Props) {
  const { t } = useTranslation('transactions');
  const { data } = useTransferSuggestions();
  const link = useLinkTransfer();
  const dismiss = useDismissTransferSuggestion();
  const canSave = useCanSave();
  const [expanded, setExpanded] = useState(false);
  /** The suggestion whose link was refused, to show the reason next to it */
  const [refused, setRefused] = useState<string | null>(null);

  const suggestions = suggestionsForAccount(data ?? [], accountId);
  if (suggestions.length === 0) return null;

  const busy = link.isPending || dismiss.isPending;
  const nameOf = (id: string) => accountName(id) ?? t('term.closedAccount');

  const side = (s: TransferSuggestionSide) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
      <span className="text-xs text-text-tertiary w-24 shrink-0 tabular-nums">
        {format(parseISO(s.date), t('datePattern.medium', { ns: 'common' }))}
      </span>
      <span className="flex-1 min-w-0 truncate text-text">
        {s.payeeName || t('term.noPayee')}
        <span className="text-xs text-text-tertiary"> · {nameOf(s.accountId)}</span>
      </span>
      <span className={`font-medium tabular-nums ${s.amount > 0 ? 'text-positive' : 'text-text'}`}>
        {s.amount > 0 ? '+' : ''}
        {formatCurrency(s.amount, s.currency)}
      </span>
    </div>
  );

  return (
    <section aria-label={t('suggestions.label')} className="border-b border-border bg-brand-50/60">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1 max-md:py-0">
        <ArrowLeftRight size={15} className="text-brand-600 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-text">
          {suggestionCountLabel(suggestions.length)}
        </span>
        <span className="text-xs text-text-secondary">{t('suggestions.explanation')}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-expanded={expanded}
          aria-controls="transfer-suggestions"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('suggestions.hide') : t('suggestions.review')}
          {expanded ? (
            <ChevronDown size={14} aria-hidden />
          ) : (
            <ChevronRight size={14} aria-hidden />
          )}
        </Button>
      </div>

      {expanded && (
        <ul
          id="transfer-suggestions"
          className="bg-surface border-t border-border-light max-h-96 overflow-y-auto divide-y divide-border-light"
        >
          {suggestions.map(({ outflow, inflow, rate }) => {
            const key = `${outflow.id}:${inflow.id}`;
            const named = {
              outflow: outflow.payeeName || t('term.noPayee'),
              inflow: inflow.payeeName || t('term.noPayee'),
            };
            return (
              <li
                key={key}
                data-testid="transfer-suggestion"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5"
              >
                <div className="flex-1 min-w-0 basis-72 space-y-1">
                  {side(outflow)}
                  {side(inflow)}
                  <TransferRate rate={rate} />
                  {refused === key && link.error && (
                    <p role="alert" className="text-xs text-negative">
                      {link.error.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!canSave || busy}
                    aria-label={t('suggestions.linkNamed', named)}
                    onClick={() => {
                      setRefused(key);
                      link.mutate({ id: outflow.id, otherTransactionId: inflow.id });
                    }}
                  >
                    {t('suggestions.link')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canSave || busy}
                    aria-label={t('suggestions.dismissNamed', named)}
                    onClick={() =>
                      dismiss.mutate({ id: outflow.id, otherTransactionId: inflow.id })
                    }
                  >
                    {t('suggestions.dismiss')}
                  </Button>
                </div>
              </li>
            );
          })}
          {!canSave && (
            <li className="px-4 py-2">
              <SavingPausedHint />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
