import { differenceInCalendarDays, endOfMonth, format, parseISO } from 'date-fns';

/** The oldest rate, in days before the figure's day, the Secondary Currency figure is shown with */
export const SECONDARY_RATE_MAX_AGE_DAYS = 4;

/** What the convert endpoint answered for the figure (amount null: no rate within a month) */
export interface SecondaryConversion {
  amount: number | null;
  rate: string | null;
  date: string | null;
}

/** The device's Secondary Currency, the budget's, and the currencies offered */
export interface SecondaryChoice {
  secondary: string | null;
  budget: string | null;
  offered: string[];
}

export type SecondaryFigure =
  /** Nothing to show: no Secondary Currency, or it isn't offered, or it's the budget's */
  | { kind: 'none' }
  /** Waiting for the conversion */
  | { kind: 'pending'; currency: string }
  /** No rate recent enough for the figure's day */
  | { kind: 'hidden'; currency: string }
  /** The amount in the Secondary Currency (rate and rateDate null for zero, which needs none) */
  | {
      kind: 'shown';
      currency: string;
      amount: number;
      rate: string | null;
      rateDate: string | null;
    };

/**
 * The currencies offered as a Secondary Currency: the budget's accounts' currencies and those
 * with a rate typed in, never the budget's own. Sorted, each once.
 */
export function secondaryCurrencyOptions(
  budget: string | null,
  accountCurrencies: string[],
  manualRates: { base: string; quote: string }[],
): string[] {
  const all = new Set([...accountCurrencies, ...manualRates.flatMap((r) => [r.base, r.quote])]);
  if (budget) all.delete(budget);
  return [...all].sort();
}

/**
 * The day a figure stands for, from its chart point ('yyyy-MM-dd', or 'yyyy-MM' for a month's
 * end): never after today, since the current month's point is today's balance.
 */
export function figureDay(point: string, today: string): string {
  const day =
    point.length === 7 ? format(endOfMonth(parseISO(`${point}-01`)), 'yyyy-MM-dd') : point;
  return day < today ? day : today;
}

/**
 * What to look up: the size of the figure in the budget's currency (the sign is put back
 * afterwards). Null when no lookup is needed.
 */
export function secondaryLookup(
  input: SecondaryChoice & { amount: number },
): { from: string; to: string; amount: number } | null {
  if (!showsSecondary(input) || input.amount === 0) return null;
  return { from: input.budget, to: input.secondary, amount: Math.abs(input.amount) };
}

/** Whether a Secondary Currency is set, offered, and not the budget's own */
function showsSecondary<T extends SecondaryChoice>(
  input: T,
): input is T & { secondary: string; budget: string } {
  const { secondary, budget, offered } = input;
  return !!secondary && !!budget && secondary !== budget && offered.includes(secondary);
}

/**
 * Whether and how the figure (in the budget's currency, at `day`) shows in the Secondary
 * Currency: with a rate at most SECONDARY_RATE_MAX_AGE_DAYS before its day, keeping its sign.
 */
export function secondaryFigure(
  input: SecondaryChoice & {
    amount: number;
    day: string;
    conversion: SecondaryConversion | undefined;
  },
): SecondaryFigure {
  if (!showsSecondary(input)) return { kind: 'none' };
  const currency = input.secondary;
  if (input.amount === 0) return { kind: 'shown', currency, amount: 0, rate: null, rateDate: null };
  const conversion = input.conversion;
  if (!conversion) return { kind: 'pending', currency };
  const { amount, rate, date } = conversion;
  if (amount === null || date === null) return { kind: 'hidden', currency };
  const age = differenceInCalendarDays(parseISO(input.day), parseISO(date));
  if (age > SECONDARY_RATE_MAX_AGE_DAYS) return { kind: 'hidden', currency };
  return {
    kind: 'shown',
    currency,
    amount: input.amount < 0 && amount !== 0 ? -Math.abs(amount) : Math.abs(amount),
    rate,
    rateDate: date,
  };
}
