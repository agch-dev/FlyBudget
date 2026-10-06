import { format, parseISO } from 'date-fns';
import { t } from '../i18n';

// Exchange rates (pesos per dollar): the pure parts of Settings → Exchange rates and of the
// estimated-rates banner.

/** The server refuses rates above this (MAX_RATE in server/src/services/exchangeRates.ts) */
export const MAX_RATE = 100_000;

export interface RateMonth<T> {
  /** YYYY-MM */
  month: string;
  /** Newest first */
  rates: T[];
}

/** Rates by month, newest month and newest day first. */
export function groupRatesByMonth<T extends { date: string }>(rates: readonly T[]): RateMonth<T>[] {
  // ISO dates sort as text
  const newestFirst = [...rates].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const months: RateMonth<T>[] = [];
  for (const rate of newestFirst) {
    const month = rate.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.rates.push(rate);
    else months.push({ month, rates: [rate] });
  }
  return months;
}

/** "40.342": the interbank rate is published with up to three decimals. */
export function formatRate(rate: number): string {
  return rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/**
 * A rate typed by the user ("40.35", thousands commas allowed like every amount in the
 * app), or null when it isn't a positive number the server would accept.
 */
export function parseRateInput(text: string): number | null {
  const cleaned = text.trim().replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const rate = Number(cleaned);
  return Number.isFinite(rate) && rate > 0 && rate <= MAX_RATE ? rate : null;
}

/** More estimated dates than this are shown as a count and a range */
const NAMED_DATES_MAX = 3;

/**
 * The dates whose exchange rate is estimated, for the banner: "10 Nov 2023",
 * "1 Feb 2023 and 10 Nov 2023", or "12 dates from 12 Mar 2021 to 10 Nov 2023", in the App
 * Language.
 * `dates` are YYYY-MM-DD, at least one.
 */
export function estimatedDatesLabel(dates: readonly string[]): string {
  // ISO dates sort as text
  const sorted = [...new Set(dates)].sort();
  const day = (date: string) => format(parseISO(date), t('datePattern.medium'));
  if (sorted.length > NAMED_DATES_MAX) {
    return t('rates.datesRange', {
      total: sorted.length,
      first: day(sorted[0]),
      last: day(sorted[sorted.length - 1]),
    });
  }
  const named = sorted.map(day);
  const last = named.pop() ?? '';
  return named.length ? t('rates.datesAnd', { dates: named.join(', '), last }) : last;
}

/**
 * What the banner at the top of the app says about missing exchange rates, or null when
 * there is nothing to say. With some rate stored, a dollar amount dated before it is
 * converted at that rate (an estimate). With no rate stored at all nothing can be converted,
 * so the amounts are left out of totals: the banner must not promise an estimate then.
 */
export function ratesNotice(
  answer: { dates: readonly string[]; notCounted?: boolean } | undefined,
): { title: string; detail: string } | null {
  if (!answer) return null;
  if (answer.notCounted) {
    return { title: t('rates.notCountedTitle'), detail: t('rates.notCountedDetail') };
  }
  if (answer.dates.length === 0) return null;
  return {
    title: t('rates.missingTitle', { dates: estimatedDatesLabel(answer.dates) }),
    detail: t('rates.missingDetail', { count: answer.dates.length }),
  };
}
