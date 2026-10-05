import { impliedRate } from '../utils/currency.js';
import { daysApart, isTransferCandidate, type LinkSide } from './transferLink.js';

// Transfer suggestions: pairs of unlinked transactions that look like the two sides of a
// transfer. Pure: the database side is in transferSuggestionService.ts. A suggestion is only
// ever offered; linking it is the user's decision (`linkAsTransfer`).

/** The two sides of a suggestion are dated at most this many days apart */
export const SUGGESTION_WINDOW_DAYS = 3;

/** Between currencies, how far pesos ÷ dollars may be from the exchange rate (3%) */
export const RATE_TOLERANCE = 0.03;

export interface TransferSuggestion<T extends LinkSide = LinkSide> {
  /** The money leaving one account */
  outflow: T;
  /** The money arriving in the other */
  inflow: T;
  /** Pesos per dollar the two amounts imply; null within one currency */
  rate: number | null;
}

/** One key for a pair of transactions, whichever is named first */
export function pairKey(id: string, otherId: string): string {
  return id < otherId ? `${id}:${otherId}` : `${otherId}:${id}`;
}

interface Ranked<T extends LinkSide> extends TransferSuggestion<T> {
  days: number;
  /** How far the implied rate is from the exchange rate, as a share of it (0 in one currency) */
  rateGap: number;
}

/** This outflow and inflow as a suggestion, or null when they don't look like a transfer */
function rank<T extends LinkSide>(
  outflow: T,
  inflow: T,
  rateOn: (date: string) => number | null,
): Ranked<T> | null {
  if (!isTransferCandidate(outflow, inflow)) return null;
  const days = daysApart(outflow.date, inflow.date);
  if (days > SUGGESTION_WINDOW_DAYS) return null;

  if (outflow.currency === inflow.currency) {
    return inflow.amount === -outflow.amount
      ? { outflow, inflow, rate: null, days, rateGap: 0 }
      : null;
  }
  const rate = impliedRate(outflow, inflow);
  // The rate of the day the money left: the bank converted it then
  const expected = rateOn(outflow.date);
  if (rate === null || expected === null || !(expected > 0)) return null;
  const rateGap = Math.abs(rate - expected) / expected;
  // The margin keeps an amount exactly 3% away inside, whatever the division rounded to
  if (rateGap > RATE_TOLERANCE + 1e-9) return null;
  return { outflow, inflow, rate, days, rateGap };
}

const byId = (a: LinkSide, b: LinkSide) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The transfers to suggest among `transactions` (each with its account's currency):
 *
 * - within one currency, an outflow and an inflow in different accounts with equal opposite
 *   amounts;
 * - between currencies, an outflow and an inflow whose pesos ÷ dollars is within
 *   `RATE_TOLERANCE` of `rateOn(the outflow's date)` (pesos per dollar, null when unknown:
 *   then nothing is suggested for that day);
 *
 * dated at most `SUGGESTION_WINDOW_DAYS` apart. Transfers, reconciled transactions, split
 * parents and split parts are never considered, nor pairs in `dismissed` (`pairKey`s).
 *
 * A transaction is in at most one suggestion: the best-ranked pairs are taken first (closest
 * dates, then closest rate), and a pair is dropped when either side is already taken. The
 * result is newest first and does not depend on the order of `transactions`.
 */
export function suggestTransfers<T extends LinkSide>(
  transactions: readonly T[],
  rateOn: (date: string) => number | null,
  dismissed: ReadonlySet<string> = new Set(),
): TransferSuggestion<T>[] {
  const outflows = transactions.filter((t) => t.amount < 0);
  // ISO dates sort as text
  const inflows = transactions
    .filter((t) => t.amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const ranked: Ranked<T>[] = [];
  for (const outflow of outflows) {
    // The first inflow that could be within the window: dated on or after the outflow's
    // date minus the window. Days apart only grow with the date, on either side.
    let low = 0;
    let high = inflows.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const tooEarly =
        inflows[mid].date < outflow.date &&
        daysApart(inflows[mid].date, outflow.date) > SUGGESTION_WINDOW_DAYS;
      if (tooEarly) low = mid + 1;
      else high = mid;
    }
    for (let i = low; i < inflows.length; i++) {
      const inflow = inflows[i];
      if (
        inflow.date > outflow.date &&
        daysApart(inflow.date, outflow.date) > SUGGESTION_WINDOW_DAYS
      ) {
        break;
      }
      if (dismissed.has(pairKey(outflow.id, inflow.id))) continue;
      const pair = rank(outflow, inflow, rateOn);
      if (pair) ranked.push(pair);
    }
  }

  ranked.sort(
    (a, b) =>
      a.days - b.days ||
      a.rateGap - b.rateGap ||
      byId(a.outflow, b.outflow) ||
      byId(a.inflow, b.inflow),
  );
  const taken = new Set<string>();
  const suggestions: TransferSuggestion<T>[] = [];
  for (const { outflow, inflow, rate } of ranked) {
    if (taken.has(outflow.id) || taken.has(inflow.id)) continue;
    taken.add(outflow.id).add(inflow.id);
    suggestions.push({ outflow, inflow, rate });
  }

  const newest = (s: TransferSuggestion<T>) =>
    s.outflow.date > s.inflow.date ? s.outflow.date : s.inflow.date;
  return suggestions.sort(
    (a, b) =>
      (newest(a) < newest(b) ? 1 : newest(a) > newest(b) ? -1 : 0) ||
      byId(a.outflow, b.outflow) ||
      byId(a.inflow, b.inflow),
  );
}
