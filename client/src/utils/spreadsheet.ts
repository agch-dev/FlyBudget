import {
  SPREADSHEET_MESSAGES,
  SpreadsheetError,
  numberText,
  type Cell,
  type Sheet,
} from './spreadsheetCells';
import { readXlsx } from './xlsx';
import {
  columnRolesFor,
  detectSkipRows,
  fitsSavedColumns,
  type ColumnRole,
  type ImportSettings,
  type NumberFormat,
} from './csv';

export { SpreadsheetError, type Cell, type Sheet } from './spreadsheetCells';

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

/**
 * Which kind of Excel file these bytes are, whatever the file is called: a zip (.xlsx,
 * .xltx, .xlsm), an OLE compound file (an old .xls, or an .xlsx with a password), or null
 */
export function spreadsheetKind(bytes: Uint8Array): 'xlsx' | 'ole' | null {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'xlsx';
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  return null;
}

/**
 * The visible sheets of an .xlsx, .xltx or .xlsm file. Throws `SpreadsheetError`, with a
 * message for the user, when the file can't be read.
 */
export async function readSpreadsheet(bytes: Uint8Array): Promise<Sheet[]> {
  const kind = spreadsheetKind(bytes);
  if (kind === 'ole') throw new SpreadsheetError(SPREADSHEET_MESSAGES.unsupported);
  if (kind !== 'xlsx') throw new SpreadsheetError(SPREADSHEET_MESSAGES.notWorkbook);
  try {
    return await readXlsx(bytes);
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
 * Where a sheet's header is: the row the account's saved settings name when the sheet has
 * those columns (`usingSaved`), else the row the CSV import would find
 */
export function sheetLayout(
  sheet: Sheet,
  saved: ImportSettings | null,
): { skipRows: number; usingSaved: boolean } {
  const records = sheetText(sheet.rows, 'dot');
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
 * The sheet an import opens on: the first with this account's saved columns, else the first
 * where the column guess finds a date and an amount, else the first
 */
export function chooseSheet(sheets: Sheet[], saved: ImportSettings | null): number {
  const layouts = sheets.map((sheet) => sheetLayout(sheet, saved));
  const withSaved = layouts.findIndex((layout) => layout.usingSaved);
  if (withSaved !== -1) return withSaved;
  const transactions = sheets.findIndex((sheet, i) => {
    const header = sheetText(sheet.rows, 'dot')[layouts[i].skipRows] ?? [];
    const roles = columnRolesFor(header, saved?.columns);
    return roles.includes('date') && roles.some((role) => AMOUNT_ROLES.includes(role));
  });
  return Math.max(transactions, 0);
}
