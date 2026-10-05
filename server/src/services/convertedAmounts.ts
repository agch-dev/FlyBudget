import { sql, type SQL } from 'drizzle-orm';
import { HOME_CURRENCY, type Currency } from '../utils/currency.js';

// The conversion rule of currencyConversion.ts, in SQL, for queries that add up transactions
// from accounts of different currencies (docs/adr/0001: converted when read, never stored).
// Each transaction converts at the exchange rate of its own date, to whole cents, and only
// then is it summed, so a total is always the sum of the converted amounts its rows show.
//
// Everything here refers to the `transactions` table by name and brings its own lookups of
// the account's currency and the rate, so it drops into any query that selects from
// `transactions` (not an aliased copy of it), with or without joins.

// Written out, not `${transactions.date}`: Drizzle renders a column of a single-table query
// without its table, and inside the subqueries below a bare "date" would mean the rate's.
const txDate = sql.raw('"transactions"."date"');
const txAmount = sql.raw('"transactions"."amount"');
const txAccountId = sql.raw('"transactions"."account_id"');

/**
 * The rate a date converts at: its own, else the closest earlier one; a date before every
 * stored rate uses the earliest (an estimate); NULL when no rates are stored. The SQL twin of
 * `rateLookupOrEstimate` (exchangeRates.ts), which `conversionRates` uses: change the two
 * together.
 */
export function rateOnSql(date: SQL): SQL<number | null> {
  return sql<number | null>`coalesce(
    (select er.rate from exchange_rates er where er.date <= ${date} order by er.date desc limit 1),
    (select er.rate from exchange_rates er order by er.date asc limit 1)
  )`;
}

/**
 * A transaction's amount in `target`, converted at the rate of its own date (unchanged when
 * its account is already in `target`). NULL only when it needs a rate and none is stored.
 * SQLite's `round` rounds halves away from zero, like `convertCents`.
 *
 * Use it wherever a query used `transactions.amount` for a total across accounts:
 * `sum(max(${convertedAmount(target)}, 0))`, or `convertedSum(target)` for a plain total.
 */
export function convertedAmount(target: Currency): SQL<number | null> {
  const rate = rateOnSql(txDate);
  // Pesos per dollar: dollars → pesos multiplies, pesos → dollars divides
  const converted =
    target === HOME_CURRENCY ? sql`${txAmount} * ${rate}` : sql`${txAmount} / ${rate}`;
  return sql<number | null>`(case
    when (select ca.currency from accounts ca where ca.id = ${txAccountId}) = ${target}
      then ${txAmount}
    else cast(round(${converted}) as integer)
  end)`;
}

/**
 * Total of the query's transactions in `target`, each converted at its own date; 0 for no
 * rows. A transaction that cannot be converted (no rates stored at all) is left out.
 */
export function convertedSum(target: Currency): SQL<number> {
  return sql<number>`coalesce(sum(${convertedAmount(target)}), 0)`;
}
