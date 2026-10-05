import type { Currency } from '../types';
import { accountTypeInfo } from './accountTypes';

// A card statement can list pesos and dollars purchases in one file, while each account
// holds one currency: the rows of the other currency go to another account.

/** What choosing a destination needs from an account */
export interface DestinationAccount {
  id: string;
  type: string;
  currency: Currency;
  groupName?: string | null;
  closedAt: string | null;
}

/** The open accounts that rows in `currency` can go to when importing into `into` */
export function destinationAccounts<A extends DestinationAccount>(
  into: A,
  accounts: readonly A[],
  currency: Currency,
): A[] {
  return accounts.filter((a) => a.id !== into.id && a.currency === currency && !a.closedAt);
}

/**
 * The account the other currency's rows most likely belong to: the only one of the same
 * type in the same Account Group (the dollars side of the card). Null when there is none
 * or more than one (a group can hold a whole bank), so nothing is sent to a guessed account.
 */
export function defaultDestination<A extends DestinationAccount>(
  into: A,
  accounts: readonly A[],
  currency: Currency,
): string | null {
  const group = into.groupName?.toLowerCase();
  if (!group) return null;
  const matches = destinationAccounts(into, accounts, currency).filter(
    (a) => a.groupName?.toLowerCase() === group && a.type === into.type,
  );
  return matches.length === 1 ? matches[0].id : null;
}

/** Whether statements of this kind of account usually write purchases as positive amounts */
export function isCardType(type: string): boolean {
  return accountTypeInfo(type).group === 'credit';
}
