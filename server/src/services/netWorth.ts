import { isLiabilityType } from '../utils/accountTypes.js';
import { CURRENCIES, type Currency } from '../utils/currency.js';
import type { Convert } from './currencyConversion.js';

// Net worth across currencies (docs/adr/0001). A balance converts at the exchange rate of the
// day it is shown for, unlike a transaction, which converts at the rate of its own date: so
// with no change in any balance, net worth moves when the dollar does. Pure: accounts, their
// balance changes and a converter in, points out.

export interface NetWorthAccount {
  id: string;
  type: string;
  currency: Currency;
  startingBalance: number;
}

/** What an account's transactions add up to within one period (a day or a month) */
export interface BalanceChange {
  accountId: string;
  /** Same format as the period keys it is compared with: YYYY-MM-DD or YYYY-MM */
  period: string;
  total: number;
}

export interface NetWorthPeriod {
  /** YYYY-MM-DD or YYYY-MM */
  key: string;
  /** The day the point is shown for: its balances convert at this day's rate (`dayShown`) */
  date: string;
}

export interface NetWorthPoint {
  /** The period's key: a day for daily points, despite the name */
  month: string;
  /** In the target currency */
  assets: number;
  liabilities: number;
  netWorth: number;
  /** What the total is made of: each currency's own net worth, in its native amount */
  native: Record<Currency, number>;
}

/**
 * The day a net worth point is shown for: a day is itself, a month is its last day, and
 * neither is ever after `today` (the month in progress is shown as of today, at today's rate).
 */
export function dayShown(period: string, today: string): string {
  let day = period;
  if (period.length === 7) {
    const [year, month] = period.split('-').map(Number);
    // Day 0 of the next month is the last day of this one
    day = `${period}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
  }
  return day < today ? day : today;
}

/**
 * Net worth at the end of each period, in `target`. Assets are the positive balances of
 * accounts that hold value, liabilities the negative balances of debts; each balance is
 * converted on its own (whole cents) and then added, so the total is the sum of what the
 * accounts show. A balance that cannot be converted (no rate stored) is left out of the total
 * and still listed in `native`. `periods` must be in ascending order.
 */
export function netWorthSeries({
  accounts,
  changes,
  periods,
  target,
  convert,
}: {
  accounts: readonly NetWorthAccount[];
  changes: readonly BalanceChange[];
  periods: readonly NetWorthPeriod[];
  target: Currency;
  convert: Convert;
}): NetWorthPoint[] {
  const byAccount = new Map<string, BalanceChange[]>();
  for (const change of changes) {
    const list = byAccount.get(change.accountId);
    if (list) list.push(change);
    else byAccount.set(change.accountId, [change]);
  }
  // Walk each account's changes alongside the (ascending) periods
  const cursors = accounts.map((account) => ({
    account,
    entries: (byAccount.get(account.id) ?? []).sort((a, b) => a.period.localeCompare(b.period)),
    next: 0,
    balance: account.startingBalance,
  }));

  return periods.map(({ key, date }) => {
    let assets = 0;
    let liabilities = 0;
    const native = Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<Currency, number>;
    for (const c of cursors) {
      while (c.next < c.entries.length && c.entries[c.next].period <= key) {
        c.balance += c.entries[c.next++].total;
      }
      const liability = isLiabilityType(c.account.type);
      // An overdrawn asset account, or a debt paid past zero, counts as nothing (as before)
      const counted = liability ? Math.min(c.balance, 0) : Math.max(c.balance, 0);
      if (counted === 0) continue;
      native[c.account.currency] += counted;
      const converted = convert(counted, c.account.currency, target, date);
      if (converted === null) continue;
      if (liability) liabilities -= converted;
      else assets += converted;
    }
    return { month: key, assets, liabilities, netWorth: assets - liabilities, native };
  });
}
