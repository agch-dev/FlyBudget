import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts } from '../db/schema.js';
import { HOME_CURRENCY, isCurrency, type Currency } from '../utils/currency.js';

// Amounts are native amounts in their account's currency. Rules and recurring items work on
// those amounts, so they need to know which currency an account is in: closed accounts
// included, and the home currency when there is no account (a recurring item without one).

type AccountId = string | null | undefined;

const orHome = (currency: unknown): Currency => (isCurrency(currency) ? currency : HOME_CURRENCY);

/** One account's currency. Use `accountCurrencyLookup` when asking for many. */
export function accountCurrency(accountId: AccountId): Currency {
  if (!accountId) return HOME_CURRENCY;
  return orHome(
    db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get()?.currency,
  );
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
