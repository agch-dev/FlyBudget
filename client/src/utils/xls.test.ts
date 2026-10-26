import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readSpreadsheet, spreadsheetKind, SpreadsheetError, type Sheet } from './spreadsheet';

// .xls files: BIFF8 records in an OLE compound file, written here record by record

const concat = (parts: ArrayLike<number>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
const u32 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]);
const f64 = (n: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, n, true);
  return bytes;
};
const utf8 = (text: string) => new TextEncoder().encode(text);
const DAY_MS = 86_400_000;

const record = (type: number, ...data: ArrayLike<number>[]) => {
  const body = concat(data);
  return concat([u16(type), u16(body.length), body]);
};
/** Text as .xls stores it: one byte a character, or two */
const chars = (text: string, wide: boolean) => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out.push(code & 0xff);
    if (wide) out.push(code >> 8);
  }
  return out;
};
const isWide = (text: string) => [...text].some((c) => c.charCodeAt(0) > 0xff);
const xlString = (text: string, wide = isWide(text)) =>
  concat([u16(text.length), [wide ? 1 : 0], chars(text, wide)]);
const cellAt = (row: number, col: number, style = 0) => concat([u16(row), u16(col), u16(style)]);

const BOF = 0x0809;
const EOF = record(0x000a);
const bof = (kind: number, version = 0x0600) =>
  record(BOF, u16(version), u16(kind), new Uint8Array(12));

/** A cell for the builder: text, a number, or a number shown as a date */
type XlsCell = string | number | { date: string } | { serial: number };

interface SheetSpec {
  name: string;
  rows?: XlsCell[][];
  /** Records written after the rows, as they are */
  records?: Uint8Array[];
  /** BOUNDSHEET's visibility (0 visible, 1 hidden, 2 very hidden) and type (0 worksheet) */
  hidden?: number;
  type?: number;
}

interface BookSpec {
  sheets: SheetSpec[];
  date1904?: boolean;
  /** Records written after the BOF of the workbook's own part */
  globals?: Uint8Array[];
  /** The longest an SST record may be before it goes on in CONTINUE records (Excel: 8224) */
  maxRecord?: number;
}

/** The strings table, split into CONTINUE records like Excel does (8224 bytes a record) */
function stringTable(strings: string[], max: number): Uint8Array {
  const chunks: number[][] = [[...u32(strings.length), ...u32(strings.length)]];
  let current = chunks[0];
  const room = () => max - current.length;
  const next = (flags: number[]) => chunks.push((current = [...flags]));
  for (const text of strings) {
    const wide = isWide(text);
    const header = [...u16(text.length), wide ? 1 : 0];
    if (room() < header.length + (wide ? 2 : 1)) next([]);
    current.push(...header);
    const units = chars(text, wide);
    const size = wide ? 2 : 1;
    let at = 0;
    while (at < units.length) {
      const take = Math.floor(room() / size) * size;
      // The rest of the text goes on in the next record, which says again how wide it is
      if (take === 0) next([wide ? 1 : 0]);
      else {
        current.push(...units.slice(at, at + take));
        at += take;
      }
    }
  }
  return concat(chunks.map((chunk, i) => record(i === 0 ? 0x00fc : 0x003c, chunk)));
}

const serialOf = (iso: string, date1904: boolean) =>
  (Date.parse(iso) - (date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30))) / DAY_MS;

/** A BIFF8 workbook stream: style 0 shows numbers as they are, style 1 as dates */
function workbookStream(book: BookSpec): Uint8Array {
  const strings: string[] = [];
  const indexOf = new Map<string, number>();
  const sheetParts = book.sheets.map((sheet) => {
    const cells = (sheet.rows ?? []).flatMap((row, r) =>
      row.map((value, c) => {
        if (value === '') return new Uint8Array();
        if (typeof value === 'string') {
          if (!indexOf.has(value)) indexOf.set(value, strings.push(value) - 1);
          return record(0x00fd, cellAt(r, c), u32(indexOf.get(value)!));
        }
        if (typeof value === 'number') return record(0x0203, cellAt(r, c), f64(value));
        const serial = 'date' in value ? serialOf(value.date, !!book.date1904) : value.serial;
        return record(0x0203, cellAt(r, c, 1), f64(serial));
      }),
    );
    return concat([bof(0x0010), ...cells, ...(sheet.records ?? []), EOF]);
  });

  const globals = (offsets: number[]) =>
    concat([
      bof(0x0005),
      ...(book.globals ?? []),
      ...(book.date1904 ? [record(0x0022, u16(1))] : []),
      record(0x041e, u16(164), xlString('dd/mm/yyyy')),
      record(0x00e0, u16(0), u16(0), new Uint8Array(16)),
      record(0x00e0, u16(0), u16(164), new Uint8Array(16)),
      ...book.sheets.map((sheet, i) =>
        record(
          0x0085,
          u32(offsets[i] ?? 0),
          [sheet.hidden ?? 0, sheet.type ?? 0],
          [sheet.name.length, 0],
          chars(sheet.name, false),
        ),
      ),
      stringTable(strings, book.maxRecord ?? 8224),
      EOF,
    ]);
  let at = globals([]).length;
  const offsets = sheetParts.map((part) => {
    const offset = at;
    at += part.length;
    return offset;
  });
  return concat([globals(offsets), ...sheetParts]);
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const END = 0xfffffffe;

interface CompoundOptions {
  /** Kept in the 64-byte sectors (streams under 4096 bytes are) */
  small?: boolean;
  name?: string;
  /** Further (empty) streams in the directory */
  others?: string[];
}

/** An OLE compound file holding `stream`, in big sectors or in the small ones */
function compoundFile(stream: Uint8Array, options: CompoundOptions = {}): Uint8Array {
  const { small = false, name = 'Workbook', others = [] } = options;
  const sectors = (bytes: Uint8Array, size: number) => {
    const padded = new Uint8Array(Math.max(1, Math.ceil(bytes.length / size)) * size);
    padded.set(bytes);
    return padded;
  };
  const table = (entries: number[]) =>
    concat(Array.from({ length: 128 }, (_, i) => u32(entries[i] ?? 0xffffffff)));
  const entry = (entryName: string, type: number, start: number, size: number) => {
    const bytes = new Uint8Array(128);
    bytes.set(chars(entryName, true));
    bytes.set(u16(entryName.length * 2 + 2), 64);
    bytes[66] = type;
    bytes.set(u32(start), 116);
    bytes.set(u32(size), 120);
    return bytes;
  };

  // Sector 0 is the allocation table, 1 the directory, 2 the small sectors' table
  const data = sectors(small ? sectors(stream, 64) : stream, 512);
  const first = small ? 3 : 2;
  const count = data.length / 512;
  if (first + count > 128) throw new Error('Too large for one allocation table sector');
  const chain = (n: number, from: number) =>
    Array.from({ length: n }, (_, i) => (i === n - 1 ? END : from + i + 1));
  const fat = table([0xfffffffd, END, ...(small ? [END] : []), ...chain(count, first)]);
  const directory = sectors(
    concat([
      entry('Root Entry', 5, small ? first : END, small ? Math.ceil(stream.length / 64) * 64 : 0),
      entry(name, 2, small ? 0 : first, stream.length),
      ...others.map((other) => entry(other, 2, END, 0)),
    ]),
    512,
  );
  if (directory.length > 512) throw new Error('Too many streams');
  const header = new Uint8Array(512).fill(0xff, 76);
  header.set(OLE_SIGNATURE);
  header.set(u16(9), 30);
  header.set(u16(6), 32);
  header.set(u32(1), 44);
  header.set(u32(1), 48);
  header.set(u32(4096), 56);
  header.set(u32(small ? 2 : END), 60);
  header.set(u32(small ? 1 : 0), 64);
  header.set(u32(END), 68);
  header.set(u32(0), 72);
  header.set(u32(0), 76);
  const miniTable = small ? [table(chain(Math.ceil(stream.length / 64), 0))] : [];
  return concat([header, fat, directory, ...miniTable, data]);
}

/** A whole .xls file; streams of 4096 bytes and more go in big sectors */
const xls = (book: BookSpec) => {
  const stream = workbookStream(book);
  return compoundFile(stream, { small: stream.length < 4096 });
};

/** Where each record of a stream starts */
function recordsOf(stream: Uint8Array): { type: number; at: number; length: number }[] {
  const found = [];
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  for (let at = 0; at + 4 <= stream.length;) {
    const length = view.getUint16(at + 2, true);
    found.push({ type: view.getUint16(at, true), at, length });
    at += 4 + length;
  }
  return found;
}

/** Where the first string's length is in records with text: SST, FORMAT, BOUNDSHEET */
const STRING_AT: Record<number, number> = { 0x00fc: 8, 0x041e: 2, 0x0085: 6 };

const DAMAGED = "This Excel file is damaged and can't be read.";

/** Reads a file that may be damaged: sheets or our own error, and quickly */
async function readsCleanly(bytes: Uint8Array): Promise<void> {
  const start = performance.now();
  try {
    const sheets = await readSpreadsheet(bytes);
    expect(Array.isArray(sheets)).toBe(true);
  } catch (error) {
    expect(error).toBeInstanceOf(SpreadsheetError);
  }
  expect(performance.now() - start).toBeLessThan(1000);
}

describe('readSpreadsheet (.xls)', () => {
  // Like Itaú's card statement: a summary first, the table indented one column and two rows
  const statement: BookSpec = {
    sheets: [
      { name: 'Resumen', rows: [['Total'], [1234.5]] },
      {
        name: 'Movimientos',
        rows: [
          [],
          [],
          ['', 'Fecha', 'Concepto', 'Imp. cuota', 'Moneda'],
          ['', { date: '2026-09-30' }, 'DLOPedidosYa', 666.89, 'Pesos'],
          ['', '13/10/2026', 'Farmacia Ñandú', -45.3, 'Dólares'],
        ],
      },
      { name: 'Oculta', rows: [['Fecha']], hidden: 1 },
      { name: 'Muy oculta', rows: [['Fecha']], hidden: 2 },
      { name: 'Gráfico', rows: [['Fecha']], type: 2 },
      { name: 'Macros', rows: [['Fecha']], type: 1 },
    ],
  };
  const expected: Sheet[] = [
    { name: 'Resumen', rows: [['Total'], [1234.5]] },
    {
      name: 'Movimientos',
      rows: [
        ['Fecha', 'Concepto', 'Imp. cuota', 'Moneda'],
        ['2026-09-30', 'DLOPedidosYa', 666.89, 'Pesos'],
        ['13/10/2026', 'Farmacia Ñandú', -45.3, 'Dólares'],
      ],
    },
  ];

  it('reads the visible worksheets, from big sectors or the small ones', async () => {
    const stream = workbookStream(statement);
    expect(stream.length).toBeLessThan(4096);
    expect(await readSpreadsheet(compoundFile(stream, { small: true }))).toEqual(expected);
    // Big sectors hold streams of 4096 bytes and more
    const padded = concat([stream, new Uint8Array(4096)]);
    expect(await readSpreadsheet(compoundFile(padded))).toEqual(expected);
  });

  it('reads text cut into CONTINUE records, two bytes a character or one', async () => {
    const long = 'Transferencia recibida — ' + 'á'.repeat(60) + ' ✓ ' + 'x'.repeat(50);
    const book: BookSpec = {
      sheets: [
        {
          name: 'Hoja1',
          rows: [
            ['Fecha', 'Concepto'],
            ['Ñandú', long],
            ['€', 'abc'],
          ],
        },
      ],
      maxRecord: 37,
    };
    const [sheet] = await readSpreadsheet(xls(book));
    expect(sheet.rows).toEqual([
      ['Fecha', 'Concepto'],
      ['Ñandú', long],
      ['€', 'abc'],
    ]);
  });

  it('reads every kind of number cell, formulas by their saved result', async () => {
    const formula = (row: number, col: number, result: ArrayLike<number>, style = 0) =>
      record(0x0006, cellAt(row, col, style), result, new Uint8Array(6), u16(0));
    const special = (kind: number, value = 0) => [kind, 0, value, 0, 0, 0, 0xff, 0xff];
    const [sheet] = await readSpreadsheet(
      xls({
        sheets: [
          {
            name: 'Hoja1',
            records: [
              // RK: a whole number, and a number of cents (÷ 100)
              record(0x027e, cellAt(0, 0), u32((303 << 2) | 3)),
              record(0x027e, cellAt(0, 1), u32((-5 << 2) | 2)),
              // RK as a float's top half: 2.5
              record(0x027e, cellAt(0, 2), u32(0x40040000)),
              // MULRK: three cells in a row, the last a date
              record(
                0x00bd,
                u16(1),
                u16(0),
                u16(0),
                u32((2662 << 2) | 2),
                u16(0),
                u32((1 << 2) | 3),
                u16(1),
                u32((serialOf('2026-01-31', false) << 2) | 2),
                u16(2),
              ),
              // Formulas: a number, a date, a text (in the STRING after it, maybe after the
              // shared formula), and true, an error and an empty result as empty
              formula(2, 0, f64(12.5)),
              formula(2, 1, f64(serialOf('2026-02-01', false)), 1),
              formula(2, 2, special(0)),
              record(0x04bc, new Uint8Array(10)),
              record(0x0207, xlString('  APPLECOMBILL  ')),
              formula(2, 3, special(1, 1)),
              formula(2, 4, special(2, 7)),
              formula(2, 5, special(3)),
              // A text formula whose STRING never came doesn't fill the next cell
              formula(3, 0, special(0)),
              record(0x0203, cellAt(3, 1), f64(7)),
              record(0x0207, xlString('stray')),
              // A true/false or error cell, a blank one and a label written in place
              record(0x0205, cellAt(3, 2), [1, 0]),
              record(0x0201, cellAt(3, 3)),
              record(0x0204, cellAt(3, 4), xlString(' Débito ')),
              // Rich text written in place, its formatting runs after it
              record(0x00d6, cellAt(3, 5), xlString('Crédito'), u16(1), u32(0)),
            ],
          },
        ],
      }),
    );
    // Column D is empty throughout (a true/false, an error, a blank)
    expect(sheet.rows).toEqual([
      [3.03, -5, 2.5, '', ''],
      [2662, 0.01, '2026-01-31', '', ''],
      [12.5, '2026-02-01', 'APPLECOMBILL', '', ''],
      ['', 7, '', 'Débito', 'Crédito'],
    ]);
  });

  it('reads shared strings with formatting runs and phonetic text, leaving both out', async () => {
    // "Café!" with 2 formatting runs and 6 bytes of phonetic text, the runs going on in a
    // CONTINUE record (without the byte that says how wide characters are), then "Total"
    const sst = concat([
      record(0x00fc, u32(2), u32(2), u16(5), [0x0c], u16(2), u32(6), chars('Café!', false), u32(0)),
      record(0x003c, u32(0), new Uint8Array(6), xlString('Total')),
    ]);
    const globals = concat([
      bof(0x0005),
      record(0x0085, u32(0), [0, 0], [5, 0], chars('Hoja1', false)),
      sst,
      EOF,
    ]);
    const stream = concat([
      globals,
      bof(0x0010),
      record(0x00fd, cellAt(0, 0), u32(0)),
      record(0x00fd, cellAt(0, 1), u32(1)),
      // A string the table doesn't have
      record(0x00fd, cellAt(0, 2), u32(9)),
      EOF,
    ]);
    new DataView(stream.buffer).setUint32(recordsOf(stream)[1].at + 4, globals.length, true);
    const [sheet] = await readSpreadsheet(compoundFile(stream, { small: true }));
    expect(sheet.rows).toEqual([['Café!', 'Total']]);
  });

  it('ends a sheet at its own EOF, after the charts drawn in it', async () => {
    const [sheet] = await readSpreadsheet(
      xls({
        sheets: [
          {
            name: 'Hoja1',
            rows: [['Fecha']],
            // A chart's own BOF…EOF block: its cells aren't the sheet's
            records: [
              bof(0x0020),
              record(0x0203, cellAt(5, 5), f64(1)),
              EOF,
              record(0x0203, cellAt(1, 0), f64(2)),
            ],
          },
        ],
      }),
    );
    expect(sheet.rows).toEqual([['Fecha'], [2]]);
  });

  it('counts days from 1900 or from 1904, as the workbook says', async () => {
    const days = [1, 59, 61, 45_000, 45_000.75, 2_958_465];
    const read = async (date1904: boolean) => {
      const [sheet] = await readSpreadsheet(
        xls({ date1904, sheets: [{ name: 'Hoja1', rows: [days.map((serial) => ({ serial }))] }] }),
      );
      return sheet.rows[0];
    };
    expect(await read(false)).toEqual([
      '1900-01-01',
      '1900-02-28',
      '1900-03-01',
      '2023-03-15',
      '2023-03-15',
      '9999-12-31',
    ]);
    expect(await read(true)).toEqual([
      '1904-01-02',
      '1904-02-29',
      '1904-03-02',
      '2027-03-16',
      '2027-03-16',
      // Past the end of 9999: left a number
      2_958_465,
    ]);
  });

  it('reads a sheet listed twice once, and refuses more than 256 sheets', async () => {
    const stream = workbookStream({
      sheets: [
        { name: 'A', rows: [['Fecha']] },
        { name: 'B', rows: [['Importe']] },
      ],
    });
    const [first, second] = recordsOf(stream).filter((r) => r.type === 0x0085);
    const view = new DataView(stream.buffer);
    view.setUint32(second.at + 4, view.getUint32(first.at + 4, true), true);
    expect(await readSpreadsheet(compoundFile(stream, { small: true }))).toEqual([
      { name: 'A', rows: [['Fecha']] },
      { name: 'B', rows: [['Fecha']] },
    ]);

    const sheets = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `H${i}`, rows: [[i]] }));
    const book = (n: number) => compoundFile(workbookStream({ sheets: sheets(n) }));
    expect(await readSpreadsheet(book(256))).toHaveLength(256);
    await expect(readSpreadsheet(book(257))).rejects.toThrow(
      'This Excel file is too large to import.',
    );
  });

  it('refuses a sheet of more than 5 million cells, counted without empty rows and columns', async () => {
    // A diagonal of 2237 cells is 2237 × 2237 cells once empty ones are left out
    const diagonal = (size: number) =>
      Array.from({ length: size }, (_, i) => record(0x027e, cellAt(i, i), u32((1 << 2) | 2)));
    const file = (size: number) =>
      compoundFile(workbookStream({ sheets: [{ name: 'Hoja1', records: diagonal(size) }] }));
    await expect(readSpreadsheet(file(2237))).rejects.toThrow(
      'This Excel file is too large to import.',
    );
    const [sheet] = await readSpreadsheet(file(2236));
    expect(sheet.rows).toHaveLength(2236);
  });

  it('refuses a file larger than 200 MB', async () => {
    const huge = new Uint8Array(200 * 1024 * 1024 + 1);
    huge.set(OLE_SIGNATURE);
    await expect(readSpreadsheet(huge)).rejects.toThrow('This Excel file is too large to import.');
  });

  it('refuses the files it cannot read, saying why', async () => {
    const workbook = workbookStream(statement);
    const refuses = (bytes: Uint8Array, message: string) =>
      expect(readSpreadsheet(bytes)).rejects.toThrow(message);

    await refuses(compoundFile(workbook).subarray(0, 600), DAMAGED);
    await refuses(new Uint8Array([...OLE_SIGNATURE, ...new Uint8Array(504)]), DAMAGED);

    // Excel 95 and older: BIFF5 in a "Book" stream, BIFF2-4 files on their own
    const tooOld =
      "This Excel file is from an older Excel version FlyBudget can't read. Save it as .xlsx and import that.";
    const biff5 = concat([bof(0x0005, 0x0500), EOF]);
    await refuses(compoundFile(biff5, { small: true, name: 'Book' }), tooOld);
    await refuses(concat([record(0x0409, u16(0), u16(0x0010), u16(0)), EOF]), tooOld);
    await refuses(concat([record(0x0009, u16(2), u16(0x0010)), EOF]), tooOld);

    const password = 'This Excel file has a password. Save a copy without one and import that.';
    const locked = concat([bof(0x0005), record(0x002f, u16(1), new Uint8Array(52)), EOF]);
    await refuses(compoundFile(locked, { small: true }), password);
    // An .xlsx with a password is an OLE file too
    await refuses(
      compoundFile(new Uint8Array(100), {
        small: true,
        name: 'EncryptionInfo',
        others: ['EncryptedPackage'],
      }),
      password,
    );

    // A Word document
    await refuses(
      compoundFile(new Uint8Array(100), { small: true, name: 'WordDocument' }),
      "This file isn't an Excel workbook.",
    );

    const webPage =
      'This file is a web page saved as .xls. Open it in Excel or LibreOffice, save it as .xlsx and import that.';
    await refuses(utf8('<html xmlns:o="urn:schemas-microsoft-com:office:office"><body>'), webPage);
    await refuses(utf8('﻿\r\n  <TABLE border=1><tr><td>Fecha</td></tr></TABLE>'), webPage);
    const utf16 = new Uint8Array(chars('﻿<meta charset="utf-16"><table>', true));
    await refuses(utf16, webPage);
  });

  it('tells .xls files and web pages from text by their first bytes, whatever the name', () => {
    expect(spreadsheetKind(xls(statement))).toBe('xls');
    expect(spreadsheetKind(concat([record(0x0209, u16(0), u16(0x0010)), EOF]))).toBe('xls');
    expect(spreadsheetKind(utf8('<html><table>'))).toBe('html');
    expect(spreadsheetKind(utf8(`<head>${' '.repeat(1500)}</head><table>`))).toBe('html');
    expect(spreadsheetKind(utf8(`<!-- ${'x'.repeat(4000)} --><table>`))).toBeNull();
    // Text that only mentions a table, a CAMT statement, an Excel 2003 XML workbook
    expect(spreadsheetKind(utf8('Fecha,Concepto\n2026-01-01,<table> legs\n'))).toBeNull();
    expect(spreadsheetKind(utf8('<?xml version="1.0"?><Document><BkToCstmrStmt>'))).toBeNull();
    expect(
      spreadsheetKind(utf8('<?xml version="1.0"?><Workbook><Worksheet><Table><Row>')),
    ).toBeNull();
    // Tab-separated text, in UTF-16 too
    expect(spreadsheetKind(new Uint8Array(chars('\tFecha\tImporte\n', true)))).toBeNull();
    expect(spreadsheetKind(new Uint8Array(chars('\t\n\t\n', true)))).toBeNull();
  });
});

describe('readSpreadsheet (.xls, property-based)', () => {
  const text = fc
    .string({ unit: fc.constantFrom('a', 'Z', ' ', 'ñ', 'é', '€', '✓', '日', '7', ',', '-') })
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const number = fc
    .double({ noNaN: true, noDefaultInfinity: true })
    .map((n) => (Object.is(n, -0) ? 0 : n));
  const day = fc
    .integer({ min: Date.UTC(1904, 0, 1), max: Date.UTC(9999, 11, 31) })
    .map((ms) => new Date(Math.floor(ms / DAY_MS) * DAY_MS).toISOString().slice(0, 10));
  const cell: fc.Arbitrary<XlsCell> = fc.oneof(
    text,
    number,
    day.map((date) => ({ date })),
    fc.constant(''),
  );
  const sheets = fc.array(
    fc.record({
      name: fc.string({ unit: fc.constantFrom('a', 'B', '1', ' '), minLength: 1, maxLength: 12 }),
      rows: fc.array(fc.array(cell, { maxLength: 6 }), { maxLength: 8 }),
    }),
    { minLength: 1, maxLength: 3 },
  );
  const book = fc.record({
    sheets,
    date1904: fc.boolean(),
    maxRecord: fc.integer({ min: 12, max: 8224 }),
  });

  /** What the reader should give: dates as days, without empty rows and columns */
  const shown = (spec: BookSpec): Sheet[] =>
    spec.sheets.map(({ name, rows = [] }) => {
      const values = rows.map((row) =>
        row.map((value) => (typeof value === 'object' && 'date' in value ? value.date : value)),
      );
      const filled = values.filter((row) => row.some((value) => value !== ''));
      const width = Math.max(0, ...values.map((row) => row.length));
      const columns = Array.from({ length: width }, (_, c) => c).filter((c) =>
        filled.some((row) => (row[c] ?? '') !== ''),
      );
      return { name, rows: filled.map((row) => columns.map((c) => row[c] ?? '')) as Sheet['rows'] };
    });

  it('reads back the text, numbers and dates it was written with', async () => {
    await fc.assert(
      fc.asyncProperty(book, async (spec) => {
        expect(await readSpreadsheet(xls(spec))).toEqual(shown(spec));
      }),
    );
  });

  it('never fails but with its own error, and quickly, on random bytes after the signature', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 8192 }), fc.boolean(), async (bytes, sizes) => {
        const file = concat([OLE_SIGNATURE, bytes]);
        // Half of them with sector sizes it reads, so the rest of the header is looked at
        if (sizes && file.length >= 34) file.set([9, 0, 6, 0], 30);
        await readsCleanly(file);
      }),
    );
  });

  it('never fails but with its own error, and quickly, on random header fields', async () => {
    const valid = xls({ sheets: [{ name: 'Hoja1', rows: [['Fecha', 1]] }] });
    // The header's numbers, then the allocation table's
    const field = fc.oneof(
      fc.constantFrom(30, 32, 44, 48, 56, 60, 64, 68, 72, 76, 80),
      fc.nat(127).map((i) => 512 + i * 4),
    );
    const value = fc.oneof(
      fc.nat(16),
      fc.constantFrom(0xfffffffa, 0xfffffffd, 0xfffffffe, 0xffffffff, 0x7fffffff),
      fc.nat(),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(field, value), { minLength: 1, maxLength: 4 }),
        async (changes) => {
          const damaged = valid.slice();
          for (const [at, n] of changes) damaged.set(u32(n), at);
          await readsCleanly(damaged);
        },
      ),
    );
  });

  it('never fails but with its own error, and quickly, on damaged files', async () => {
    const files = book.chain((spec) => {
      const stream = workbookStream(spec);
      const records = recordsOf(stream);
      const strings = records.filter((r) => r.type in STRING_AT);
      const damage = fc.oneof(
        // Byte flips
        fc
          .array(fc.tuple(fc.nat(), fc.nat(255)), { minLength: 1, maxLength: 8 })
          .map((flips) => (file: Uint8Array) => {
            for (const [at, value] of flips) file[at % file.length] = value;
            return file;
          }),
        // Cut short
        fc.nat().map((n) => (file: Uint8Array) => file.subarray(0, n % file.length)),
        // A sector chain that loops, or that points past the end
        fc
          .tuple(fc.nat(127), fc.oneof(fc.nat(127), fc.integer({ min: 128, max: 0xfffffff9 })))
          .map(([from, to]) => (file: Uint8Array) => {
            file.set(u32(to), 512 + from * 4);
            return file;
          }),
      );
      const streamDamage = fc.oneof(
        // A string's length that is wrong
        fc
          .tuple(fc.nat(Math.max(0, strings.length - 1)), fc.nat(0xffff))
          .map(([i, length]) => (s: Uint8Array) => {
            const found = strings[i];
            if (!found) return s;
            const at = found.at + 4 + STRING_AT[found.type];
            if (found.type === 0x0085) s[at] = length & 0xff;
            else s.set(u16(length), at);
            return s;
          }),
        // A record's length that is wrong
        fc
          .tuple(fc.nat(records.length - 1), fc.nat(0xffff))
          .map(([i, length]) => (s: Uint8Array) => {
            s.set(u16(length), records[i].at + 2);
            return s;
          }),
        // CONTINUE records where they don't belong
        fc
          .tuple(fc.nat(records.length), fc.uint8Array({ maxLength: 40 }))
          .map(([i, data]) => (s: Uint8Array) => {
            const at = records[i]?.at ?? s.length;
            return concat([s.subarray(0, at), record(0x003c, data), s.subarray(at)]);
          }),
      );
      return fc.tuple(fc.constant(stream), fc.option(streamDamage), fc.option(damage));
    });
    await fc.assert(
      fc.asyncProperty(files, async ([stream, streamDamage, damage]) => {
        const changed = streamDamage ? streamDamage(stream.slice()) : stream;
        const file = compoundFile(changed, { small: changed.length < 4096 });
        await readsCleanly(damage ? damage(file) : file);
      }),
    );
  });
});
