export type Delimiter = ',' | ';';
/** How a bank writes 5 March 2026 with numbers: 05/03/2026 (day first) or 03/05/2026 */
export type DateOrder = 'day-first' | 'month-first';
/** The decimal mark in amounts: `1.234,56` (comma) or `1,234.56` (point) */
export type DecimalSeparator = 'comma' | 'point';

/** How one bank's files write dates and amounts; chosen in the import dialog */
export interface ImportConventions {
  dateOrder: DateOrder;
  decimal: DecimalSeparator;
}

/** What a file is read with when neither the file nor an earlier import says otherwise */
export const DEFAULT_CONVENTIONS: ImportConventions = {
  dateOrder: 'month-first',
  decimal: 'point',
};

/**
 * The text of a CSV file. Files are UTF-8 unless their bytes aren't valid UTF-8: then they
 * are Windows-1252 (Latin-1), which older bank systems still write ("Número", "Débito").
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const withoutBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * The field separator of a CSV file: whichever of `,` and `;` the header line uses more,
 * outside quotes. The header has no amounts, so `1.234,56` can't mislead it.
 */
export function detectDelimiter(text: string): Delimiter {
  const src = withoutBom(text);
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  let started = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      started = true;
    } else if (inQuotes) {
      continue;
    } else if (ch === '\n' || ch === '\r') {
      // Blank lines above the header don't end it
      if (started) break;
    } else {
      started = true;
      if (ch === ',') commas++;
      else if (ch === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * Parses CSV text (RFC 4180): quoted fields may contain delimiters, doubled quotes and
 * line breaks (bank memos often do). A UTF-8 byte order mark (Excel) is ignored. Fields
 * are separated by `,` or `;`, whichever the file uses.
 */
export function parseCsv(
  text: string,
  delimiter: Delimiter = detectDelimiter(text),
): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = withoutBom(text);

  const endRecord = () => {
    record.push(field.trim());
    if (record.some((f) => f !== '')) records.push(record);
    record = [];
    field = '';
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += ch;
    }
  }
  endRecord();

  if (records.length === 0) return { headers: [], rows: [] };
  return { headers: records[0], rows: records.slice(1) };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** `YYYY-MM-DD` if the three numbers are a real calendar day */
function isoDay(year: number, month: number, day: number): string | null {
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = month === 2 && leapYear ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > lastDay) return null;
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

// A time after the date ("05/03/2026 14:30") is ignored
const YEAR_FIRST = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[ T].*)?$/;
const YEAR_LAST = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:[ T].*)?$/;

/**
 * A date as banks write it, as `YYYY-MM-DD`, or null if it can't be read. `order` decides
 * what `05/03/2026` means; a date that isn't real under it (`25/03/2026` month first) is
 * null, never the other order's day. Year-first dates (`2026-03-05`) and written-out ones
 * (`Jan 5, 2024`) read the same under both.
 */
export function parseImportDate(raw: string | undefined, order: DateOrder): string | null {
  const trimmed = (raw ?? '').trim();

  const yearFirst = trimmed.match(YEAR_FIRST);
  if (yearFirst) return isoDay(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));

  const yearLast = trimmed.match(YEAR_LAST);
  if (yearLast) {
    const [, a, b, y] = yearLast;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const [day, month] = order === 'day-first' ? [a, b] : [b, a];
    return isoDay(year, Number(month), Number(day));
  }

  // Month names only: the browser's own parser reads bare numbers in surprising ways
  if (!/[a-z]/i.test(trimmed)) return null;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  // Local date parts: "Jan 5, 2024" parses as local midnight, and toISOString() (UTC)
  // would give the previous day east of UTC
  return isoDay(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

/** An amount cell without spaces and currency signs (`$`, `US$`, `U$S`, `USD`, `UYU`, `€`, `£`) */
function bareAmount(raw: string | undefined): string {
  return (raw ?? '').replace(/\s/g, '').replace(/US\$|U\$S|USD|UYU|[$€£]/gi, '');
}

// Whole part plain or grouped in threes, then at most two decimals
const POINT_AMOUNT = /^(\d+|\d{1,3}(?:,\d{3})+)?(?:\.(\d{1,2}))?$/;
const COMMA_AMOUNT = /^(\d+|\d{1,3}(?:\.\d{3})+)?(?:,(\d{1,2}))?$/;

/**
 * An amount as banks write it: "$1,234.56", "-12.00", "(12.00)" or "12.00-" for negatives,
 * or "1.234,56" with `decimal: 'comma'`. Returns integer cents: 0 for an empty cell, and
 * null for anything that isn't a number under that convention, so a file read with the
 * wrong one is noticed ("1.234,56" and "120,00" are not point-decimal numbers).
 */
export function parseImportAmount(
  raw: string | undefined,
  decimal: DecimalSeparator = 'point',
): number | null {
  let s = bareAmount(raw);
  // Some banks fill empty debit and credit cells with a dash
  if (s === '' || s === '-') return 0;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  const match = s.match(decimal === 'comma' ? COMMA_AMOUNT : POINT_AMOUNT);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;

  // Built from the digits, not parseFloat: cents must be exact
  const whole = Number((match[1] ?? '0').replace(/\D/g, ''));
  const cents = whole * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents !== 0 ? -cents : cents;
}

const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](?:\d{4}|\d{2})(?:[ T].*)?$/;

/** Rows looked at when guessing: plenty to find a day above 12, cheap on a huge file */
const GUESS_SAMPLE_ROWS = 500;

/** Which separator an amount cell shows to be the decimal mark, if it shows any */
function decimalClue(cell: string): DecimalSeparator | null {
  const digits = bareAmount(cell).replace(/^[-+(]+|[-)]+$/g, '');
  if (!/^[\d.,]+$/.test(digits)) return null;
  const last = digits.match(/([.,])(\d*)$/);
  if (!last) return null;
  const mark: DecimalSeparator = last[1] === ',' ? 'comma' : 'point';
  const otherMark: DecimalSeparator = mark === 'comma' ? 'point' : 'comma';
  // Both in one amount: the decimal mark comes last ("1.234,56")
  if (digits.includes(last[1] === ',' ? '.' : ',')) return mark;
  // Repeated: a thousands separator ("1.234.567")
  if (digits.indexOf(last[1]) !== digits.lastIndexOf(last[1])) return otherMark;
  // Alone before three digits ("1,234") it could be either
  return last[2].length === 1 || last[2].length === 2 ? mark : null;
}

/**
 * Guesses how a file writes dates and amounts from its cells, whatever their columns:
 * a date whose first number is above 12 is day first (second number: month first), and
 * an amount ending in a separator and one or two digits shows the decimal mark. Each
 * falls back to `DEFAULT_CONVENTIONS` when no cell tells.
 */
export function guessConventions(rows: string[][]): ImportConventions {
  const votes = { 'day-first': 0, 'month-first': 0, comma: 0, point: 0 };

  for (const row of rows.slice(0, GUESS_SAMPLE_ROWS)) {
    for (const cell of row) {
      const date = cell.match(NUMERIC_DATE);
      if (date) {
        const a = Number(date[1]);
        const b = Number(date[2]);
        if (a > 12 && b <= 12) votes['day-first']++;
        else if (b > 12 && a <= 12) votes['month-first']++;
        continue;
      }
      const clue = decimalClue(cell);
      if (clue) votes[clue]++;
    }
  }

  const pick = <T extends keyof typeof votes>(a: T, b: T, fallback: T): T =>
    votes[a] === votes[b] ? fallback : votes[a] > votes[b] ? a : b;
  return {
    dateOrder: pick('day-first', 'month-first', DEFAULT_CONVENTIONS.dateOrder),
    decimal: pick('comma', 'point', DEFAULT_CONVENTIONS.decimal),
  };
}

/**
 * Id used to skip rows imported before. `occurrence` numbers identical rows within one
 * file (two same-price coffees on the same day are two purchases, not a duplicate); the
 * first keeps the plain id, so files imported earlier still match.
 */
export function generateImportId(
  date: string,
  amount: number,
  payeeName: string,
  occurrence = 1,
): string {
  const id = `${date}|${amount}|${(payeeName || '').toLowerCase()}`;
  return occurrence > 1 ? `${id}|${occurrence}` : id;
}

// English and Spanish (Uruguayan banks) headers, lower case and without accents
const COLUMN_HINTS: Record<string, string> = {
  date: 'date',
  'transaction date': 'date',
  'posted date': 'date',
  'post date': 'date',
  fecha: 'date',
  description: 'payee',
  payee: 'payee',
  name: 'payee',
  merchant: 'payee',
  descripcion: 'payee',
  concepto: 'payee',
  detalle: 'payee',
  amount: 'amount',
  'transaction amount': 'amount',
  importe: 'amount',
  monto: 'amount',
  debit: 'outflow',
  withdrawal: 'outflow',
  outflow: 'outflow',
  debito: 'outflow',
  debitos: 'outflow',
  credit: 'inflow',
  deposit: 'inflow',
  inflow: 'inflow',
  credito: 'inflow',
  creditos: 'inflow',
  memo: 'notes',
  notes: 'notes',
  note: 'notes',
  reference: 'notes',
  referencia: 'notes',
};

export type ColumnRole = 'date' | 'payee' | 'amount' | 'inflow' | 'outflow' | 'notes' | 'skip';

export function guessColumnRoles(headers: string[]): ColumnRole[] {
  return headers.map((h) => {
    const key = h.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return (COLUMN_HINTS[key] as ColumnRole) ?? 'skip';
  });
}

const isAmountRole = (role: ColumnRole) =>
  role === 'amount' || role === 'inflow' || role === 'outflow';

/**
 * Where the column headers are: the first line naming a date column and an amount column.
 * Banks put the account's details above it (holder, number, currency, the period). A file
 * with no such line has its headers on the first one.
 */
function headerRowIndex(records: string[][]): number {
  const found = records.findIndex((record) => {
    const roles = guessColumnRoles(record);
    return roles.includes('date') && roles.some(isAmountRole);
  });
  return found === -1 ? 0 : found;
}

const readsAsDate = (cell: string | undefined) =>
  parseImportDate(cell, 'day-first') !== null || parseImportDate(cell, 'month-first') !== null;
const readsAsAmount = (cell: string | undefined) =>
  parseImportAmount(cell, 'point') !== null || parseImportAmount(cell, 'comma') !== null;

/**
 * Headers that line up with the data. Some banks (Santander Uruguay) name a column in the
 * header that their transaction rows leave out, so every cell after it sits one header too
 * far left and the balance would be read as the amount. That shows as: every dated row is
 * shorter than the header, and a payee column holds nothing but numbers. That header is dropped
 * when the amount columns then hold amounts; anything else is left as written.
 */
function alignHeaders(headers: string[], rows: string[][]): string[] {
  const roles = guessColumnRoles(headers);
  const dateIdx = roles.indexOf('date');
  const dated = rows.filter((row) => readsAsDate(row[dateIdx]));
  if (dated.length === 0 || dated.some((row) => row.length >= headers.length)) return headers;

  // Empty cells count: a debit column is empty on a credit's row
  const extra = roles.findIndex(
    (role, i) =>
      role === 'payee' &&
      dated.some((row) => (row[i] ?? '') !== '') &&
      dated.every((row) => readsAsAmount(row[i])),
  );
  if (extra === -1) return headers;

  const aligned = headers.filter((_, i) => i !== extra);
  const fits = guessColumnRoles(aligned).every(
    (role, i) => !isAmountRole(role) || dated.every((row) => readsAsAmount(row[i])),
  );
  return fits ? aligned : headers;
}

/**
 * A bank's CSV file as the import dialog needs it: the column headers wherever they are,
 * lined up with the data (`alignHeaders`), the rows under them, and the lines above them
 * (`preamble`), which are never imported but still show how the file writes dates.
 */
export function readCsvFile(text: string): {
  headers: string[];
  rows: string[][];
  preamble: string[][];
} {
  const { headers: first, rows: rest } = parseCsv(text);
  if (first.length === 0) return { headers: [], rows: [], preamble: [] };
  const records = [first, ...rest];
  const at = headerRowIndex(records);
  const rows = records.slice(at + 1);
  return { headers: alignHeaders(records[at], rows), rows, preamble: records.slice(0, at) };
}

/** One transaction read from a file, ready for the import API */
export interface ReadImportRow {
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  importedId: string;
}

/** A row of the file that holds an amount but can't be read, so it isn't imported */
export interface ImportProblem {
  /** 1 is the first row under the header */
  row: number;
  message: string;
}

/**
 * Turns a file's rows into transactions under the chosen conventions. Rows with no amount
 * (blank lines, pending rows, zeros) are left out quietly; a row whose date or amount
 * can't be read comes back in `problems`, never imported as zero or on a wrong day.
 */
export function readImportRows(
  rawRows: string[][],
  roles: ColumnRole[],
  conventions: ImportConventions,
): { rows: ReadImportRow[]; problems: ImportProblem[] } {
  const dateIdx = roles.indexOf('date');
  const payeeIdx = roles.indexOf('payee');
  const amountIdx = roles.indexOf('amount');
  const inflowIdx = roles.indexOf('inflow');
  const outflowIdx = roles.indexOf('outflow');
  const notesIdx = roles.indexOf('notes');
  const amountColumns = amountIdx !== -1 ? [amountIdx] : [inflowIdx, outflowIdx];

  const rows: ReadImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Map<string, number>();

  rawRows.forEach((raw, i) => {
    const amountCells = amountColumns.map((idx) => (idx === -1 ? '' : (raw[idx] ?? '')));
    if (amountCells.every((cell) => cell === '')) return;
    const problem = (what: string, cell: string) => {
      problems.push({ row: i + 1, message: `Can't read the ${what} "${cell}"` });
    };

    const dateCell = raw[dateIdx] ?? '';
    const date = parseImportDate(dateCell, conventions.dateOrder);
    if (date === null) return problem('date', dateCell);

    const amounts = amountCells.map((cell) => parseImportAmount(cell, conventions.decimal));
    const unreadable = amounts.indexOf(null);
    if (unreadable !== -1) return problem('amount', amountCells[unreadable]);

    let amount: number;
    if (amountIdx !== -1) {
      amount = amounts[0] ?? 0;
    } else {
      // Some banks write debits in the outflow column as negative numbers
      const inflow = Math.abs(amounts[0] ?? 0);
      const outflow = Math.abs(amounts[1] ?? 0);
      amount = inflow > 0 ? inflow : -outflow;
    }
    if (amount === 0) return;

    // Same limits as the server, so one long memo can't fail the whole import
    const payeeName = payeeIdx !== -1 ? raw[payeeIdx]?.slice(0, 500) || null : null;
    const notes = notesIdx !== -1 ? raw[notesIdx]?.slice(0, 5000) || null : null;
    const key = generateImportId(date, amount, payeeName ?? '');
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const importedId = generateImportId(date, amount, payeeName ?? '', occurrence);
    rows.push({ date, amount, payeeName, notes, importedId });
  });

  return { rows, problems };
}
