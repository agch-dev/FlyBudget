import { CURRENCIES, HOME_CURRENCY, type Currency } from '../types';
import { formatCurrency } from './currency';
import { t } from '../i18n';

// Balances across currencies (docs/adr/0001). A balance converts at the exchange rate of the
// day it is shown for (today, for the sidebar totals), unlike a transaction, which the server
// converts at the rate of its own date (utils/conversion.ts). The rule is the server's
// (services/currencyConversion.ts): the client needs it because account balances arrive in
// their native amounts and the page already holds every rate (`useExchangeRates`).
// Pure: balances, rates and a day in, amounts out.

/** A stored exchange rate: pesos per dollar on a date (YYYY-MM-DD) */
export interface DatedRate {
  date: string;
  rate: number;
}

/**
 * The rate a day converts at: its own, else the closest earlier one; a day before every stored
 * rate uses the earliest one (an estimate). Null with no rates at all. The rates may be in
 * any order.
 */
export function rateOn(rates: readonly DatedRate[], date: string): number | null {
  let before: DatedRate | null = null;
  let earliest: DatedRate | null = null;
  for (const r of rates) {
    if (r.date <= date && (before === null || r.date > before.date)) before = r;
    if (earliest === null || r.date < earliest.date) earliest = r;
  }
  return (before ?? earliest)?.rate ?? null;
}

/** Whole cents, halves away from zero: a negative balance converts as the mirror of a positive one */
function convertCents(cents: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) return cents;
  // Pesos per dollar: dollars → pesos multiplies, pesos → dollars divides
  const exact = to === HOME_CURRENCY ? cents * rate : cents / rate;
  const rounded = Math.sign(exact) * Math.floor(Math.abs(exact) + 0.5);
  return rounded === 0 ? 0 : rounded;
}

/**
 * A balance in currency `from` shown in currency `to` on `date` (YYYY-MM-DD), at that day's
 * rate. A balance already in `to` is unchanged; null when it needs converting and no rate is
 * stored.
 */
export function balanceIn(
  cents: number,
  from: Currency,
  to: Currency,
  date: string,
  rates: readonly DatedRate[],
): number | null {
  if (from === to) return cents;
  const rate = rateOn(rates, date);
  return rate === null ? null : convertCents(cents, from, to, rate);
}

/**
 * The total of several accounts' balances in `to` on `date`: each balance converted on its
 * own, then added, so the total is the sum of what the accounts would show. Balances that
 * cannot be converted are left out. An account with no currency counts as pesos.
 */
export function balancesTotal(
  accounts: readonly { balance: number; currency?: Currency }[],
  to: Currency,
  date: string,
  rates: readonly DatedRate[],
): number {
  const rate = rateOn(rates, date);
  return accounts.reduce((sum, account) => {
    const from = account.currency ?? HOME_CURRENCY;
    if (from === to) return sum + account.balance;
    return rate === null ? sum : sum + convertCents(account.balance, from, to, rate);
  }, 0);
}

/**
 * A total of account balances in `to` and how it moved since an earlier day: today's balances
 * at today's rate, the earlier ones (`balancesAgo`, by account id) at that day's rate, like
 * two points of net worth. An account with no earlier balance known counts as unchanged.
 */
export function totalAndChange(
  accounts: readonly { id: string; balance: number; currency?: Currency }[],
  balancesAgo: Readonly<Record<string, number>>,
  to: Currency,
  days: { today: string; ago: string },
  rates: readonly DatedRate[],
): { total: number; before: number; change: number } {
  const total = balancesTotal(accounts, to, days.today, rates);
  const before = balancesTotal(
    accounts.map((a) => ({ balance: balancesAgo[a.id] ?? a.balance, currency: a.currency })),
    to,
    days.ago,
    rates,
  );
  return { total, before, change: total - before };
}

/**
 * What a combined total is made of, each currency in its native amount: "$150,000 + US$3,200".
 * The currency the total is shown in comes first. Null when there is nothing in any other
 * currency (the total already says it all). A currency in `leftOut` could not be converted
 * (no exchange rate stored), so the total above the line does not include it: the line says
 * so instead of looking like a sum that doesn't add up (in the App Language: the component
 * showing the line calls `useTranslation()`).
 */
export function breakdownLine(
  native: Partial<Record<Currency, number>> | undefined,
  shownIn: Currency = HOME_CURRENCY,
  leftOut: readonly Currency[] = [],
): string | null {
  if (!native) return null;
  const others = CURRENCIES.map((c) => c.value).filter((c) => c !== shownIn);
  if (others.every((c) => !native[c] && !leftOut.includes(c))) return null;
  return others.reduce(
    (line, c) => {
      const cents = native[c] ?? 0;
      const amount = formatCurrency(Math.abs(cents), c);
      const part = leftOut.includes(c) ? t('accounts:breakdown.notCounted', { amount }) : amount;
      return `${line} ${cents < 0 ? '−' : '+'} ${part}`;
    },
    formatCurrency(native[shownIn] ?? 0, shownIn),
  );
}
