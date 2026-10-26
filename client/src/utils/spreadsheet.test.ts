import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  chooseSheet,
  readSpreadsheet,
  sheetLayout,
  sheetText,
  showsDateFormat,
  showsNumberFormat,
  spreadsheetKind,
  textCells,
  SpreadsheetError,
} from './spreadsheet';
import { isDateFormat, numberText, serialToIsoDate, type Sheet } from './spreadsheetCells';
import {
  buildImportRows,
  columnRolesFor,
  detectDateFormat,
  detectNumberFormat,
  readImportAmount,
  type DateFormat,
  type ImportSettings,
  type NumberFormat,
} from './csv';

const utf8 = (text: string) => new TextEncoder().encode(text);
const concat = (parts: Uint8Array[]) => {
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
/** The Excel date number of a day */
const serial = (iso: string) => (Date.parse(iso) - Date.UTC(1899, 11, 30)) / 86_400_000;

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A zip of the given files, compressed like Excel's or stored */
async function zip(files: Record<string, string>, compress = true): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = utf8(text);
    const packed = compress ? await deflate(data) : data;
    const sizes = [u32(0), u32(packed.length), u32(data.length), u16(utf8(name).length), u16(0)];
    const method = u16(compress ? 8 : 0);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      method,
      u32(0),
      ...sizes,
      utf8(name),
      packed,
    ]);
    directory.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        method,
        u32(0),
        ...sizes,
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(at),
        utf8(name),
      ]),
    );
    parts.push(local);
    at += local.length;
  }
  const central = concat(directory);
  const count = u16(directory.length);
  return concat([
    ...parts,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    count,
    count,
    u32(central.length),
    u32(at),
    u16(0),
  ]);
}

const WORKBOOK_RELS =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="x" Target="worksheets/data.xml"/>' +
  '<Relationship Id="rId3" Type="x" Target="worksheets/hidden.xml"/></Relationships>';
const WORKBOOK =
  '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/>' +
  '<sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/>' +
  '<sheet name="Estado &amp; Cuenta" sheetId="2" r:id="rId2"/>' +
  '<sheet name="Oculta" sheetId="3" state="hidden" r:id="rId3"/></sheets></workbook>';
const STYLES =
  '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="4"><alignment/></xf><xf numFmtId="164"/></cellXfs></styleSheet>';
const SHARED =
  '<sst><si><t>Fecha</t></si><si><r><t>Con</t></r><r><t xml:space="preserve">cepto </t></r><rPh><t>x</t></rPh></si>' +
  '<si><t>D&#233;bito</t></si><si><t>Cr&#xE9;dito</t></si></sst>';
// Like Itaú's statement: indented one column and three rows, text dates, real numbers
const DATA_SHEET =
  '<worksheet><sheetData><row r="2"></row>' +
  '<row r="4"><c r="B4" t="inlineStr"><is><t>Moneda</t></is></c><c r="C4" t="inlineStr"><is><t>Pesos</t></is></c></row>' +
  '<row r="7"><c r="B7" t="s"><v>0</v></c><c r="C7" t="s"><v>1</v></c><c r="E7" t="s"><v>2</v></c><c r="F7" t="s"><v>3</v></c></row>' +
  '<row r="8"><c r="B8" t="inlineStr"><is><t>13/05/2026</t></is></c><c r="C8" t="str"><v>COMPRA &lt;FARMASHOP&gt;</v></c><c r="D8" s="1" t="n"/><c r="E8" s="1"><v>610</v></c><c r="F8" t="inlineStr"/></row>' +
  '<row r="9"><c r="B9" s="2"><v>' +
  serial('2026-05-17') +
  '</v></c><c r="C9" t="inlineStr"><is><t>REDIVA</t></is></c><c r="F9" s="1" t="n"><v>45.3</v></c></row>' +
  '</sheetData></worksheet>';

const workbookFiles = {
  '[Content_Types].xml': '<Types/>',
  'xl/workbook.xml': WORKBOOK,
  'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
  'xl/styles.xml': STYLES,
  'xl/sharedStrings.xml': SHARED,
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData><row><c t="inlineStr"><is><t>Total</t></is></c><c><v>12.5</v></c></row></sheetData></worksheet>',
  'xl/worksheets/data.xml': DATA_SHEET,
  'xl/worksheets/hidden.xml': DATA_SHEET,
};

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe('readSpreadsheet (.xlsx)', () => {
  const expected = [
    { name: 'Resumen', rows: [['Total', 12.5]] },
    {
      name: 'Estado & Cuenta',
      rows: [
        ['Moneda', 'Pesos', '', ''],
        ['Fecha', 'Concepto', 'Débito', 'Crédito'],
        ['13/05/2026', 'COMPRA <FARMASHOP>', 610, ''],
        ['2026-05-17', 'REDIVA', '', 45.3],
      ],
    },
  ];

  it('reads the visible sheets: text, numbers and dates, without the empty rows and columns', async () => {
    expect(await readSpreadsheet(await zip(workbookFiles))).toEqual(expected);
    expect(await readSpreadsheet(await zip(workbookFiles, false))).toEqual(expected);
  });

  it('reads formulas by their saved result, and true/false and errors as empty', async () => {
    const files = {
      ...workbookFiles,
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData><row>' +
        '<c><f>SUM(A2:A3)</f><v>7.5</v></c><c t="str"><f>A1&amp;""</f><v>seven</v></c>' +
        '<c><f>NOW()</f></c><c t="b"><v>1</v></c><c t="e"><v>#N/A</v></c>' +
        '<c t="inlineStr"><is><t>  padded  </t></is></c></row></sheetData></worksheet>',
    };
    const [summary] = await readSpreadsheet(await zip(files));
    expect(summary.rows).toEqual([[7.5, 'seven', 'padded']]);
  });

  it('reads date cells written as text by the day, without a time', async () => {
    const files = {
      ...workbookFiles,
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData><row><c t="d"><v>2026-05-03T00:00:00</v></c><c t="d"><v>2026-05-04</v></c>' +
        '</row></sheetData></worksheet>',
    };
    const [summary] = await readSpreadsheet(await zip(files));
    expect(summary.rows).toEqual([['2026-05-03', '2026-05-04']]);
  });

  it('counts days from 1904 in workbooks that say so', async () => {
    const files = {
      ...workbookFiles,
      'xl/workbook.xml': WORKBOOK.replace('<workbookPr/>', '<workbookPr date1904="1"/>'),
    };
    const [, sheet] = await readSpreadsheet(await zip(files));
    expect(sheet.rows[3][0]).toBe(serialToIsoDate(serial('2026-05-17'), true));
    expect(sheet.rows[3][0]).toBe('2030-05-18');
  });

  it('refuses a zip that is not a workbook, a damaged one and other files, saying why', async () => {
    await expect(readSpreadsheet(await zip({ 'hello.txt': 'hi' }))).rejects.toThrow(
      "This file isn't an Excel workbook.",
    );
    const bytes = await zip(workbookFiles);
    await expect(readSpreadsheet(bytes.subarray(0, bytes.length - 30))).rejects.toThrow(
      "This Excel file is damaged and can't be read.",
    );
    await expect(readSpreadsheet(utf8('Date,Amount\n'))).rejects.toThrow(
      "This file isn't an Excel workbook.",
    );
  });

  it('refuses a sheet of more than 5 million cells, counted without empty rows and columns', async () => {
    const letters = (col: number): string =>
      (col >= 26 ? letters(Math.floor(col / 26) - 1) : '') + String.fromCharCode(65 + (col % 26));
    // A diagonal: one cell a row, each in its own column, so 2237 × 2237 cells
    const sheet = (size: number) =>
      '<worksheet><sheetData>' +
      Array.from(
        { length: size },
        (_, i) => `<row><c r="${letters(i)}${i + 1}"><v>1</v></c></row>`,
      ).join('') +
      '</sheetData></worksheet>';
    const files = (size: number) => ({ ...workbookFiles, 'xl/worksheets/sheet1.xml': sheet(size) });
    await expect(readSpreadsheet(await zip(files(2237)))).rejects.toThrow(
      'This Excel file is too large to import.',
    );
    const [summary] = await readSpreadsheet(await zip(files(2236)));
    expect(summary.rows).toHaveLength(2236);
  });

  it('refuses a file that unpacks to more than 200 MB', async () => {
    // Deflate packs a run of one character about a thousand to one
    const files = { ...workbookFiles, 'xl/sharedStrings.xml': 'x'.repeat(201 * 1024 * 1024) };
    await expect(readSpreadsheet(await zip(files))).rejects.toThrow(
      'This Excel file is too large to import.',
    );
  });

  it('never throws anything but its own error on damaged files (property-based)', async () => {
    const bytes = await zip(workbookFiles, false);
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.nat(bytes.length - 1), fc.nat(255)), { minLength: 1, maxLength: 8 }),
        async (changes) => {
          const damaged = bytes.slice();
          for (const [at, value] of changes) damaged[at] = value;
          try {
            await readSpreadsheet(damaged);
          } catch (error) {
            expect(error).toBeInstanceOf(SpreadsheetError);
          }
        },
      ),
    );
  });

  it('never throws anything but its own error on truncated files (property-based)', async () => {
    const bytes = await zip(workbookFiles);
    await fc.assert(
      fc.asyncProperty(fc.nat(bytes.length - 1), async (length) => {
        try {
          await readSpreadsheet(bytes.subarray(0, length));
        } catch (error) {
          expect(error).toBeInstanceOf(SpreadsheetError);
        }
      }),
    );
  });
});

describe('spreadsheet cells', () => {
  it('tells Excel files from text by their first bytes, whatever the file is called', () => {
    expect(spreadsheetKind(new Uint8Array([0x50, 0x4b, 3, 4, 0]))).toBe('xlsx');
    expect(spreadsheetKind(new Uint8Array(OLE_SIGNATURE))).toBe('xls');
    expect(spreadsheetKind(utf8('Fecha,Importe\n'))).toBeNull();
    expect(spreadsheetKind(new Uint8Array())).toBeNull();
  });

  it('knows a date format from a number format', () => {
    expect(isDateFormat(14, undefined)).toBe(true);
    expect(isDateFormat(4, undefined)).toBe(false);
    expect(isDateFormat(164, 'dd/mm/yyyy')).toBe(true);
    expect(isDateFormat(165, '[$-409]d\\-mmm\\-yy;@')).toBe(true);
    expect(isDateFormat(166, '[$-010409]#,##0.00;-#,##0.00')).toBe(false);
    expect(isDateFormat(167, '#,##0.00 "dias"')).toBe(false);
    expect(isDateFormat(168, '[Red]0.00')).toBe(false);
    expect(isDateFormat(0, 'General')).toBe(false);
  });

  it('turns Excel date numbers into calendar days', () => {
    expect(serialToIsoDate(1, false)).toBe('1900-01-01');
    expect(serialToIsoDate(59, false)).toBe('1900-02-28');
    expect(serialToIsoDate(61, false)).toBe('1900-03-01');
    expect(serialToIsoDate(46295.75, false)).toBe('2026-09-30');
    expect(serialToIsoDate(0, true)).toBe('1904-01-01');
    expect(serialToIsoDate(-1, false)).toBeNull();
    expect(serialToIsoDate(Number.NaN, false)).toBeNull();
  });

  it('writes numbers as plain digits, without float noise', () => {
    expect(numberText(0.1 + 0.2, 'dot')).toBe('0.3');
    expect(numberText(-0, 'dot')).toBe('0');
    expect(numberText(1234567.5, 'comma')).toBe('1234567,5');
    expect(numberText(20260517, 'dot')).toBe('20260517');
  });
});

const numberFormat = fc.constantFrom<NumberFormat>('dot', 'comma');
const dateFormat = fc.constantFrom<DateFormat>('mdy', 'dmy', 'ymd');

describe('spreadsheet cells through the import (property-based)', () => {
  it('reads a number amount back as the same cents under either decimal format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -99_999_999_999, max: 99_999_999_999 }),
        numberFormat,
        (cents, format) => {
          // What a spreadsheet holds for an amount: the nearest float to cents / 100
          const [[text]] = sheetText([[cents / 100]], format);
          expect(readImportAmount(text, format)).toBe(cents);
        },
      ),
    );
  });

  it('reads a date cell back as the same day under every date order', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1900-03-01'), max: new Date('2099-12-31'), noInvalidDate: true }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        dateFormat,
        numberFormat,
        (day, time, dates, amounts) => {
          const iso = day.toISOString().slice(0, 10);
          const cell = serialToIsoDate(serial(iso) + time, false)!;
          const rows = sheetText([[cell, -12.5]], amounts);
          const built = buildImportRows(rows, ['date', 'amount'], {
            dateFormat: dates,
            numberFormat: amounts,
          });
          expect(built).toMatchObject({ rows: [{ date: iso, amount: -1250 }] });
        },
      ),
    );
  });

  it('never asks about formats a sheet of real dates and numbers already says', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.date({
              min: new Date('2000-01-01'),
              max: new Date('2030-12-31'),
              noInvalidDate: true,
            }),
            // Amounts like 1.234 would be ambiguous as text
            fc.integer({ min: -9_999_999, max: 9_999_999 }).map((n) => n / 1000),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        (cells) => {
          const rows = cells.map(([day, amount]) => [day.toISOString().slice(0, 10), amount]);
          const text = textCells(rows);
          expect(detectDateFormat(text.map((r) => r[0]))).not.toBeNull();
          expect(detectNumberFormat(text.map((r) => r[1]))).not.toBeNull();
        },
      ),
    );
  });
});

describe('textCells', () => {
  it('leaves out number cells, so only text is looked at to tell formats', () => {
    const rows = [
      ['03/04/2026', 1.234],
      ['2026-05-17', '1.234,56'],
    ];
    expect(textCells(rows)).toEqual([
      ['03/04/2026', ''],
      ['2026-05-17', '1.234,56'],
    ]);
    // Text dates and amounts are still asked about when they could be read two ways
    expect(detectDateFormat(textCells(rows).map((r) => r[0]))).toBeNull();
    expect(detectNumberFormat(textCells([['1.234']]).map((r) => r[0]))).toBeNull();
  });

  it('leaves a whole number in the date column unreadable, not a day count', () => {
    const built = buildImportRows(
      sheetText(
        [
          [46000, -5],
          [20260517, -7],
        ],
        'dot',
      ),
      ['date', 'amount'],
    );
    expect(built).toMatchObject({
      rows: [{ date: '2026-05-17', amount: -700 }],
      skipped: [{ row: 1, field: 'date', value: '46000' }],
    });
  });
});

const settings = (columns: ImportSettings['columns'], skipRows = 0): ImportSettings => ({
  delimiter: ';',
  encoding: 'windows-1252',
  skipRows,
  columns,
  dateFormat: 'dmy',
  numberFormat: 'comma',
  outWord: null,
});

const summary: Sheet = { name: 'Resumen', rows: [['Total', 12.5]] };
const movements: Sheet = {
  name: 'Movimientos',
  rows: [
    ['Cuenta', 'Pesos', ''],
    ['Fecha', 'Concepto', 'Importe'],
    ['13/05/2026', 'Farmashop', -610],
  ],
};
const custom: Sheet = {
  name: 'Mine',
  rows: [
    ['When', 'What', 'How much'],
    ['13/05/2026', 'Farmashop', -610],
  ],
};

// Like Itaú's card statement: the purchase's total and this month's instalment
const card: Sheet = {
  name: 'Tarjeta',
  rows: [
    ['Fecha', 'Concepto', 'Imp. total', 'Imp. cuota'],
    ['2026-09-30', 'DLOPedidosYa', 2000.67, 666.89],
  ],
};
const text = (sheet: Sheet) => sheetText(sheet.rows, 'dot');

describe('sheetLayout', () => {
  it('finds the header under the account details', () => {
    expect(sheetLayout(text(movements), null)).toEqual({ skipRows: 1, usingSaved: false });
  });

  it("uses the account's saved header row when the sheet has those columns", () => {
    const saved = settings({ When: 'date', What: 'payee', 'How much': 'amount' });
    expect(sheetLayout(text(custom), saved)).toEqual({ skipRows: 0, usingSaved: true });
    expect(sheetLayout(text(movements), saved)).toEqual({ skipRows: 1, usingSaved: false });
  });
});

describe('chooseSheet', () => {
  it('opens the first sheet with a date and an amount column', () => {
    expect(chooseSheet([summary, movements, custom].map(text), null)).toBe(1);
  });

  it("opens a sheet with the account's saved columns first", () => {
    const saved = settings({ When: 'date', What: 'payee', 'How much': 'amount' });
    expect(chooseSheet([summary, movements, custom].map(text), saved)).toBe(2);
  });

  it('opens the first sheet when none looks like transactions', () => {
    expect(chooseSheet([summary, custom].map(text), null)).toBe(0);
  });

  it('opens a card statement, its instalment column as the amount', () => {
    expect(chooseSheet([summary, card].map(text), null)).toBe(1);
    expect(columnRolesFor(text(card)[0])).toEqual(['date', 'payee', 'skip', 'amount']);
  });
});

describe('showsDateFormat / showsNumberFormat', () => {
  it('say whether text cells show how the file writes dates and amounts', () => {
    // Real dates and numbers are left empty by textCells: they show nothing
    expect(showsDateFormat(['', '2026-05-17'])).toBe(false);
    expect(showsDateFormat(['2026-05-17', '13/05/2026'])).toBe(true);
    expect(showsDateFormat(['03/04/2026'])).toBe(true);
    expect(showsNumberFormat(['', '610', '-12'])).toBe(false);
    expect(showsNumberFormat(['45,3'])).toBe(true);
    expect(showsNumberFormat(['1.234'])).toBe(true);
  });
});
