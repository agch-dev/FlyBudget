import { t } from '../i18n';
import type en from '../i18n/en/reports';
import type { BuiltinWidgetType, Currency, CustomReportData, ReportGroupBy } from '../types';
import { currencySymbol } from './currency';
import { shownReport } from './reportText';

// A report's "Export CSV" file follows the App Language, like the table on screen: its header
// row, the names the app supplies and its file name come from the catalog (`reports:csv`).
// Amounts (whole cents), months, dates and currency signs are written the same in both.

/** A column a report file can have: its header is `reports:csv.column.<id>` */
export type CsvColumn = keyof typeof en.csv.column;

/** A column's header in the App Language */
const csvHeader = (column: CsvColumn) => t(`reports:csv.column.${column}`);

/** A file of rows: a column per key, the key being the column's header */
export type CsvRow = Record<string, unknown>;

/** Rows whose every key is a column id: a key the catalog doesn't have doesn't compile */
type ColumnsOnly<R> = { [K in keyof R]: K extends CsvColumn ? unknown : never };

/**
 * Rows keyed by column id, as rows keyed by each column's header in the App Language. Call it
 * when the file is made, so the headers are in the language of that moment.
 */
export function csvRows<R extends ColumnsOnly<R>>(rows: readonly R[]): CsvRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => [csvHeader(column as CsvColumn), value]),
    ),
  );
}

/** The name of a report's file for a range, in the App Language */
export function csvFileName(
  report: BuiltinWidgetType | 'custom' | 'cash-flow',
  from: string,
  to: string,
): string {
  return t(`reports:csv.file.${report}`, { from, to });
}

/**
 * A custom report as the rows of its CSV file, grouped as the table shows it (`shownReport`):
 * a row per group, or over time a row per month with a column per group.
 */
export function customReportCsvRows(data: CustomReportData, groupBy: ReportGroupBy): CsvRow[] {
  const shown = shownReport(data, groupBy);
  if (shown.mode === 'total') {
    return shown.data.map((d) => ({
      [csvHeader('name')]: d.name,
      [csvHeader('amount_cents')]: d.value,
    }));
  }
  return shown.data.map((d) => {
    const row: CsvRow = { [csvHeader('month')]: d.month };
    for (const g of shown.groups) row[g.name] = d[g.key];
    return row;
  });
}

/**
 * Rows of amounts in one currency (a report in the viewing currency), each saying which: a
 * last column, headed "currency" in the App Language, holding its sign (`$` or `US$`). The
 * amounts stay plain numbers.
 */
export function rowsInCurrency(rows: readonly CsvRow[], currency: Currency): CsvRow[] {
  const header = csvHeader('currency');
  const sign = currencySymbol(currency);
  return rows.map((row) => ({ ...row, [header]: sign }));
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

/** The text of a file of rows: a header line (escaped like any text cell), then a line per row */
export function csvFileText(rows: readonly CsvRow[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(','),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')),
  ].join('\n');
}

export function downloadCsv(filename: string, rows: readonly CsvRow[]): void {
  if (!rows.length) return;
  const blob = new Blob([csvFileText(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
