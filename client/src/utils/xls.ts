import {
  SpreadsheetError,
  denseRows,
  isDateFormat,
  serialToIsoDate,
  setCell,
  type Cell,
  type Sheet,
  type SparseRows,
  SPREADSHEET_MESSAGES,
} from './spreadsheetCells';

// Reads Excel 97-2003 workbooks (.xls): an OLE compound file holding a "Workbook" stream
// of BIFF8 records ([MS-CFB], [MS-XLS]). Only what an import needs: each sheet's cell
// values. Files come from banks, so they are untrusted input: every offset is checked,
// every chain of sectors is bounded, and each part of the stream is read once.

const corrupt = () => new SpreadsheetError(SPREADSHEET_MESSAGES.damaged);

/** The most sheets a workbook may have, hidden ones and charts included */
const MAX_SHEETS = 256;

/** End of a sector chain; anything from here up is not a sector number */
const LAST_SECTOR = 0xfffffffa;

interface DirectoryEntry {
  start: number;
  size: number;
}

/** The "Workbook" stream of an OLE compound file (or "Book", from Excel 5 and 95) */
function workbookStream(bytes: Uint8Array): { stream: Uint8Array; biff5: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 512) throw corrupt();
  const sectorShift = view.getUint16(30, true);
  if ((sectorShift !== 9 && sectorShift !== 12) || view.getUint16(32, true) !== 6) throw corrupt();
  const sectorSize = 1 << sectorShift;
  // The header takes the place of sector -1
  const sectorCount = Math.floor(bytes.length / sectorSize) - 1;
  const sectorAt = (sector: number) => {
    if (sector >= sectorCount) throw corrupt();
    return (sector + 1) * sectorSize;
  };

  // The allocation table says which sector follows which. Its own sectors are listed in
  // the header, then in a chain of further lists. It needs no more entries than sectors.
  const perSector = sectorSize / 4;
  const tableSectors: number[] = [];
  for (let i = 0; i < 109; i++) tableSectors.push(view.getUint32(76 + i * 4, true));
  let listSector = view.getUint32(68, true);
  for (
    let lists = 0;
    listSector < LAST_SECTOR && tableSectors.length * perSector < sectorCount;
    lists++
  ) {
    if (lists >= sectorCount) throw corrupt();
    const at = sectorAt(listSector);
    for (let j = 0; j < sectorSize - 4; j += 4) tableSectors.push(view.getUint32(at + j, true));
    listSector = view.getUint32(at + sectorSize - 4, true);
  }
  const next: number[] = [];
  for (const sector of tableSectors) {
    if (next.length >= sectorCount) break;
    if (sector >= LAST_SECTOR) continue;
    const at = sectorAt(sector);
    for (let j = 0; j < sectorSize; j += 4) next.push(view.getUint32(at + j, true));
  }

  const chain = (first: number, table: number[]): number[] => {
    const sectors: number[] = [];
    for (let sector = first; sector < LAST_SECTOR; sector = table[sector] ?? LAST_SECTOR) {
      // A chain that loops would never end
      if (sectors.length >= table.length) throw corrupt();
      sectors.push(sector);
    }
    return sectors;
  };
  const readChain = (first: number, size?: number): Uint8Array => {
    const sectors = chain(first, next);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((sector, i) => {
      const at = sectorAt(sector);
      out.set(bytes.subarray(at, at + sectorSize), i * sectorSize);
    });
    return size === undefined ? out : out.subarray(0, Math.min(size, out.length));
  };

  // The directory: 128-byte entries naming each stream, where it starts and its size
  const directory = readChain(view.getUint32(48, true));
  const entries = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const names = new TextDecoder('utf-16le');
  let root: DirectoryEntry | undefined;
  const streams = new Map<string, DirectoryEntry>();
  for (let at = 0; at + 128 <= directory.length; at += 128) {
    const nameBytes = Math.min(Math.max(entries.getUint16(at + 64, true) - 2, 0), 62);
    const name = names.decode(directory.subarray(at, at + nameBytes));
    const entry = {
      start: entries.getUint32(at + 116, true),
      size: entries.getUint32(at + 120, true),
    };
    const type = entries.getUint8(at + 66);
    if (type === 5) root ??= entry;
    else if (type === 2 && !streams.has(name)) streams.set(name, entry);
  }
  // An .xlsx with a password is an OLE file holding the encrypted workbook
  if (streams.has('EncryptedPackage')) {
    throw new SpreadsheetError(SPREADSHEET_MESSAGES.password);
  }
  const book = streams.get('Workbook') ?? streams.get('Book');
  if (!book) throw new SpreadsheetError(SPREADSHEET_MESSAGES.notWorkbook);
  const biff5 = !streams.has('Workbook');

  if (book.size >= view.getUint32(56, true)) {
    return { stream: readChain(book.start, book.size), biff5 };
  }

  // Small streams live in 64-byte sectors inside the root entry's own stream
  if (!root) throw corrupt();
  const miniStream = readChain(root.start, root.size);
  const miniTableBytes = readChain(view.getUint32(60, true));
  const miniTable = new DataView(
    miniTableBytes.buffer,
    miniTableBytes.byteOffset,
    miniTableBytes.byteLength,
  );
  const miniNext: number[] = [];
  for (let j = 0; j + 4 <= miniTableBytes.length; j += 4) {
    miniNext.push(miniTable.getUint32(j, true));
  }
  const sectors = chain(book.start, miniNext);
  const out = new Uint8Array(sectors.length * 64);
  sectors.forEach((sector, i) => {
    if ((sector + 1) * 64 > miniStream.length) throw corrupt();
    out.set(miniStream.subarray(sector * 64, sector * 64 + 64), i * 64);
  });
  return { stream: out.subarray(0, Math.min(book.size, out.length)), biff5 };
}

// Record types ([MS-XLS] 2.3)
const BOF = 0x0809;
const EOF = 0x000a;
const CONTINUE = 0x003c;
const FILEPASS = 0x002f;
const DATEMODE = 0x0022;
const FORMAT = 0x041e;
const XF = 0x00e0;
const BOUNDSHEET = 0x0085;
const SST = 0x00fc;
const LABELSST = 0x00fd;
const LABEL = 0x0204;
const RSTRING = 0x00d6;
const NUMBER = 0x0203;
const RK = 0x027e;
const MULRK = 0x00bd;
const FORMULA = 0x0006;
const STRING = 0x0207;
// Records that may come between a FORMULA and the STRING with its text
const SHRFMLA = 0x04bc;
const ARRAY = 0x0221;
const TABLE = 0x0236;

interface BiffRecord {
  type: number;
  /** The record's data, then that of each CONTINUE record after it */
  chunks: Uint8Array[];
}

/** The records of a stream from `at` up to `end`, each with its CONTINUE records */
function* records(stream: Uint8Array, at: number, end = stream.length): Generator<BiffRecord> {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  while (at + 4 <= end) {
    const type = view.getUint16(at, true);
    const length = view.getUint16(at + 2, true);
    if (at + 4 + length > end) return;
    const chunks = [stream.subarray(at + 4, at + 4 + length)];
    at += 4 + length;
    while (at + 4 <= end && view.getUint16(at, true) === CONTINUE) {
      const more = view.getUint16(at + 2, true);
      if (at + 4 + more > end) break;
      chunks.push(stream.subarray(at + 4, at + 4 + more));
      at += 4 + more;
    }
    yield { type, chunks };
  }
}

/**
 * Reads strings from a record and the CONTINUE records after it. Text that crosses into
 * the next record starts again there with a byte saying whether it is one or two bytes a
 * character, which may differ from how it began.
 */
class StringReader {
  private chunk = 0;

  constructor(
    private chunks: Uint8Array[],
    private at = 0,
  ) {}

  private current(): Uint8Array {
    while (this.at >= this.chunks[this.chunk].length) {
      if (this.chunk + 1 >= this.chunks.length) throw corrupt();
      this.chunk++;
      this.at = 0;
    }
    return this.chunks[this.chunk];
  }

  get done(): boolean {
    return this.chunk >= this.chunks.length - 1 && this.at >= this.chunks[this.chunk].length;
  }

  private uint(bytes: 1 | 2 | 4): number {
    let value = 0;
    for (let i = 0; i < bytes; i++) value += this.current()[this.at++] * 2 ** (8 * i);
    return value;
  }

  private skip(bytes: number) {
    while (bytes > 0) {
      const step = Math.min(bytes, this.current().length - this.at);
      this.at += step;
      bytes -= step;
    }
  }

  /** A string with a length of `lengthBytes` bytes in front, without formatting and phonetics */
  read(lengthBytes: 1 | 2): string {
    let left = this.uint(lengthBytes);
    const flags = this.uint(1);
    let wide = (flags & 0x01) !== 0;
    const formattingRuns = flags & 0x08 ? this.uint(2) : 0;
    const phoneticBytes = flags & 0x04 ? this.uint(4) : 0;

    const units: number[] = [];
    while (left > 0) {
      let chunk = this.chunks[this.chunk];
      if (this.at >= chunk.length) {
        if (this.chunk + 1 >= this.chunks.length) throw corrupt();
        chunk = this.chunks[++this.chunk];
        if (chunk.length === 0) throw corrupt();
        wide = (chunk[0] & 0x01) !== 0;
        this.at = 1;
      }
      const take = Math.min(left, Math.floor((chunk.length - this.at) / (wide ? 2 : 1)));
      for (let i = 0; i < take; i++) {
        units.push(wide ? chunk[this.at] | (chunk[this.at + 1] << 8) : chunk[this.at]);
        this.at += wide ? 2 : 1;
      }
      left -= take;
      // Half a character can't be left over: the rest is in the next record
      if (left > 0) this.at = chunk.length;
    }
    this.skip(formattingRuns * 4 + phoneticBytes);
    let text = '';
    for (let i = 0; i < units.length; i += 8192) {
      text += String.fromCharCode(...units.slice(i, i + 8192));
    }
    return text;
  }
}

/** The number in an RK value: 30 bits of integer or of a float's top half, maybe ÷ 100 */
function rkNumber(view: DataView, at: number): number {
  const rk = view.getInt32(at, true);
  let value: number;
  if (rk & 0x02) {
    value = rk >> 2;
  } else {
    const float = new DataView(new ArrayBuffer(8));
    float.setUint32(4, rk & 0xfffffffc, true);
    value = float.getFloat64(0, true);
  }
  return rk & 0x01 ? value / 100 : value;
}

const dataView = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** Every visible worksheet of an .xls workbook, in the workbook's order */
export function readXls(bytes: Uint8Array): Sheet[] {
  const { stream, biff5 } = workbookStream(bytes);
  const first = records(stream, 0).next().value;
  if (!first || first.type !== BOF || first.chunks[0].length < 4) throw corrupt();
  // 0x0600 is BIFF8 (Excel 97 and later); older ones store text in the PC's code page
  if (biff5 || dataView(first.chunks[0]).getUint16(0, true) !== 0x0600) {
    throw new SpreadsheetError(SPREADSHEET_MESSAGES.tooOld);
  }

  // The workbook's own records: sheet names and places, the text of every cell, formats
  let date1904 = false;
  const formatCodes = new Map<number, string>();
  const styleFormats: number[] = [];
  const bound: { name: string; at: number }[] = [];
  // Where every sheet starts, hidden ones and charts too: where the one before it ends
  const starts = new Set<number>();
  let sheetCount = 0;
  let strings: string[] = [];
  for (const { type, chunks } of records(stream, 0)) {
    const data = chunks[0];
    const view = dataView(data);
    if (type === EOF) break;
    if (type === FILEPASS) throw new SpreadsheetError(SPREADSHEET_MESSAGES.password);
    if (type === DATEMODE && data.length >= 2) date1904 = view.getUint16(0, true) === 1;
    else if (type === FORMAT && data.length >= 5) {
      formatCodes.set(view.getUint16(0, true), new StringReader([data], 2).read(2));
    } else if (type === XF && data.length >= 4) styleFormats.push(view.getUint16(2, true));
    else if (type === SST && data.length >= 8) {
      const reader = new StringReader(chunks, 8);
      const count = view.getUint32(4, true);
      strings = [];
      for (let i = 0; i < count && !reader.done; i++) strings.push(reader.read(2));
    } else if (type === BOUNDSHEET && data.length >= 8) {
      if (++sheetCount > MAX_SHEETS) throw new SpreadsheetError(SPREADSHEET_MESSAGES.tooLarge);
      const at = view.getUint32(0, true);
      starts.add(at);
      // Visible worksheets only: not hidden ones, charts or macro sheets
      if ((data[4] & 0x03) === 0 && data[5] === 0) {
        bound.push({ name: new StringReader([data], 6).read(1), at });
      }
    }
  }

  const isDateStyle = styleFormats.map((id) => isDateFormat(id, formatCodes.get(id)));
  const numberCell = (value: number, style: number): Cell =>
    isDateStyle[style] ? (serialToIsoDate(value, date1904) ?? value) : value;
  const ends = [...starts, stream.length].sort((a, b) => a - b);

  const readSheet = (at: number): Cell[][] => {
    const rows: SparseRows = new Map();
    // A sheet never runs into the next one, so each part of the stream is read once
    const end = ends.find((start) => start > at) ?? stream.length;
    const sheetRecords = records(stream, at, end);
    const head = sheetRecords.next().value;
    if (!head || head.type !== BOF) throw corrupt();
    // The cell whose formula's text comes in the STRING record after it
    let formulaText: { row: number; col: number } | null = null;
    let depth = 1;
    for (const { type, chunks } of sheetRecords) {
      const data = chunks[0];
      const view = dataView(data);
      // A sheet can hold further BOF…EOF blocks (embedded charts): it ends with its own EOF
      if (type === BOF) depth++;
      else if (type === EOF && --depth === 0) break;
      if (depth !== 1) continue;
      if (type === STRING) {
        if (formulaText && data.length >= 3) {
          const text = new StringReader(chunks).read(2).trim();
          setCell(rows, formulaText.row, formulaText.col, text);
        }
        formulaText = null;
        continue;
      }
      if (type === SHRFMLA || type === ARRAY || type === TABLE) continue;
      formulaText = null;
      if (data.length < 6) continue;

      const row = view.getUint16(0, true);
      const col = view.getUint16(2, true);
      const style = view.getUint16(4, true);
      if (type === LABELSST && data.length >= 10) {
        setCell(rows, row, col, (strings[view.getUint32(6, true)] ?? '').trim());
      } else if ((type === LABEL || type === RSTRING) && data.length >= 9) {
        setCell(rows, row, col, new StringReader(chunks, 6).read(2).trim());
      } else if (type === NUMBER && data.length >= 14) {
        setCell(rows, row, col, numberCell(view.getFloat64(6, true), style));
      } else if (type === RK && data.length >= 10) {
        setCell(rows, row, col, numberCell(rkNumber(view, 6), style));
      } else if (type === MULRK) {
        // row, first column, then a style and a number per column, then the last column
        for (let i = 4, c = col; i + 6 <= data.length - 2; i += 6, c++) {
          setCell(rows, row, c, numberCell(rkNumber(view, i + 2), view.getUint16(i, true)));
        }
      } else if (type === FORMULA && data.length >= 14) {
        // The saved result: a number, or a marker for text (in a STRING record after it),
        // true/false, an error or nothing, the last three read as empty
        if (view.getUint16(12, true) !== 0xffff) {
          setCell(rows, row, col, numberCell(view.getFloat64(6, true), style));
        } else if (data[6] === 0) {
          formulaText = { row, col };
        }
      }
    }
    return denseRows(rows);
  };

  const read = new Map<number, Cell[][]>();
  return bound.map(({ name, at }) => {
    let rows = read.get(at);
    if (!rows) read.set(at, (rows = readSheet(at)));
    return { name, rows };
  });
}
