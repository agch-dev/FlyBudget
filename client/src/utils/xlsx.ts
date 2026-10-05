import {
  SpreadsheetError,
  denseRows,
  isDateFormat,
  serialToIsoDate,
  setCell,
  type Cell,
  type Sheet,
  type SparseRows,
} from './spreadsheetCells';

// Reads Excel workbooks (.xlsx, .xltx, .xlsm): a zip of XML files. Only what an import
// needs: each sheet's cell values. Files come from banks, so they are untrusted input:
// sizes are capped and nothing in the file is ever run or fetched.

/** A workbook's unpacked files may not be larger than this in total */
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;

const corrupt = () => new SpreadsheetError("This Excel file is damaged and can't be read.");

interface ZipEntry {
  method: number;
  compressedSize: number;
  size: number;
  headerAt: number;
}

/** The files of a zip, by name, from its central directory (at the end of the file) */
function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  // The directory's end record is last, before an optional comment of up to 64 KB
  const lowest = Math.max(0, end - 0xffff);
  while (end >= lowest && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < lowest) throw corrupt();

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw corrupt();
    const nameLength = view.getUint16(at + 28, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      headerAt: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

/** Unpacks one file of the zip as text, never producing more than `budget.left` bytes */
async function unzipText(
  bytes: Uint8Array,
  entry: ZipEntry,
  budget: { left: number },
): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.headerAt;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw corrupt();
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const packed = bytes.subarray(start, start + entry.compressedSize);
  if (packed.length !== entry.compressedSize) throw corrupt();

  const tooLarge = () => new SpreadsheetError('This Excel file is too large to import.');
  if (entry.method === 0) {
    if ((budget.left -= packed.length) < 0) throw tooLarge();
    return new TextDecoder().decode(packed);
  }
  if (entry.method !== 8) throw corrupt();

  // The size in the zip's directory is the file's own claim: count what really comes out
  const stream = new Blob([packed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((budget.left -= value.length) < 0) {
        void reader.cancel();
        throw tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    throw corrupt();
  }
  return text + decoder.decode();
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The text of an XML attribute or element: `&amp;` and `&#233;` back to characters */
function xmlText(raw: string): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : +name.slice(1);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

/** An attribute of an opening tag (`attrs` is the text between the tag name and `>`) */
function attr(attrs: string, name: string): string | undefined {
  const found = attrs.match(
    new RegExp(`(?:^|\\s)(?:\\w+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`),
  );
  return found ? xmlText(found[1] ?? found[2]) : undefined;
}

// Element names may carry a namespace prefix (`<x:c>`), depending on what wrote the file.
/** Every `<name …>…</name>` or `<name …/>` in `xml`: its attributes and what it contains */
function* elements(xml: string, name: string): Generator<{ attrs: string; body: string }> {
  const open = new RegExp(`<(?:\\w+:)?${name}(\\s[^>]*?)?(/?)>`, 'g');
  const close = new RegExp(`</(?:\\w+:)?${name}>`, 'g');
  for (let found = open.exec(xml); found; found = open.exec(xml)) {
    const attrs = found[1] ?? '';
    if (found[2] === '/') {
      yield { attrs, body: '' };
      continue;
    }
    close.lastIndex = open.lastIndex;
    const end = close.exec(xml);
    if (!end) return;
    yield { attrs, body: xml.slice(open.lastIndex, end.index) };
    open.lastIndex = close.lastIndex;
  }
}

/** The text of a string item: its `<t>` runs joined, without phonetic guides (`<rPh>`) */
function stringItem(xml: string): string {
  const spoken = xml.includes('rPh')
    ? xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
    : xml;
  let text = '';
  for (const t of elements(spoken, 't')) text += xmlText(t.body);
  return text;
}

/** `B4` → column 1 */
function columnOf(ref: string): number {
  let col = 0;
  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i) - 64;
    if (code < 1 || code > 26) break;
    col = col * 26 + code;
  }
  return col - 1;
}

/** For each cell style, whether it shows numbers as dates */
function dateStyles(stylesXml: string | undefined): boolean[] {
  if (!stylesXml) return [];
  const codes = new Map<number, string>();
  for (const { attrs } of elements(stylesXml, 'numFmt')) {
    codes.set(Number(attr(attrs, 'numFmtId')), attr(attrs, 'formatCode') ?? '');
  }
  const [cellXfs] = elements(stylesXml, 'cellXfs');
  if (!cellXfs) return [];
  return [...elements(cellXfs.body, 'xf')].map(({ attrs }) => {
    const id = Number(attr(attrs, 'numFmtId') ?? 0);
    return isDateFormat(id, codes.get(id));
  });
}

function readSheet(
  xml: string,
  strings: string[],
  isDateStyle: boolean[],
  date1904: boolean,
): Cell[][] {
  const rows: SparseRows = new Map();
  let nextRow = 0;
  for (const row of elements(xml, 'row')) {
    const r = Number(attr(row.attrs, 'r'));
    const rowAt = r >= 1 ? r - 1 : nextRow;
    nextRow = rowAt + 1;
    let nextCol = 0;
    for (const cell of elements(row.body, 'c')) {
      const ref = attr(cell.attrs, 'r');
      const col = ref ? columnOf(ref) : nextCol;
      nextCol = col + 1;
      if (col < 0) continue;

      const type = attr(cell.attrs, 't') ?? 'n';
      const [v] = elements(cell.body, 'v');
      const raw = v ? xmlText(v.body) : '';
      let value: Cell = '';
      if (type === 'inlineStr') value = stringItem(cell.body);
      else if (type === 's') value = strings[Number(raw)] ?? '';
      else if (type === 'str' || type === 'd') value = raw;
      else if (type === 'n' && raw !== '') {
        const number = Number(raw);
        if (!Number.isFinite(number)) continue;
        const isDate = isDateStyle[Number(attr(cell.attrs, 's') ?? 0)] ?? false;
        value = isDate ? (serialToIsoDate(number, date1904) ?? number) : number;
      }
      setCell(rows, rowAt, col, typeof value === 'string' ? value.trim() : value);
    }
  }
  return denseRows(rows);
}

/** Every visible worksheet of an .xlsx / .xltx / .xlsm workbook, in the workbook's order */
export async function readXlsx(bytes: Uint8Array): Promise<Sheet[]> {
  const entries = zipEntries(bytes);
  const budget = { left: MAX_UNPACKED_BYTES };
  const file = async (name: string) => {
    const entry = entries.get(name);
    return entry ? unzipText(bytes, entry, budget) : undefined;
  };

  const workbook = await file('xl/workbook.xml');
  if (workbook === undefined) {
    throw new SpreadsheetError("This file isn't an Excel workbook.");
  }
  const targets = new Map<string, string>();
  for (const { attrs } of elements(
    (await file('xl/_rels/workbook.xml.rels')) ?? '',
    'Relationship',
  )) {
    const target = attr(attrs, 'Target');
    const relId = attr(attrs, 'Id');
    if (!target || !relId) continue;
    targets.set(relId, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }

  const [properties] = elements(workbook, 'workbookPr');
  const date1904 = /^(1|true)$/.test(attr(properties?.attrs ?? '', 'date1904') ?? '');
  const strings = [...elements((await file('xl/sharedStrings.xml')) ?? '', 'si')].map((si) =>
    stringItem(si.body),
  );
  const isDateStyle = dateStyles(await file('xl/styles.xml'));

  const sheets: Sheet[] = [];
  let position = 0;
  for (const { attrs } of elements(workbook, 'sheet')) {
    position++;
    if ((attr(attrs, 'state') ?? 'visible') !== 'visible') continue;
    const path = targets.get(attr(attrs, 'id') ?? '') ?? `xl/worksheets/sheet${position}.xml`;
    const xml = await file(path);
    if (xml === undefined) continue;
    sheets.push({
      name: attr(attrs, 'name') ?? `Sheet ${position}`,
      rows: readSheet(xml, strings, isDateStyle, date1904),
    });
  }
  return sheets;
}
