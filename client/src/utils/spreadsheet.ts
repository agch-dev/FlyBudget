import { SpreadsheetError, type Sheet } from './spreadsheetCells';
import { readXls } from './xls';
import { readXlsx } from './xlsx';
import { t } from '../i18n';

export { SpreadsheetError, sheetText, type Cell, type Sheet } from './spreadsheetCells';

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

/** Which kind of Excel file these bytes are, whatever the file is called; null for anything else */
export function spreadsheetKind(bytes: Uint8Array): 'xlsx' | 'xls' | null {
  // A zip (.xlsx, .xltx, .xlsm) or an OLE compound file (.xls)
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'xlsx';
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'xls';
  return null;
}

/**
 * The sheets of an Excel file (.xlsx, .xltx, .xlsm or .xls). Throws `SpreadsheetError`,
 * with a message for the user, when the file can't be read.
 */
export async function readSpreadsheet(bytes: Uint8Array): Promise<Sheet[]> {
  const kind = spreadsheetKind(bytes);
  try {
    if (kind === 'xlsx') return await readXlsx(bytes);
    if (kind === 'xls') return readXls(bytes);
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    // An offset past the end of a damaged file
    throw new SpreadsheetError(t('import:spreadsheet.damaged'));
  }
  throw new SpreadsheetError(t('import:spreadsheet.notWorkbook'));
}
