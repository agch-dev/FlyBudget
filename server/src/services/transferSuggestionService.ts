import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions, transferSuggestionDismissals } from '../db/schema.js';
import { rateLookup } from './exchangeRates.js';
import { listRates } from './exchangeRateService.js';
import { pairKey, suggestTransfers } from './transferSuggestions.js';
import type { LinkSide } from './transferLink.js';
import type { Currency } from '../utils/currency.js';

// The database side of transfer suggestions (rules in transferSuggestions.ts). Nothing here
// links anything: confirming a suggestion is `linkAsTransfer` (transferLinkService.ts).

/** One side of a suggestion: what the user needs to recognize the transaction */
export interface SuggestionSide {
  id: string;
  accountId: string;
  date: string;
  /** Native amount: cents in the account's currency */
  amount: number;
  currency: Currency;
  payeeName: string | null;
}

export interface ListedTransferSuggestion {
  outflow: SuggestionSide;
  inflow: SuggestionSide;
  /** Pesos per dollar the two amounts imply; null within one currency */
  rate: number | null;
}

type Loaded = LinkSide & { payeeName: string | null };

const toSide = (t: Loaded): SuggestionSide => ({
  id: t.id,
  accountId: t.accountId,
  date: t.date,
  amount: t.amount,
  currency: t.currency,
  payeeName: t.payeeName,
});

/**
 * The transfers to suggest right now, newest first (see `suggestTransfers`). Between
 * currencies a pair is compared with the stored exchange rate of the day the money left
 * (carried forward over weekends); a day before every stored rate gets no suggestion, since
 * an estimated rate would only guess. Balance adjustments are never suggested.
 */
export function listTransferSuggestions(): ListedTransferSuggestion[] {
  const candidates: Loaded[] = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      date: transactions.date,
      amount: transactions.amount,
      currency: accounts.currency,
      reconciled: transactions.reconciled,
      isParent: transactions.isParent,
      parentTransactionId: transactions.parentTransactionId,
      transferTransactionId: transactions.transferTransactionId,
      payeeName: transactions.payeeName,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    // The pure rule decides; this only keeps what it could accept
    .where(
      and(
        isNull(transactions.transferTransactionId),
        isNull(transactions.parentTransactionId),
        eq(transactions.isParent, 0),
        ne(transactions.reconciled, 1),
        eq(transactions.isAdjustment, 0),
        ne(transactions.amount, 0),
      ),
    )
    .all();

  const dismissed = new Set(
    db
      .select({ id: transferSuggestionDismissals.id })
      .from(transferSuggestionDismissals)
      .all()
      .map((d) => d.id),
  );
  const lookup = rateLookup(listRates());
  return suggestTransfers(candidates, (date) => lookup(date)?.rate ?? null, dismissed).map(
    ({ outflow, inflow, rate }) => ({ outflow: toSide(outflow), inflow: toSide(inflow), rate }),
  );
}

export type DismissResult = { ok: true } | { ok: false; status: 400 | 404; error: string };

/**
 * Remembers that these two transactions are not a transfer, so the pair is not suggested
 * again (either may still be suggested with another transaction). The order of the ids
 * doesn't matter and dismissing twice is fine. The row goes when either transaction does.
 */
export function dismissTransferSuggestion(id: string, otherId: string): DismissResult {
  if (id === otherId) {
    return { ok: false, status: 400, error: 'A suggestion is two different transactions' };
  }
  const [first, second] = id < otherId ? [id, otherId] : [otherId, id];
  const found = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(inArray(transactions.id, [first, second]))
    .all();
  if (found.length !== 2) return { ok: false, status: 404, error: 'Not found' };
  db.insert(transferSuggestionDismissals)
    .values({ id: pairKey(first, second), transactionId: first, otherTransactionId: second })
    .onConflictDoNothing()
    .run();
  return { ok: true };
}
