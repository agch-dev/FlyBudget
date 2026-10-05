import { format, parseISO } from 'date-fns';
import { HOME_CURRENCY, type Currency } from '../types';
import { formatCurrency } from './currency';

// Converted amounts on the client. The server converts (a transaction at the exchange rate of
// its own date, docs/adr/0001) and sends the result with each transaction as `convertedAmount`:
// the amount in the other currency. Nothing here knows a rate; it only picks the right number.

/** Something with a native amount, and what the server says it is in the other currency */
export interface Convertible {
  amount: number;
  /** The currency `amount` is in; pesos when missing */
  currency?: Currency;
  /** `amount` in the other currency; null or missing when it could not be converted */
  convertedAmount?: number | null;
}

/**
 * The amount in `currency`: the native amount when it is already in it, else the converted
 * one. Null when it would need converting and there is no converted amount (no exchange rate
 * stored yet, or a row the server hasn't sent back, like one waiting to be saved).
 */
export function amountIn(item: Convertible, currency: Currency): number | null {
  if ((item.currency ?? HOME_CURRENCY) === currency) return item.amount;
  return item.convertedAmount ?? null;
}

/**
 * Sum of the items in `currency`, each converted at its own date. `amount` shapes each
 * figure before it is added (`Math.abs` for a list that adds sizes). Items that cannot be
 * converted are left out. Use it for any client-side total across accounts.
 */
export function totalIn(
  items: readonly Convertible[],
  currency: Currency,
  amount: (cents: number) => number = (cents) => cents,
): number {
  return items.reduce((sum, item) => {
    const cents = amountIn(item, currency);
    return cents === null ? sum : sum + amount(cents);
  }, 0);
}

/**
 * Total for a list of transactions that may come from several accounts (a day in the
 * register, a category's transactions). When they are all in one currency it is their sum in
 * that currency; when the list mixes currencies it is in pesos, dollars converted.
 */
export function listTotal(
  items: readonly Convertible[],
  amount: (cents: number) => number,
): { currency: Currency; total: number } {
  const first = items[0]?.currency ?? HOME_CURRENCY;
  const currency = items.every((item) => (item.currency ?? HOME_CURRENCY) === first)
    ? first
    : HOME_CURRENCY;
  return { currency, total: totalIn(items, currency, amount) };
}

/**
 * What to show next to a native amount that feeds a total in another currency: "$2,000 at the
 * exchange rate of Mar 3, 2026". Null when the amount is already in `totalCurrency` (nothing
 * to add) or cannot be converted. Show it on hover (`title`) in lists and as a line under the
 * amount in a detail view.
 */
export function convertedNote(
  item: Convertible & { date: string },
  totalCurrency: Currency,
): string | null {
  if ((item.currency ?? HOME_CURRENCY) === totalCurrency) return null;
  const converted = amountIn(item, totalCurrency);
  if (converted === null) return null;
  const day = format(parseISO(item.date), 'MMM d, yyyy');
  return `${formatCurrency(Math.abs(converted), totalCurrency)} at the exchange rate of ${day}`;
}
