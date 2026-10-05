import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { HOME_CURRENCY } from '../utils/currency.js';

// A split is stored as a parent row holding the full amount plus child rows holding
// the parts, all in the same account. Account balances count the parent only;
// category totals count the children only (the parent has no category).

/** Rows that make up an account's balance: everything except split children. */
export const inAccountBalance: SQL = isNull(transactions.parentTransactionId);

/**
 * Rows that are money earned or spent, for income and spending reports: everything except
 * balance corrections (reconciliation, "Update value") the user left without a category.
 * Balances and net worth still count those.
 */
export const isIncomeOrSpending: SQL = sql`not (${transactions.isAdjustment} = 1 and ${transactions.categoryId} is null)`;

/**
 * Accounts in the home currency (pesos). A total that combines accounts counts only these:
 * amounts are stored in each account's own currency, so adding a dollar account's amounts to
 * a pesos total would be wrong by the exchange rate. Dollar accounts are left out of every
 * combined total until those totals convert them (docs/adr/0001).
 */
export const homeCurrencyAccountIds = db
  .select({ id: accounts.id })
  .from(accounts)
  .where(eq(accounts.currency, HOME_CURRENCY));

/** Transactions in a home-currency account: add it to every query that sums across accounts. */
export const inHomeCurrency: SQL = inArray(transactions.accountId, homeCurrencyAccountIds);

/** Sum of an account's transactions, as added to its starting balance. */
export function accountTransactionSum(accountId: string): number {
  const row = db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), inAccountBalance))
    .get();
  return row?.sum ?? 0;
}
