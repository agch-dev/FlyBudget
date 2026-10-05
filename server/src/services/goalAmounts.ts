import { HOME_CURRENCY, isCurrency, type Currency } from '../utils/currency.js';
import type { Convert } from './currencyConversion.js';

// A goal's currency and its amounts in pesos. Pure: goals, accounts and a converter in,
// figures out. The Goals page shows each goal in its own currency and adds the goals up in
// pesos at today's rate (docs/adr/0001: converted when read, never stored).

/**
 * The currency a goal's amounts are in. A goal that follows a linked account is in that
 * account's currency, whatever the goal itself has stored; with no account it is the one the
 * user chose.
 */
export function goalCurrency(
  goal: { currency: string },
  linkedAccount: { currency: string } | null | undefined,
): Currency {
  const currency = linkedAccount?.currency ?? goal.currency;
  return isCurrency(currency) ? currency : HOME_CURRENCY;
}

export interface GoalInPesos {
  target: number;
  saved: number;
  /** Never negative, and `target - saved` otherwise, so the page's cards add up */
  remaining: number;
}

/**
 * A goal's target, saved amount and what is left, in pesos at the rate of `today`. Null when
 * a dollar goal can't be converted (no exchange rate stored).
 */
export function goalInPesos(
  goal: { targetAmount: number; currentAmount: number },
  currency: Currency,
  convert: Convert,
  today: string,
): GoalInPesos | null {
  const target = convert(goal.targetAmount, currency, HOME_CURRENCY, today);
  const saved = convert(goal.currentAmount, currency, HOME_CURRENCY, today);
  if (target === null || saved === null) return null;
  return { target, saved, remaining: Math.max(0, target - saved) };
}
