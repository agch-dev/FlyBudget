import type { Transaction } from '../types';

/**
 * Whether "Link as transfer" is offered for this transaction. The server decides for real
 * (`sideRefusal` in server/src/services/transferLink.ts); this only hides the button.
 */
export function canLinkAsTransfer(tx: Transaction): boolean {
  return (
    tx.amount !== 0 &&
    tx.reconciled !== 1 &&
    tx.isParent !== 1 &&
    !tx.parentTransactionId &&
    !tx.transferTransactionId
  );
}

/** The candidates whose payee, notes or account name contain `search`; order is kept */
export function filterTransferCandidates(
  candidates: Transaction[],
  search: string,
  accountName: (accountId: string) => string,
): Transaction[] {
  const q = search.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((t) =>
    [t.payeeName, t.notes, accountName(t.accountId)].some((text) =>
      (text ?? '').toLowerCase().includes(q),
    ),
  );
}
