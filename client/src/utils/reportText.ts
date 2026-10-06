import { format, subYears } from 'date-fns';
import { t } from '../i18n';
import type { CustomReportData, ReportGroupBy } from '../types';

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
 * A custom report's group as it is shown. The server names groups (default categories in the
 * App Language) and sends no name for what has no category or no payee: that label is the
 * app's own text.
 */
export function groupName(name: string | null, groupBy: ReportGroupBy): string {
  if (name !== null) return name;
  return groupBy === 'payee' ? t('reports:unknownPayee') : t('reports:uncategorized');
}

/** A custom report as it is shown: every group under its label, each label once */
export type ShownReportData =
  | { mode: 'total'; data: { name: string; value: number }[] }
  | {
      mode: 'time';
      /** One per line or column; `key` is where each row of `data` holds the group's figure */
      groups: { key: string; name: string }[];
      /** A row per month: its `month` and every group's figure (0 when it has none) */
      data: ({ month: string } & Record<string, string | number>)[];
    };

/**
 * A custom report as the table, the chart and the CSV file show it. Groups whose labels read
 * the same (a category called "Uncategorized" and the rows with no category, a payee called
 * "Unknown" and the rows with no payee) are one group, their figures added up, so nothing is
 * shown twice or lost. Call it while rendering: the labels are in the App Language.
 */
export function shownReport(data: CustomReportData, groupBy: ReportGroupBy): ShownReportData {
  if (data.mode === 'total') {
    const byLabel = new Map<string, number>();
    for (const row of data.data) {
      const label = groupName(row.name, groupBy);
      byLabel.set(label, (byLabel.get(label) ?? 0) + row.value);
    }
    const rows = [...byLabel]
      .map(([name, value]) => ({ name, value }))
      .filter((row) => row.value !== 0);
    // Months read in date order (each is its own label); other totals biggest first
    if (groupBy !== 'month') rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { mode: 'total', data: rows };
  }

  // Each label keeps the key of the first group shown under it
  const keyOf = new Map<string, string>();
  const shownKey = new Map<string, string>();
  for (const g of data.groups) {
    const label = groupName(g.name, groupBy);
    if (!keyOf.has(label)) keyOf.set(label, g.key);
    shownKey.set(g.key, keyOf.get(label)!);
  }
  const groups = [...keyOf].map(([name, key]) => ({ key, name }));
  const rows = data.data.map((row) => {
    const shown: { month: string } & Record<string, string | number> = {
      month: String(row.month),
    };
    for (const g of groups) shown[g.key] = 0;
    for (const g of data.groups) {
      const key = shownKey.get(g.key)!;
      shown[key] = (shown[key] as number) + Number(row[g.key] ?? 0);
    }
    return shown;
  });
  return { mode: 'time', groups, data: rows };
}
