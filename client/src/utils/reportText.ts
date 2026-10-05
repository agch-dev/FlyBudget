import { format, subYears } from 'date-fns';
import { t } from '../i18n';

// Text the reports build from data the server sends in English. The server's own text is
// never translated where it is stored or exported, only where it is shown.

export type ComparisonMode =
  | 'week_vs_last_week'
  | 'month_vs_last_month'
  | 'month_vs_last_year'
  | 'month_vs_average'
  | 'year_vs_last_year';

export const COMPARISON_MODES: ComparisonMode[] = [
  'week_vs_last_week',
  'month_vs_last_month',
  'month_vs_last_year',
  'month_vs_average',
  'year_vs_last_year',
];

/**
 * How a spending comparison names its two periods, in the App Language (the server sends
 * English labels with the figures, which are not shown). `period` is the one being compared.
 */
export function comparisonLabels(
  mode: ComparisonMode,
  today: Date = new Date(),
): { period: 'week' | 'month' | 'year'; current: string; comparison: string } {
  switch (mode) {
    case 'week_vs_last_week':
      return {
        period: 'week',
        current: t('reports:home.comparison.thisWeek'),
        comparison: t('reports:home.comparison.lastWeek'),
      };
    case 'month_vs_last_year':
      return {
        period: 'month',
        current: t('reports:home.comparison.thisMonth'),
        comparison: format(subYears(today, 1), t('datePattern.shortMonthYear')),
      };
    case 'month_vs_average':
      return {
        period: 'month',
        current: t('reports:home.comparison.thisMonth'),
        comparison: t('reports:home.comparison.averageMonth'),
      };
    case 'year_vs_last_year':
      return {
        period: 'year',
        current: t('reports:home.comparison.thisYear'),
        comparison: t('reports:home.comparison.lastYear'),
      };
    case 'month_vs_last_month':
      return {
        period: 'month',
        current: t('reports:home.comparison.thisMonth'),
        comparison: t('reports:home.comparison.lastMonth'),
      };
  }
}

/**
 * A custom report's group as it is shown: the names the server gives to what has no category
 * ("Uncategorized") or no payee ("Unknown") are translated, every other name is the user's own.
 */
export function groupName(name: string): string {
  if (name === 'Uncategorized') return t('reports:uncategorized');
  if (name === 'Unknown') return t('reports:unknownPayee');
  return name;
}
