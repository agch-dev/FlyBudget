import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CloudUpload, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { discardWaiting, retryWaiting, sendWaiting, useOutbox } from '../../offline/outbox';
import { useConnectionStore } from '../../store/connectionStore';
import { formatCurrency } from '../../utils/currency';
import type { Currency } from '../../types';
import { isRefused, outboxEntryFor, refusedBecause, type OutboxItem } from '../../utils/offline';
import { ConfirmModal } from '../ui/ConfirmModal';

interface Props {
  /** The account whose register this is (all accounts when absent) */
  accountId?: string;
  categoryName: (id: string) => string | undefined;
  accountName: (id: string) => string | undefined;
  /** Each waiting amount is in its account's currency */
  accountCurrency: (id: string) => Currency | undefined;
}

/**
 * New transactions saved on this device while FlyBudget couldn't reach its server, shown
 * above the register until they're sent. They aren't in balances or the budget yet.
 */
export function WaitingTransactions({
  accountId,
  categoryName,
  accountName,
  accountCurrency,
}: Props) {
  const { t } = useTranslation('transactions');
  const qc = useQueryClient();
  const items = useOutbox((s) => s.items);
  const sending = useOutbox((s) => s.sending);
  const connected = useConnectionStore((s) => s.status === 'connected');
  const [discarding, setDiscarding] = useState<OutboxItem | null>(null);

  const shown = items
    .map((item) => ({ item, entry: outboxEntryFor(item, accountId) }))
    .filter((x): x is { item: OutboxItem; entry: NonNullable<typeof x.entry> } => x.entry !== null);
  if (shown.length === 0) return null;

  const status = sending ? t('waiting.sending') : connected ? null : t('waiting.sentLater');

  function payeeOf(item: OutboxItem) {
    if (item.kind === 'transfer') {
      const other =
        accountId === item.data.toAccountId ? item.data.fromAccountId : item.data.toAccountId;
      return t('term.transferTo', { account: accountName(other) ?? t('term.anotherAccount') });
    }
    return item.data.payeeName || t('term.noPayee');
  }

  function detailOf(item: OutboxItem) {
    if (item.kind === 'transfer') return t('term.transfer');
    if (item.data.splits?.length) return t('term.splitOf', { parts: item.data.splits.length });
    return (item.data.categoryId && categoryName(item.data.categoryId)) || t('term.uncategorized');
  }

  return (
    <section
      aria-label={t('waiting.title')}
      className="border-b border-caution/30 bg-caution-subtle/40"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 border-b border-caution/20">
        <CloudUpload size={15} className="text-caution shrink-0" aria-hidden />
        <span className="text-sm font-medium text-text">{t('waiting.title')}</span>
        {status && (
          <span className="text-xs text-text-secondary flex items-center gap-1">
            {sending && <Loader2 size={12} className="animate-spin" aria-hidden />}
            {status}
          </span>
        )}
      </div>
      <ul>
        {shown.map(({ item, entry }) => (
          <li
            key={item.id}
            data-testid="waiting-transaction"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-border-light last:border-b-0"
          >
            <span className="text-xs text-text-tertiary w-24 shrink-0 tabular-nums">
              {format(parseISO(item.data.date), t('datePattern.medium', { ns: 'common' }))}
            </span>
            <span className="flex-1 min-w-0 grid">
              <span className="truncate text-sm font-medium text-text">{payeeOf(item)}</span>
              <span className="truncate text-xs text-text-tertiary">
                {detailOf(item)}
                {!accountId && ` · ${accountName(entry.accountId) ?? ''}`}
              </span>
            </span>
            <span
              className={`text-sm font-medium tabular-nums ${entry.amount > 0 ? 'text-positive' : 'text-text'}`}
            >
              {entry.amount > 0 ? '+' : ''}
              {formatCurrency(entry.amount, accountCurrency(entry.accountId))}
            </span>
            {isRefused(item) ? (
              <span className="basis-full flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-negative">
                  <AlertCircle size={12} aria-hidden />{' '}
                  {t('waiting.notSaved', { error: refusedBecause(item) })}
                </span>
                <button
                  onClick={() => void retryWaiting(item.id).then(() => sendWaiting(qc))}
                  aria-label={t('waiting.tryAgainNamed', { payee: payeeOf(item) })}
                  disabled={!connected}
                  className="px-2 py-1 max-md:min-h-11 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-50"
                >
                  {t('waiting.tryAgain')}
                </button>
                <button
                  onClick={() => setDiscarding(item)}
                  aria-label={t('waiting.discardNamed', { payee: payeeOf(item) })}
                  className="px-2 py-1 max-md:min-h-11 rounded border border-border bg-surface text-negative hover:bg-negative-subtle"
                >
                  {t('waiting.discard')}
                </button>
              </span>
            ) : (
              <button
                onClick={() => setDiscarding(item)}
                aria-label={t('waiting.discardNamed', { payee: payeeOf(item) })}
                className="text-xs px-2 py-1 max-md:min-h-11 rounded text-text-tertiary hover:text-negative hover:bg-surface"
              >
                {t('waiting.discard')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmModal
        isOpen={discarding !== null}
        onClose={() => setDiscarding(null)}
        onConfirm={() => {
          if (discarding) void discardWaiting(discarding.id);
          setDiscarding(null);
        }}
        title={t('waiting.discardTitle')}
        message={t('waiting.discardMessage')}
        confirmLabel={t('waiting.discard')}
        danger
      />
    </section>
  );
}
