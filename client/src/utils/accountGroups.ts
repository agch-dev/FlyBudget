import type { Currency } from '../types';
import { balanceIn, type DatedRate } from './balanceConversion';

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
 * What makes two group names the same group: the server stores one spelling per group
 * (`resolveGroupName`, case-insensitive), but accounts that reach the client another way (a
 * restored backup, an older offline copy) can still differ in case.
 */
const groupKey = (name: string) => name.toLowerCase();

/**
 * A list of accounts as it is shown: each group once, where its first account was, holding
 * its accounts in their order; accounts with no group stay where they are. Names that differ
 * only in case are one group, shown under its first account's spelling. Call it with the
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
    const members = groups.get(groupKey(name));
    if (members) {
      members.push(account);
    } else {
      const first = [account];
      groups.set(groupKey(name), first);
      entries.push({ kind: 'group', name, accounts: first });
    }
  }
  return entries;
}

/** The groups in use, in alphabetical order: what an account's dialog offers to choose from */
export function accountGroupNames(accounts: readonly GroupableAccount[]): string[] {
  const names = new Map<string, string>();
  for (const { groupName } of accounts) {
    if (groupName && !names.has(groupKey(groupName))) names.set(groupKey(groupName), groupName);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export interface GroupTotal {
  currency: Currency;
  total: number;
  /** False when a balance in another currency was left out because there is no rate */
  complete: boolean;
}

/**
 * A group's combined balance in `to` (the viewing currency) on `date`: every account's
 * balance, the ones in another currency converted at that day's rate (`rates` from
 * `useExchangeRates`). The one place a group's total is worked out; the conversion is the
 * shared balance rule (`balanceIn`, utils/balanceConversion.ts), so it always agrees with the
 * sidebar's section totals and net worth for the same accounts.
 */
export function groupTotal(
  accounts: readonly GroupableAccount[],
  to: Currency,
  date: string,
  rates: readonly DatedRate[],
): GroupTotal {
  let total = 0;
  let complete = true;
  for (const account of accounts) {
    const converted = balanceIn(account.balance, account.currency, to, date, rates);
    if (converted === null) complete = false;
    else total += converted;
  }
  return { currency: to, total, complete };
}

/** The open groups after clicking `name`'s row: opened if it was closed, closed if open */
export function toggleGroupOpen(open: readonly string[], name: string): string[] {
  return open.includes(name) ? open.filter((n) => n !== name) : [...open, name];
}
