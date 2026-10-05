import { HOME_CURRENCY, type Currency } from '../types';

// Account Groups (GLOSSARY.md): accounts of the same real-world product, such as the pesos and
// dollars sides of one credit card, shown together. A group is only the name its accounts
// share (`Account.groupName`), so everything here is derived from the list of accounts.

/** What grouping needs from an account */
export interface GroupableAccount {
  id: string;
  /** Null or missing (an offline copy saved before groups existed) = no group */
  groupName?: string | null;
  balance: number;
  currency: Currency;
}

/** One row of an account list: a group with its accounts, or an account with no group */
export type AccountListEntry<A> =
  { kind: 'group'; name: string; accounts: A[] } | { kind: 'account'; account: A };

/**
 * A list of accounts as it is shown: each group once, where its first account was, holding
 * its accounts in their order; accounts with no group stay where they are. Call it with the
 * accounts of one section (on budget, off budget, a page) to get that section's groups.
 */
export function listAccountsByGroup<A extends GroupableAccount>(
  accounts: readonly A[],
): AccountListEntry<A>[] {
  const entries: AccountListEntry<A>[] = [];
  const groups = new Map<string, A[]>();
  for (const account of accounts) {
    const name = account.groupName;
    if (!name) {
      entries.push({ kind: 'account', account });
      continue;
    }
    const members = groups.get(name);
    if (members) {
      members.push(account);
    } else {
      const first = [account];
      groups.set(name, first);
      entries.push({ kind: 'group', name, accounts: first });
    }
  }
  return entries;
}

/** The groups in use, in alphabetical order: what an account's dialog offers to choose from */
export function accountGroupNames(accounts: readonly GroupableAccount[]): string[] {
  const names = new Set<string>();
  for (const account of accounts) if (account.groupName) names.add(account.groupName);
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export interface GroupTotal {
  currency: Currency;
  total: number;
  /** False when a balance in another currency was left out because there is no rate */
  complete: boolean;
}

/**
 * A group's combined balance: every account's native balance, the ones in another currency
 * converted at `todayRate` (pesos per dollar; null when no rate is stored). The one place a
 * group's total is worked out. It is in pesos; to follow a viewing currency, or to share the
 * net worth's balance conversion, change this function only.
 */
export function groupTotal(
  accounts: readonly GroupableAccount[],
  todayRate: number | null,
): GroupTotal {
  let total = 0;
  let complete = true;
  for (const account of accounts) {
    if (account.currency === HOME_CURRENCY) total += account.balance;
    else if (todayRate === null) complete = false;
    else total += dollarsToPesos(account.balance, todayRate);
  }
  return { currency: HOME_CURRENCY, total, complete };
}

/** Whole cents, halves away from zero: the server's `convertCents` rule for dollars → pesos */
function dollarsToPesos(cents: number, rate: number): number {
  const exact = cents * rate;
  const rounded = Math.sign(exact) * Math.floor(Math.abs(exact) + 0.5);
  return rounded === 0 ? 0 : rounded;
}

/** The open groups after clicking `name`'s row: opened if it was closed, closed if open */
export function toggleGroupOpen(open: readonly string[], name: string): string[] {
  return open.includes(name) ? open.filter((n) => n !== name) : [...open, name];
}
