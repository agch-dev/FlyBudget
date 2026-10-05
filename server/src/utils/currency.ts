import { z } from 'zod';

// Keep in sync with CURRENCIES in client/src/types/index.ts
/** Uruguayan pesos and US dollars: the only currencies an account can hold. */
export const CURRENCIES = ['UYU', 'USD'] as const;

export type Currency = (typeof CURRENCIES)[number];

/** The currency the budget is planned in and combined totals are shown in. It is fixed. */
export const HOME_CURRENCY: Currency = 'UYU';

/** There are exactly two currencies: the one an amount is not in is the one it converts to. */
export function otherCurrency(currency: Currency): Currency {
  return currency === 'UYU' ? 'USD' : 'UYU';
}

export const currencySchema = z.enum(CURRENCIES);

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency);
}

/**
 * The currency a combined total is asked for in, from a request's `currency` query parameter:
 * pesos when it is left out, null when it is neither pesos nor dollars (answer 400).
 */
export function targetCurrencyParam(value: unknown): Currency | null {
  if (value === undefined) return HOME_CURRENCY;
  return isCurrency(value) ? value : null;
}

/** An amount in integer cents and the currency it is in (its account's) */
export interface NativeAmount {
  amount: number;
  currency: Currency;
}

/**
 * The exchange rate two native amounts imply, in pesos per dollar: $ 40,000 against US$ 1,000
 * is 40. The order and the signs don't matter. Null when both are in the same currency, or
 * when either is zero.
 */
export function impliedRate(a: NativeAmount, b: NativeAmount): number | null {
  if (a.currency === b.currency) return null;
  const [pesos, dollars] = a.currency === HOME_CURRENCY ? [a, b] : [b, a];
  if (pesos.amount === 0 || dollars.amount === 0) return null;
  return Math.abs(pesos.amount / dollars.amount);
}
