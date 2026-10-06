import type { Currency } from '../utils/currency.js';
import { refusal, type Refusal } from '../utils/refusals.js';
import { RECONCILED } from './transactionRefusals.js';

// Which two existing transactions can be linked as a transfer. Pure: the database side is in
// transferLinkService.ts.

/** What the rules need to know about a transaction; `currency` is its account's */
export interface LinkSide {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  currency: Currency;
  reconciled: number;
  isParent: number;
  parentTransactionId: string | null;
  transferTransactionId: string | null;
}

/** Why this transaction can't be either side of a new transfer, whatever the other side is */
export function sideRefusal(t: LinkSide): Refusal | null {
  if (t.reconciled === 1) return RECONCILED;
  if (t.isParent === 1 || t.parentTransactionId) {
    return refusal(
      'link_split',
      'A split transaction and its parts cannot be linked as a transfer',
    );
  }
  if (t.transferTransactionId) {
    return refusal(
      'link_already_transfer',
      'This transaction is already a transfer: unlink it first',
    );
  }
  return null;
}

/**
 * Why these two transactions can't be linked as a transfer, or null when they can. A transfer
 * is money leaving one account and arriving in another: within one currency the same amount
 * on both sides, between a pesos and a dollars account each side its own.
 */
export function linkRefusal(a: LinkSide, b: LinkSide): Refusal | null {
  const side = sideRefusal(a) ?? sideRefusal(b);
  if (side) return side;
  if (a.id === b.id || a.accountId === b.accountId) {
    return refusal(
      'link_different_accounts',
      'A transfer needs two transactions in different accounts',
    );
  }
  if (Math.sign(a.amount) * Math.sign(b.amount) !== -1) {
    return refusal(
      'link_outflow_and_inflow',
      'A transfer needs money leaving one account and arriving in the other: choose an outflow and an inflow',
    );
  }
  if (a.currency === b.currency && a.amount !== -b.amount) {
    return refusal(
      'link_same_amount',
      'These accounts have the same currency, so both transactions must be for the same amount',
    );
  }
  return null;
}

/**
 * Whether `other` is offered as the other side when linking `of`: another unlinked transaction
 * of the opposite direction in another account. The amount is not compared, so a same-currency
 * candidate of a different amount is offered and then refused by `linkRefusal` with its reason.
 */
export function isTransferCandidate(of: LinkSide, other: LinkSide): boolean {
  return (
    sideRefusal(of) === null &&
    sideRefusal(other) === null &&
    other.id !== of.id &&
    other.accountId !== of.accountId &&
    Math.sign(of.amount) * Math.sign(other.amount) === -1
  );
}

const dayNumber = (isoDay: string) => Date.parse(`${isoDay}T00:00:00Z`) / 86_400_000;

/** Days between two `YYYY-MM-DD` dates, never negative */
export function daysApart(a: string, b: string): number {
  return Math.abs(dayNumber(a) - dayNumber(b));
}

/** Sorts candidates nearest in date to `date` first; on a tie the earlier date, then the id */
export function byNearestDate(date: string) {
  return (a: LinkSide, b: LinkSide) =>
    daysApart(a.date, date) - daysApart(b.date, date) ||
    a.date.localeCompare(b.date) ||
    a.id.localeCompare(b.id);
}
