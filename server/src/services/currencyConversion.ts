import { HOME_CURRENCY, type Currency } from '../utils/currency.js';
import { rateLookup, type RatePoint } from './exchangeRates.js';

// The conversion rule (docs/adr/0001): stored facts are native amounts and the exchange rates;
// a converted amount is computed when it is read and never stored. A transaction converts at
// the exchange rate of its own date. Pure: rates in, amounts out.
//
// services/convertedAmounts.ts states the same rule in SQL for queries that sum transactions;
// a property test there holds the two to the same answer for any amounts and rates.

/**
 * A native amount (integer cents) in another currency, at `rate` pesos per dollar. A
 * same-currency amount passes through unchanged. The result is whole cents, halves rounded
 * away from zero, so money out converts as the mirror of money in.
 */
export function convertCents(cents: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) return cents;
  // Pesos per dollar: dollars → pesos multiplies, pesos → dollars divides
  const exact = to === HOME_CURRENCY ? cents * rate : cents / rate;
  const rounded = Math.sign(exact) * Math.floor(Math.abs(exact) + 0.5);
  return rounded === 0 ? 0 : rounded;
}

/**
 * The rate each date converts at: its own, else the closest earlier one. A date before every
 * stored rate has no earlier one and uses the closest rate there is, the earliest; with no
 * rates at all there is none (null).
 *
 * This is the one place that decides what a date without an earlier rate uses (`rateOnSql` in
 * convertedAmounts.ts is its SQL twin).
 */
export function conversionRates(rates: readonly RatePoint[]): (date: string) => number | null {
  const lookup = rateLookup(rates);
  let earliest: RatePoint | null = null;
  for (const r of rates) if (!earliest || r.date < earliest.date) earliest = r;
  return (date) => (lookup(date) ?? earliest)?.rate ?? null;
}

/** Converts an amount dated `date`; null when the currencies differ and no rate is stored. */
export type Convert = (cents: number, from: Currency, to: Currency, date: string) => number | null;

/**
 * Converts amounts at the rate of their own date. Build it once per request from every stored
 * rate (`listRates()`), then call it per amount.
 */
export function converter(rates: readonly RatePoint[]): Convert {
  const rateOn = conversionRates(rates);
  return (cents, from, to, date) => {
    if (from === to) return cents;
    const rate = rateOn(date);
    return rate === null ? null : convertCents(cents, from, to, rate);
  };
}
