// all money is integer cents — convert at the UI edges only
import { CURRENCIES, HOME_CURRENCY, type Currency } from '../types';

export function centsToInput(cents: number): string {
  return cents === 0 ? '' : (Math.abs(cents) / 100).toFixed(2);
}

export function parseCents(s: string): number {
  const cents = Math.round(parseFloat(s) * 100);
  // NaN, Infinity (e.g. "1e400"), and amounts too large to store exactly are invalid
  return Number.isSafeInteger(cents) ? cents : 0;
}

const SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.value, c.symbol])) as Record<
  Currency,
  string
>;

/** How a currency is written in front of an amount: `$` for pesos, `US$` for dollars. */
export function currencySymbol(currency: Currency = HOME_CURRENCY): string {
  return SYMBOLS[currency] ?? SYMBOLS[HOME_CURRENCY];
}

// Made once: toLocaleString builds a new formatter on every call, and charts format thousands
const wholeDollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "$1,234.56" or "US$1,234.56". Pass the account's currency for a native amount (one account's
 * balance or transaction); leave it out for combined totals, which are in the home currency.
 */
export function formatCurrency(cents: number, currency: Currency = HOME_CURRENCY): string {
  const sym = currencySymbol(currency);
  const abs = Math.abs(cents);
  const formatted = (abs % 100 === 0 ? wholeDollars : withCents).format(abs / 100);
  return cents < 0 ? `-${sym}${formatted}` : `${sym}${formatted}`;
}

/**
 * The exchange rate two native amounts imply, in pesos per dollar: $ 40,000 against US$ 1,000
 * is 40. The order and the signs don't matter. Null when both are in the same currency, or
 * while either is still zero. (The server has the same function in `utils/currency.ts`.)
 */
export function impliedRate(
  a: { amount: number; currency?: Currency },
  b: { amount: number; currency?: Currency },
): number | null {
  const currencyOf = (x: { currency?: Currency }) => x.currency ?? HOME_CURRENCY;
  if (currencyOf(a) === currencyOf(b)) return null;
  const [pesos, dollars] = currencyOf(a) === HOME_CURRENCY ? [a, b] : [b, a];
  if (pesos.amount === 0 || dollars.amount === 0) return null;
  return Math.abs(pesos.amount / dollars.amount);
}

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

/** Short axis label: "$950", "$12.5k", "-$1.2M". Thresholds sit where rounding would reach the next unit. */
export function formatCentsAxis(cents: number, currency: Currency = HOME_CURRENCY): string {
  const sym = currencySymbol(currency);
  const sign = cents < 0 ? '-' : '';
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 999_950) return `${sign}${sym}${oneDecimal(dollars / 1_000_000)}M`;
  if (dollars >= 999.5) return `${sign}${sym}${oneDecimal(dollars / 1_000)}k`;
  return `${sign}${sym}${Math.round(dollars)}`;
}

/**
 * The items a combined total may add up: those in the home currency (pesos). Amounts are
 * stored in each account's own currency, so adding a dollar amount to a pesos one would be
 * wrong by the exchange rate; dollar accounts stay out of combined totals until those
 * totals convert them (docs/adr/0001). Something with no currency counts as pesos.
 */
export function inHomeCurrency<T extends { currency?: Currency }>(items: readonly T[]): T[] {
  return items.filter((item) => (item.currency ?? HOME_CURRENCY) === HOME_CURRENCY);
}

/** Sum of `amount` over the items in the home currency. Use it for every total across accounts. */
export function homeCurrencyTotal<T extends { currency?: Currency }>(
  items: readonly T[],
  amount: (item: T) => number,
): number {
  return inHomeCurrency(items).reduce((sum, item) => sum + amount(item), 0);
}

/**
 * Total for a list of transactions that may come from several accounts (a day in the
 * register, a category's transactions). When they are all in one currency it is their sum in
 * that currency; when the list mixes currencies, only the pesos are added.
 */
export function listTotal<T extends { currency?: Currency }>(
  items: readonly T[],
  amount: (item: T) => number,
): { currency: Currency; total: number } {
  const first = items[0]?.currency ?? HOME_CURRENCY;
  const currency = items.every((item) => (item.currency ?? HOME_CURRENCY) === first)
    ? first
    : HOME_CURRENCY;
  const total = items
    .filter((item) => (item.currency ?? HOME_CURRENCY) === currency)
    .reduce((sum, item) => sum + amount(item), 0);
  return { currency, total };
}
