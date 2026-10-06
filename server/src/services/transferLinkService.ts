import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { byNearestDate, isTransferCandidate, linkRefusal } from './transferLink.js';
import { RECONCILED } from './transactionRefusals.js';
import type { Currency } from '../utils/currency.js';
import { refusal, type Refusal } from '../utils/refusals.js';

// Linking two existing transactions as a transfer, and unlinking a transfer. Every such write
// goes through `linkAsTransfer` / `unlinkTransfer` (rules in transferLink.ts).

type Row = typeof transactions.$inferSelect;
/** A transaction with its account's currency */
export type TransferSide = Row & { currency: Currency };

/** What a link or unlink came to: both sides as saved, or the HTTP answer of a refusal */
export type LinkResult =
  | { ok: true; transactions: [TransferSide, TransferSide] }
  | { ok: false; status: 400 | 403 | 404; body: Refusal | { error: string } };

const NOT_FOUND = { ok: false, status: 404, body: { error: 'Not found' } } as const;

/** A refused link or unlink: a reconciled transaction is forbidden, the rest are bad requests */
const refused = (r: Refusal): LinkResult => ({
  ok: false,
  status: r.code === 'transaction_reconciled' ? 403 : 400,
  body: r,
});

/** Most candidates offered for one transaction (the nearest in date) */
export const MAX_TRANSFER_CANDIDATES = 100;

function loadSide(id: string): TransferSide | undefined {
  const found = db
    .select({ row: transactions, currency: accounts.currency })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(eq(transactions.id, id))
    .get();
  return found && { ...found.row, currency: found.currency };
}

/**
 * Links two existing transactions as a transfer: both lose their category and point at each
 * other. Each keeps its own account, date, payee text and amount. Refusals: see `linkRefusal`.
 * The order of the two ids doesn't matter; the result is `[first, second]` as saved.
 */
export function linkAsTransfer(id: string, otherId: string): LinkResult {
  return db.transaction((tx) => {
    const a = loadSide(id);
    const b = loadSide(otherId);
    if (!a || !b) return NOT_FOUND;
    const why = linkRefusal(a, b);
    if (why) return refused(why);

    for (const [side, other] of [
      [a, b],
      [b, a],
    ]) {
      tx.update(transactions)
        .set({ transferTransactionId: other.id, categoryId: null })
        .where(eq(transactions.id, side.id))
        .run();
    }
    return { ok: true, transactions: [loadSide(a.id)!, loadSide(b.id)!] };
  });
}

/**
 * Unlinks a transfer from either side: both become ordinary, uncategorized transactions that
 * keep their amounts. Refused (403) when either side is reconciled, (400) when the transaction
 * is not a transfer. The result is `[this side, the other side]`.
 */
export function unlinkTransfer(id: string): LinkResult {
  return db.transaction((tx) => {
    const side = loadSide(id);
    if (!side) return NOT_FOUND;
    if (!side.transferTransactionId) {
      return refused(refusal('not_a_transfer', 'This transaction is not a transfer'));
    }
    const other = loadSide(side.transferTransactionId);
    if (side.reconciled === 1 || other?.reconciled === 1) {
      return refused(RECONCILED);
    }
    for (const t of [side, other]) {
      if (!t) continue;
      tx.update(transactions)
        .set({ transferTransactionId: null, categoryId: null })
        .where(eq(transactions.id, t.id))
        .run();
    }
    // A transfer whose other side is gone still unlinks; it answers with itself twice
    const now = loadSide(side.id)!;
    return { ok: true, transactions: [now, (other && loadSide(other.id)) ?? now] };
  });
}

/**
 * Transactions that could be the other side of `id` (see `isTransferCandidate`), nearest in
 * date first, at most `MAX_TRANSFER_CANDIDATES`. Null when the transaction doesn't exist;
 * empty when it can't be linked itself.
 */
export function transferCandidates(id: string): TransferSide[] | null {
  const of = loadSide(id);
  if (!of) return null;
  const found = db
    .select({ row: transactions, currency: accounts.currency })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        ne(transactions.accountId, of.accountId),
        isNull(transactions.transferTransactionId),
        isNull(transactions.parentTransactionId),
        eq(transactions.isParent, 0),
        ne(transactions.reconciled, 1),
        of.amount < 0 ? sql`${transactions.amount} > 0` : sql`${transactions.amount} < 0`,
      ),
    )
    .orderBy(sql`abs(julianday(${transactions.date}) - julianday(${of.date}))`)
    .limit(MAX_TRANSFER_CANDIDATES)
    .all()
    .map((r) => ({ ...r.row, currency: r.currency }));
  // The pure rule decides; the query above only keeps the list short
  return found.filter((other) => isTransferCandidate(of, other)).sort(byNearestDate(of.date));
}
