import { useState } from 'react';
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
  const [search, setSearch] = useState('');
  const { data: candidates, isLoading, isError } = useTransferCandidates(tx.id, isOpen);
  const link = useLinkTransfer();
  const canSave = useCanSave();
  useFormReset(isOpen ? tx.id : null, () => {
    setSearch('');
    link.reset();
  });

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Closed account';
  const shown = filterTransferCandidates(candidates ?? [], search, accountName);
  const outflow = tx.amount < 0;
  const currency = tx.currency ?? accounts.find((a) => a.id === tx.accountId)?.currency;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link as transfer" size="lg">
      <div className="space-y-4">
        <div className="bg-surface-alt rounded-lg px-4 py-3 border border-border-light">
          <p className="text-sm font-medium text-text">
            {formatCurrency(Math.abs(tx.amount), currency)} {outflow ? 'left' : 'arrived in'}{' '}
            {accountName(tx.accountId)} on {format(parseISO(tx.date), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            Choose the transaction where this money {outflow ? 'arrived' : 'came from'}. Both lose
            their category and stop counting as spending or income.
          </p>
        </div>

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by payee, account or notes…"
          aria-label="Filter transactions"
        />

        {link.isError && (
          <p role="alert" className="text-sm text-negative">
            {link.error instanceof Error ? link.error.message : "Couldn't link these transactions"}
          </p>
        )}
        <SavingPausedHint />

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-text-tertiary text-center py-8">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-text-tertiary text-center py-8">
              Couldn't load transactions. Close this and try again.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">
              {candidates?.length
                ? 'No transactions match this filter.'
                : `No ${outflow ? 'inflows' : 'outflows'} in other accounts to link. Import or add the other side first.`}
            </p>
          ) : (
            <ul className="divide-y divide-border-light" aria-label="Transactions to link">
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
                        {format(parseISO(other.date), 'MMM d, yyyy')} ·{' '}
                        {accountName(other.accountId)}
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
