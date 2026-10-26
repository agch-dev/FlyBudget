import {
  OLE_SIGNATURE,
  SPREADSHEET_MESSAGES,
  SpreadsheetError,
  numberText,
  type Cell,
  type Sheet,
} from './spreadsheetCells';
import { readXls } from './xls';
import { readXlsx } from './xlsx';
import {
  columnRolesFor,
  detectSkipRows,
  fitsSavedColumns,
  normalizeDate,
  readImportAmount,
  type ColumnRole,
  type DateFormat,
  type ImportSettings,
  type NumberFormat,
} from './csv';

export { SpreadsheetError, type Cell, type Sheet } from './spreadsheetCells';

const hasMagic = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

/** A file from Excel 4.0 or older (BIFF2-4): no OLE file around it, a BOF record first */
function isOldExcel(bytes: Uint8Array): boolean {
  if (bytes.length < 8 || bytes[0] !== 0x09 || ![0x00, 0x02, 0x04].includes(bytes[1])) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint16(2, true);
  // The sheet's kind: a worksheet, a chart, a macro sheet or a workspace
  return length >= 4 && length <= 16 && [0x10, 0x20, 0x40, 0x100].includes(view.getUint16(6, true));
}

/**
 * Whether these bytes are a web page, as some banks save their ".xls" files: markup that
 * starts with `<html` or a `<table` near the start (not an Excel 2003 XML workbook)
 */
function isWebPage(bytes: Uint8Array): boolean {
  // One byte a character, UTF-16 too (without its zero bytes), and without a BOM
  const head = new TextDecoder('latin1')
    .decode(bytes.subarray(0, 4096))
    .replace(/\0/g, '')
    .replace(/^(\xef\xbb\xbf|\xff\xfe|\xfe\xff)/, '')
    .trimStart()
    .slice(0, 2048);
  return (
    head.startsWith('<') && /<(html|table)[\s>]/i.test(head) && !/<(\w+:)?Workbook\b/.test(head)
  );
}

/**
 * Which kind of Excel file these bytes are, whatever the file is called: a zip (.xlsx,
 * .xltx, .xlsm), an old .xls (an OLE compound file, which an .xlsx with a password is too,
 * or one from before Excel 97), a web page saved as .xls, or null
 */
export function spreadsheetKind(bytes: Uint8Array): 'xlsx' | 'xls' | 'html' | null {
  if (hasMagic(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'xlsx';
  if (hasMagic(bytes, OLE_SIGNATURE) || isOldExcel(bytes)) return 'xls';
  if (isWebPage(bytes)) return 'html';
  return null;
}

/**
 * The visible sheets of an Excel file (.xlsx, .xltx, .xlsm or .xls). Throws
 * `SpreadsheetError`, with a message for the user, when the file can't be read.
 */
export async function readSpreadsheet(bytes: Uint8Array): Promise<Sheet[]> {
  const kind = spreadsheetKind(bytes);
  if (kind === 'html') throw new SpreadsheetError(SPREADSHEET_MESSAGES.webPage);
  if (kind === null) throw new SpreadsheetError(SPREADSHEET_MESSAGES.notWorkbook);
  try {
    return kind === 'xls' ? readXls(bytes) : await readXlsx(bytes);
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    // An offset past the end of a damaged file
    throw new SpreadsheetError(SPREADSHEET_MESSAGES.damaged);
  }
}

/**
 * A sheet's cells as the text the import reads, numbers written in `format` (see
 * `numberText`) so they read back exactly. Date cells are `YYYY-MM-DD` already.
 */
export function sheetText(rows: Cell[][], format: NumberFormat): string[][] {
  return rows.map((row) =>
    row.map((cell) => (typeof cell === 'number' ? numberText(cell, format) : cell)),
  );
}

/**
 * The text cells only, numbers left empty: what tells how the file writes dates and amounts.
 * A number cell is never ambiguous, and a date cell is a day count turned into `YYYY-MM-DD`.
 */
export function textCells(rows: Cell[][]): string[][] {
  return rows.map((row) => row.map((cell) => (typeof cell === 'number' ? '' : cell)));
}

/**
 * Where a sheet's header is, in its text (`sheetText`): the row the account's saved settings
 * name when the sheet has those columns (`usingSaved`), else the row the CSV import would find
 */
export function sheetLayout(
  records: string[][],
  saved: ImportSettings | null,
): { skipRows: number; usingSaved: boolean } {
  if (saved && fitsSavedColumns(records, saved)) {
    return { skipRows: saved.skipRows, usingSaved: true };
  }
  // Every row of a sheet is as wide as the widest: the CSV import tells account details from
  // the header by their width, without the empty cells after them
  const filled = records.map((row) =>
    row.slice(
      0,
      row.reduce((end, cell, i) => (cell !== '' ? i + 1 : end), 0),
    ),
  );
  return { skipRows: Math.min(detectSkipRows(filled), records.length - 1), usingSaved: false };
}

const AMOUNT_ROLES: ColumnRole[] = ['amount', 'inflow', 'outflow'];

/**
 * The sheet an import opens on, from each sheet's text: the first with this account's saved
 * columns, else the first where the column guess finds a date and an amount, else the first
 */
export function chooseSheet(sheets: string[][][], saved: ImportSettings | null): number {
  const layouts = sheets.map((records) => sheetLayout(records, saved));
  const withSaved = layouts.findIndex((layout) => layout.usingSaved);
  if (withSaved !== -1) return withSaved;
  const transactions = sheets.findIndex((records, i) => {
    const roles = columnRolesFor(records[layouts[i].skipRows] ?? [], saved?.columns);
    return roles.includes('date') && roles.some((role) => AMOUNT_ROLES.includes(role));
  });
  return Math.max(transactions, 0);
}

const DATE_FORMATS: DateFormat[] = ['mdy', 'dmy', 'ymd'];

/**
 * Whether these text cells show how the file writes dates: one reads differently, or not at
 * all, in another order. A sheet of real dates shows nothing, so nothing is saved for it.
 */
export function showsDateFormat(values: string[]): boolean {
  return values.some((value) => new Set(DATE_FORMATS.map((f) => normalizeDate(value, f))).size > 1);
}

/** Whether these text cells show how the file writes amounts (a sheet of numbers doesn't) */
export function showsNumberFormat(values: string[]): boolean {
  return values.some(
    (value) => readImportAmount(value, 'dot') !== readImportAmount(value, 'comma'),
  );
}
