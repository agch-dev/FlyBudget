import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readSpreadsheet, sheetText, spreadsheetKind, SpreadsheetError } from './spreadsheet';
import { isDateFormat, numberText, serialToIsoDate } from './spreadsheetCells';
import { parseImportAmount, readTable } from './csv';

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
const f64 = (n: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, n, true);
  return bytes;
};
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

  it('gives the import a table it reads like a CSV file', async () => {
    const [, sheet] = await readSpreadsheet(await zip(workbookFiles));
    const table = readTable(sheetText(sheet.rows, 'comma'));
    expect(table.recognized).toBe(true);
    expect(table.preamble).toEqual([['Moneda', 'Pesos', '', '']]);
    expect(table.rows[1]).toEqual(['2026-05-17', 'REDIVA', '', '45,3']);
  });

  it('refuses a zip that is not a workbook, and a damaged one, with a message', async () => {
    await expect(readSpreadsheet(await zip({ 'hello.txt': 'hi' }))).rejects.toThrow(
      SpreadsheetError,
    );
    const bytes = await zip(workbookFiles);
    await expect(readSpreadsheet(bytes.subarray(0, bytes.length - 30))).rejects.toThrow(
      SpreadsheetError,
    );
    await expect(readSpreadsheet(utf8('Date,Amount\n'))).rejects.toThrow(SpreadsheetError);
  });

  it('never throws anything but its own error on arbitrary bytes (property-based)', async () => {
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
});

// --- .xls: BIFF8 records in an OLE compound file ---

const record = (type: number, ...data: Uint8Array[]) => {
  const body = concat(data);
  return concat([u16(type), u16(body.length), body]);
};
/** Text as .xls stores it: one byte a character, or two */
const chars = (text: string, wide: boolean) =>
  concat([...text].map((c) => (wide ? u16(c.charCodeAt(0)) : new Uint8Array([c.charCodeAt(0)]))));
const xlString = (text: string, wide = false) =>
  concat([u16(text.length), new Uint8Array([wide ? 1 : 0]), chars(text, wide)]);
const cell = (row: number, col: number, style = 0) => concat([u16(row), u16(col), u16(style)]);

const STRINGS = ['Fecha', 'Concepto', 'Imp. cuota', 'Moneda', 'Dólares', '2026-09-30', 'Pesos'];

function workbookStream(): Uint8Array {
  const bof = (kind: number) => record(0x0809, u16(0x0600), u16(kind), new Uint8Array(12));
  const eof = record(0x000a);
  const sheet = (name: string, at: number, hidden = false) =>
    record(
      0x0085,
      u32(at),
      new Uint8Array([hidden ? 1 : 0, 0, name.length, 0]),
      chars(name, false),
    );

  // "Dólares" is cut after two characters: it goes on in a CONTINUE record, which says
  // again how its characters are stored (here one byte each, where it began with two)
  const before = STRINGS.slice(0, 4).map((s) => xlString(s));
  const after = STRINGS.slice(5).map((s) => xlString(s, true));
  const strings = concat([
    record(
      0x00fc,
      u32(STRINGS.length),
      u32(STRINGS.length),
      ...before,
      u16(7),
      new Uint8Array([1]),
      chars('Dó', true),
    ),
    record(0x003c, new Uint8Array([0]), chars('lares', false), ...after),
  ]);

  const summary = concat([bof(0x0010), record(0x00fd, cell(0, 0), u32(0)), eof]);
  const movements = concat([
    bof(0x0010),
    // Indented one column and two rows, like the bank's
    ...[0, 1, 2, 3].map((s, i) => record(0x00fd, cell(2, 1 + i), u32(s))),
    record(0x00fd, cell(3, 1), u32(5)),
    record(0x0204, cell(3, 2), xlString('DLOPedidosYa')),
    record(0x0203, cell(3, 3), f64(666.89)),
    record(0x00fd, cell(3, 4), u32(6)),
    // A real date, a whole number, a number of cents and a formula's text
    record(0x0203, cell(4, 1, 1), f64(serial('2026-10-01'))),
    record(0x0006, cell(4, 2), new Uint8Array([0, 0, 0, 0, 0, 0, 0xff, 0xff]), new Uint8Array(8)),
    record(0x0207, xlString('APPLECOMBILL')),
    record(0x027e, cell(4, 3), u32((303 << 2) | 3)),
    record(0x00fd, cell(4, 4), u32(4)),
    record(
      0x00bd,
      u16(5),
      u16(3),
      u16(0),
      u32((2662 << 2) | 2),
      u16(0),
      u32((-5 << 2) | 2),
      u16(4),
    ),
    eof,
  ]);

  const globals = (summaryAt: number) =>
    concat([
      bof(0x0005),
      record(0x041e, u16(164), xlString('dd/mm/yyyy')),
      record(0x00e0, u16(0), u16(0), new Uint8Array(16)),
      record(0x00e0, u16(0), u16(164), new Uint8Array(16)),
      sheet('Resumen', summaryAt),
      sheet('Movimientos', summaryAt + summary.length),
      sheet('Oculta', summaryAt, true),
      strings,
      eof,
    ]);
  return concat([globals(globals(0).length), summary, movements]);
}

/** An OLE compound file holding `stream` as "Workbook", in big sectors or in the small ones */
function compoundFile(stream: Uint8Array, small: boolean): Uint8Array {
  const sectors = (bytes: Uint8Array, size: number) => {
    const padded = new Uint8Array(Math.ceil(bytes.length / size) * size);
    padded.set(bytes);
    return padded;
  };
  const END = 0xfffffffe;
  const table = (entries: number[]) =>
    concat(Array.from({ length: 128 }, (_, i) => u32(entries[i] ?? 0xffffffff)));
  const entry = (name: string, type: number, start: number, size: number) => {
    const bytes = new Uint8Array(128);
    bytes.set(chars(name, true));
    bytes.set(u16(name.length * 2 + 2), 64);
    bytes[66] = type;
    bytes.set(u32(start), 116);
    bytes.set(u32(size), 120);
    return bytes;
  };

  // Sector 0 is the allocation table, 1 the directory, 2 the small sectors' table
  const data = sectors(small ? sectors(stream, 64) : stream, 512);
  const first = small ? 3 : 2;
  const count = data.length / 512;
  const chain = (n: number, from: number) =>
    Array.from({ length: n }, (_, i) => (i === n - 1 ? END : from + i + 1));
  const fat = table([0xfffffffd, END, ...(small ? [END] : []), ...chain(count, first)]);
  const directory = sectors(
    concat([
      entry('Root Entry', 5, small ? first : END, small ? Math.ceil(stream.length / 64) * 64 : 0),
      entry('Workbook', 2, small ? 0 : first, stream.length),
    ]),
    512,
  );
  const header = new Uint8Array(512).fill(0xff, 76);
  header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
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

describe('readSpreadsheet (.xls)', () => {
  const expected = [
    { name: 'Resumen', rows: [['Fecha']] },
    {
      name: 'Movimientos',
      rows: [
        ['Fecha', 'Concepto', 'Imp. cuota', 'Moneda'],
        ['2026-09-30', 'DLOPedidosYa', 666.89, 'Pesos'],
        ['2026-10-01', 'APPLECOMBILL', 3.03, 'Dólares'],
        ['', '', 2662, -5],
      ],
    },
  ];
  // Big sectors hold streams of 4096 bytes and more
  const padded = concat([workbookStream(), new Uint8Array(4096)]);

  it('reads the visible sheets from a stream in big sectors', async () => {
    expect(await readSpreadsheet(compoundFile(padded, false))).toEqual(expected);
  });

  it('reads a small workbook, kept in the small sectors', async () => {
    expect(workbookStream().length).toBeLessThan(4096);
    expect(await readSpreadsheet(compoundFile(workbookStream(), true))).toEqual(expected);
  });

  it('refuses files it cannot read with a message, never a crash (property-based)', async () => {
    const bytes = compoundFile(padded, false);
    await expect(readSpreadsheet(bytes.subarray(0, 600))).rejects.toThrow(SpreadsheetError);
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(fc.nat(1535 + workbookStream().length), fc.nat(255)), {
          minLength: 1,
          maxLength: 8,
        }),
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
});

describe('spreadsheet cells', () => {
  it('tells Excel files from text by their first bytes, whatever the file is called', () => {
    expect(spreadsheetKind(new Uint8Array([0x50, 0x4b, 3, 4, 0]))).toBe('xlsx');
    expect(spreadsheetKind(compoundFile(new Uint8Array(4096), false))).toBe('xls');
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

  it('writes a number of cents so the import reads the same cents back (property-based)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -99_999_999_999, max: 99_999_999_999 }),
        fc.constantFrom('comma' as const, 'point' as const),
        (cents, decimal) => {
          // What a spreadsheet holds for an amount: the nearest float to cents / 100
          expect(parseImportAmount(numberText(cents / 100, decimal), decimal)).toBe(cents);
        },
      ),
    );
    expect(numberText(0.1 + 0.2, 'point')).toBe('0.3');
    expect(numberText(-0, 'point')).toBe('0');
    // More than cents: left as it is, so it is refused as an amount, never rounded
    expect(numberText(3940.453, 'comma')).toBe('3940,453');
    expect(parseImportAmount(numberText(3940.453, 'comma'), 'comma')).toBeNull();
  });
});
