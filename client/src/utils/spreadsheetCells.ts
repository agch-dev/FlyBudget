import type { NumberFormat } from './csv';

// What the Excel readers (`xlsx.ts`, `xls.ts`) return, and how a number is told apart from a date.

/** A cell as the file holds it: text, or a number (an amount, a reference) */
export type Cell = string | number;

export interface Sheet {
  name: string;
  /** Rows of the same length, without the rows and columns that are empty throughout */
  rows: Cell[][];
}

/** The file isn't a workbook FlyBudget can read; `message` is written for the user */
export class SpreadsheetError extends Error {}

export const SPREADSHEET_MESSAGES = {
  damaged: "This Excel file is damaged and can't be read.",
  tooLarge: 'This Excel file is too large to import.',
  notWorkbook: "This file isn't an Excel workbook.",
  tooOld:
    "This Excel file is from an older Excel version FlyBudget can't read. Save it as .xlsx and import that.",
  password: 'This Excel file has a password. Save a copy without one and import that.',
  webPage:
    'This file is a web page saved as .xls. Open it in Excel or LibreOffice, save it as .xlsx and import that.',
} as const;

/** A workbook file, or what it unpacks to, may not be larger than this */
export const MAX_WORKBOOK_BYTES = 200 * 1024 * 1024;

/** The most cells a sheet may have once empty rows and columns are left out */
const MAX_CELLS = 5_000_000;

/** Cells as the reader collects them: row number, then column number */
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
  if (columns.length * sparse.size > MAX_CELLS) {
    throw new SpreadsheetError(SPREADSHEET_MESSAGES.tooLarge);
  }
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
  // Up to 31 December 9999
  if (!Number.isFinite(serial) || serial < 0 || serial > (date1904 ? 2_957_003 : 2_958_465)) {
    return null;
  }
  // Excel counts a 29 February 1900 that never existed, so days after it are one too high
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 61 ? 31 : 30);
  return new Date(epoch + Math.floor(serial) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A number cell as text the import reads back to the same cents under `format`: `1234.5`
 * is `1234.5` (`dot`) or `1234,5` (`comma`), never with thousands separators. Float noise
 * (`0.30000000000000004`) is rounded away.
 */
export function numberText(value: number, format: NumberFormat): string {
  if (!Number.isFinite(value)) return '';
  let text = Math.abs(value) < 1e15 ? value.toFixed(6).replace(/\.?0+$/, '') : String(value);
  if (text === '-0') text = '0';
  return format === 'comma' ? text.replace('.', ',') : text;
}
