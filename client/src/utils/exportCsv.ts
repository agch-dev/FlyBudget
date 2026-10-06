import type { Currency, CustomReportData, ReportGroupBy } from '../types';
import { currencySymbol } from './currency';

// Exported files read the same in every App Language: their header row and the names the app
// supplies are English (the table on screen is translated).
export const CSV_UNCATEGORIZED = 'Uncategorized';
export const CSV_DELETED_CATEGORY = 'Deleted category';
export const CSV_UNKNOWN_PAYEE = 'Unknown';

/**
 * A custom report as the rows of its CSV file: a row per group, or over time a row per month
 * with a column per group. A group with no name (no category, no payee) gets the file's label.
 */
export function customReportCsvRows(
  data: CustomReportData,
  groupBy: ReportGroupBy,
): Record<string, unknown>[] {
  const named = (name: string | null) =>
    name ?? (groupBy === 'payee' ? CSV_UNKNOWN_PAYEE : CSV_UNCATEGORIZED);
  if (data.mode === 'total') {
    return data.data.map((d) => ({ name: named(d.name), amount_cents: d.value }));
  }
  return data.data.map((d) => {
    const row: Record<string, unknown> = { month: d.month };
    for (const g of data.groups) row[named(g.name)] = d[g.key] ?? 0;
    return row;
  });
}

/**
 * Rows of amounts in one currency (a report in the viewing currency), each saying which: a
 * last `currency` column holding its sign (`$` or `US$`). The amounts stay plain numbers.
 */
export function rowsInCurrency<R extends Record<string, unknown>>(
  rows: readonly R[],
  currency: Currency,
): (R & { currency: string })[] {
  const sign = currencySymbol(currency);
  return rows.map((row) => ({ ...row, currency: sign }));
}

/**
 * One CSV cell. Text starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'` so
 * spreadsheets don't run it as a formula (names can come from banks); numbers are left as-is.
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
