// What the Excel readers (`xlsx.ts`, `xls.ts`) share: the cells they return and how a
// number is told apart from a date.

/** A cell as the file holds it: text, or a number (an amount, a reference) */
export type Cell = string | number;

export interface Sheet {
  name: string;
  /** Rows of the same length, without the rows and columns that are empty throughout */
  rows: Cell[][];
}

/** The file isn't a workbook this app can read; `message` is written for the user */
export class SpreadsheetError extends Error {}

/** Cells as the readers collect them: row number, then column number */
export type SparseRows = Map<number, Map<number, Cell>>;

export function setCell(rows: SparseRows, row: number, col: number, value: Cell) {
  if (value === '') return;
  let cells = rows.get(row);
  if (!cells) rows.set(row, (cells = new Map()));
  cells.set(col, value);
}

/** The filled rows in order, each with the filled columns in order (banks indent their tables) */
export function denseRows(sparse: SparseRows): Cell[][] {
  const columns = [...new Set([...sparse.values()].flatMap((cells) => [...cells.keys()]))].sort(
    (a, b) => a - b,
  );
  return [...sparse.keys()]
    .sort((a, b) => a - b)
    .map((row) => columns.map((col) => sparse.get(row)!.get(col) ?? ''));
}

// Excel's built-in date and time formats (ECMA-376 18.8.30, plus the regional ones)
const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

/** Whether a number format shows a number as a date: `dd/mm/yyyy` does, `#,##0.00` doesn't */
export function isDateFormat(id: number, code: string | undefined): boolean {
  if (code === undefined) return BUILTIN_DATE_FORMATS.has(id);
  // Without quoted text, escaped characters and [Red] / [$-409] sections
  const bare = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '');
  return /[dmyhs]/i.test(bare) && !/general/i.test(bare);
}

const DAY_MS = 86_400_000;

/**
 * The calendar day of an Excel date number, as `YYYY-MM-DD` (any time of day is dropped).
 * Day 1 is 1 January 1900, or 2 January 1904 in files from old Mac versions (`date1904`).
 */
export function serialToIsoDate(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2_958_465) return null;
  // Excel counts a 29 February 1900 that never existed, so days after it are one too high
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 61 ? 31 : 30);
  return new Date(epoch + Math.floor(serial) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A number cell as text the import reads back to the same cents under `decimal`: `1234.5`
 * is `1234.5` (point) or `1234,5` (comma), never with thousands separators. Float noise
 * (`0.30000000000000004`) is rounded away; a number with real extra decimals keeps them,
 * so it is refused as an amount, not rounded.
 */
export function numberText(value: number, decimal: 'comma' | 'point'): string {
  if (!Number.isFinite(value)) return '';
  let text = Math.abs(value) < 1e15 ? value.toFixed(6).replace(/\.?0+$/, '') : String(value);
  if (text === '-0') text = '0';
  return decimal === 'comma' ? text.replace('.', ',') : text;
}

/** A sheet's cells as the text the import works on, numbers written under `decimal` */
export function sheetText(rows: Cell[][], decimal: 'comma' | 'point'): string[][] {
  return rows.map((row) =>
    row.map((cell) => (typeof cell === 'number' ? numberText(cell, decimal) : cell)),
  );
}
