import { HOME_CURRENCY, type Currency, type ScheduleOccurrence } from '../types';
import { amountIn, convertedNote } from './conversion';
import { formatCurrency } from './currency';

// Totals over recurring items of both currencies. The server converts (docs/adr/0001) and
// sends each occurrence's amounts in the other currency: the expected amount at the rate of
// its date, or today's rate while that date is still to come, and what was paid at the rate
// of the day it was paid. Nothing here knows a rate.

/** The parts of an occurrence its totals need */
export type OccurrenceAmounts = Pick<
  ScheduleOccurrence,
  | 'displayStatus'
  | 'expectedDate'
  | 'expectedAmount'
  | 'matchedAmount'
  | 'currency'
  | 'convertedExpectedAmount'
  | 'convertedMatchedAmount'
>;

export interface OccurrenceTotals {
  total: number;
  paid: number;
  remaining: number;
}

const expected = (o: OccurrenceAmounts) => ({
  amount: o.expectedAmount,
  currency: o.currency,
  convertedAmount: o.convertedExpectedAmount,
});

/**
 * The Recurring page's summary in `currency`, items of the other currency converted. Paid uses
 * what was actually paid; remaining uses the expected amount of unpaid items. Skipped and
 * cancelled items don't count, and neither does one that cannot be converted (no rate stored).
 */
export function occurrenceTotals(
  occurrences: readonly OccurrenceAmounts[],
  currency: Currency,
): OccurrenceTotals {
  let paid = 0;
  let remaining = 0;
  for (const o of occurrences) {
    if (o.displayStatus === 'skipped' || o.displayStatus === 'cancelled') continue;
    const isPaid = o.displayStatus === 'paid';
    const cents = amountIn(
      isPaid && o.matchedAmount !== null
        ? {
            amount: o.matchedAmount,
            currency: o.currency,
            convertedAmount: o.convertedMatchedAmount,
          }
        : expected(o),
      currency,
    );
    if (cents === null) continue;
    if (isPaid) paid += Math.abs(cents);
    else remaining += Math.abs(cents);
  }
  return { total: paid + remaining, paid, remaining };
}

/**
 * What to show next to an occurrence's native expected amount where totals are in
 * `totalCurrency`: "$600 at today's exchange rate" while its date is still to come, else the
 * usual note naming its date. Null when it is already in `totalCurrency` or can't be converted.
 */
export function expectedNote(
  occurrence: OccurrenceAmounts,
  totalCurrency: Currency,
  today: string,
): string | null {
  const item = { ...expected(occurrence), date: occurrence.expectedDate };
  if (occurrence.expectedDate <= today) return convertedNote(item, totalCurrency);
  if ((item.currency ?? HOME_CURRENCY) === totalCurrency) return null;
  const converted = amountIn(item, totalCurrency);
  if (converted === null) return null;
  return `${formatCurrency(Math.abs(converted), totalCurrency)} at today's exchange rate`;
}
