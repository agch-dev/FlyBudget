import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { useCanSave } from '../../hooks/useConnection';
import { useFormReset } from '../../hooks/useFormReset';
import { useLinkTransfer, useTransferCandidates } from '../../hooks/useTransactions';
import { formatCurrency } from '../../utils/currency';
import { filterTransferCandidates } from '../../utils/transferLink';
import type { Account, Transaction } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The transaction being linked: one side of the transfer */
  transaction: Transaction;
  accounts: Account[];
}

/**
 * Picks the other side for "Link as transfer": the transactions of the opposite direction in
 * other accounts, nearest in date first. Choosing one links the two.
 */
export function LinkTransferModal({ isOpen, onClose, transaction: tx, accounts }: Props) {
  const { t } = useTranslation('transactions');
  const [search, setSearch] = useState('');
  const { data: candidates, isLoading, isError } = useTransferCandidates(tx.id, isOpen);
  const link = useLinkTransfer();
  const canSave = useCanSave();
  useFormReset(isOpen ? tx.id : null, () => {
    setSearch('');
    link.reset();
  });

  const medium = t('datePattern.medium', { ns: 'common' });
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? t('term.closedAccount');
  const shown = filterTransferCandidates(candidates ?? [], search, accountName);
  const outflow = tx.amount < 0;
  const currency = tx.currency ?? accounts.find((a) => a.id === tx.accountId)?.currency;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('link.title')} size="lg">
      <div className="space-y-4">
        <div className="bg-surface-alt rounded-lg px-4 py-3 border border-border-light">
          <p className="text-sm font-medium text-text">
            {t(outflow ? 'link.left' : 'link.arrivedIn', {
              amount: formatCurrency(Math.abs(tx.amount), currency),
              account: accountName(tx.accountId),
              date: format(parseISO(tx.date), medium),
            })}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {outflow ? t('link.chooseArrival') : t('link.chooseSource')}
          </p>
        </div>

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('link.filter')}
          aria-label={t('link.filterLabel')}
        />

        {link.isError && (
          <p role="alert" className="text-sm text-negative">
            {link.error instanceof Error ? link.error.message : t('link.failed')}
          </p>
        )}
        <SavingPausedHint />

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-text-tertiary text-center py-8">{t('term.loading')}</p>
          ) : isError ? (
            <p className="text-sm text-text-tertiary text-center py-8">{t('link.loadFailed')}</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">
              {candidates?.length
                ? t('link.noMatch')
                : outflow
                  ? t('link.noInflows')
                  : t('link.noOutflows')}
            </p>
          ) : (
            <ul className="divide-y divide-border-light" aria-label={t('link.listLabel')}>
              {shown.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    disabled={!canSave || link.isPending}
                    onClick={() =>
                      link.mutate(
                        { id: tx.id, otherTransactionId: other.id },
                        { onSuccess: onClose },
                      )
                    }
                    className="w-full flex items-center gap-3 py-2.5 px-2 max-md:min-h-11 text-left hover:bg-hover rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-text truncate">
                        {other.payeeName || '—'}
                      </span>
                      <span className="block text-xs text-text-tertiary truncate">
                        {format(parseISO(other.date), medium)} · {accountName(other.accountId)}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-medium tabular-nums ${other.amount > 0 ? 'text-positive' : 'text-text'}`}
                    >
                      {formatCurrency(other.amount, other.currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
