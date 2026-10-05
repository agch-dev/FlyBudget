// Exchange rates (pesos per dollar): the pure parts of Settings → Exchange rates.

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
