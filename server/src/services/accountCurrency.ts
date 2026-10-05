import { eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, goals, schedules, transactions } from '../db/schema.js';
import { HOME_CURRENCY, isCurrency, type Currency } from '../utils/currency.js';

// Amounts are native amounts in their account's currency. Rules and recurring items work on
// those amounts, so they need to know which currency an account is in: closed accounts
// included, and the home currency when there is no account (a recurring item without one).

type AccountId = string | null | undefined;

const orHome = (currency: unknown): Currency => (isCurrency(currency) ? currency : HOME_CURRENCY);

/** The currency of an account that must exist: undefined when there is no such account. */
export function existingAccountCurrency(accountId: string): Currency | undefined {
  const account = db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();
  return account && orHome(account.currency);
}

/** One account's currency. Use `accountCurrencyLookup` when asking for many. */
export function accountCurrency(accountId: AccountId): Currency {
  return (accountId && existingAccountCurrency(accountId)) || HOME_CURRENCY;
}

/** Every account's currency, loaded once: returns a function from account id to currency. */
export function accountCurrencyLookup(): (accountId: AccountId) => Currency {
  const byId = new Map(
    db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .all()
      .map((a) => [a.id, a.currency]),
  );
  return (accountId) => (accountId ? orHome(byId.get(accountId)) : HOME_CURRENCY);
}

/** What stops an account's currency from changing */
export type CurrencyLock = 'transactions' | 'recurring' | 'goal';

/**
 * What ties each account to its currency, loaded once: its transactions (their amounts are
 * native amounts), a recurring item that pays from or into it (its amount is native too, and
 * a recurring transfer can't cross currencies), or a goal linked to it (the goal's amounts
 * follow the account). Null when nothing does, so the currency can still change.
 */
export function currencyLockLookup(): (accountId: string) => CurrencyLock | null {
  const ids = (rows: { id: string | null }[]) => new Set(rows.map((r) => r.id));
  const withTransactions = ids(
    db.selectDistinct({ id: transactions.accountId }).from(transactions).all(),
  );
  // A canceled item creates nothing, and "Delete" on the Recurring page only cancels
  const live = ne(schedules.status, 'canceled');
  const recurring = ids([
    ...db.selectDistinct({ id: schedules.accountId }).from(schedules).where(live).all(),
    ...db.selectDistinct({ id: schedules.transferAccountId }).from(schedules).where(live).all(),
  ]);
  const withGoals = ids(db.selectDistinct({ id: goals.accountId }).from(goals).all());
  return (accountId) =>
    withTransactions.has(accountId)
      ? 'transactions'
      : recurring.has(accountId)
        ? 'recurring'
        : withGoals.has(accountId)
          ? 'goal'
          : null;
}

/** Why the currency can't change, in words for the user */
export const CURRENCY_LOCK_MESSAGE: Record<CurrencyLock, string> = {
  transactions: "An account's currency can't change once it has transactions",
  recurring:
    "An account's currency can't change while a recurring item uses it: move or delete the recurring item first",
  goal: "An account's currency can't change while a goal is linked to it: unlink the goal first",
};
