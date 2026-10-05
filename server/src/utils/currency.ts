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
