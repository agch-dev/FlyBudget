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
import { t } from '../i18n';

// Reads Excel 97-2003 workbooks (.xls): an OLE compound file holding a "Workbook" stream
// of BIFF8 records ([MS-CFB], [MS-XLS]). Only what an import needs: each sheet's cell
// values. Files come from banks, so they are untrusted input: every offset is checked and
// every chain of sectors is bounded.

const corrupt = () => new SpreadsheetError(t('import:spreadsheet.damaged'));

/** End of a sector chain; anything from here up is not a sector number */
const LAST_SECTOR = 0xfffffffa;

/** The "Workbook" stream of an OLE compound file */
function workbookStream(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 512) throw corrupt();
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  if ((sectorSize !== 512 && sectorSize !== 4096) || miniSectorSize !== 64) throw corrupt();
  const sectorCount = Math.floor(bytes.length / sectorSize);
  const sectorAt = (sector: number) => {
    const at = (sector + 1) * sectorSize;
    if (sector >= LAST_SECTOR || at + sectorSize > bytes.length) throw corrupt();
    return at;
  };

  // The allocation table says which sector follows which. Its own sectors are listed in
  // the header, then in a chain of further lists.
  const tableSectors: number[] = [];
  for (let i = 0; i < 109; i++) tableSectors.push(view.getUint32(76 + i * 4, true));
  let listSector = view.getUint32(68, true);
  for (let i = view.getUint32(72, true); i > 0 && listSector < LAST_SECTOR; i--) {
    const at = sectorAt(listSector);
    for (let j = 0; j < sectorSize - 4; j += 4) tableSectors.push(view.getUint32(at + j, true));
    listSector = view.getUint32(at + sectorSize - 4, true);
  }
  const next: number[] = [];
  for (const sector of tableSectors) {
    if (sector >= LAST_SECTOR) continue;
    const at = sectorAt(sector);
    for (let j = 0; j < sectorSize; j += 4) next.push(view.getUint32(at + j, true));
  }

  const chain = (first: number, table: number[], limit: number): number[] => {
    const sectors: number[] = [];
    for (let sector = first; sector < LAST_SECTOR; sector = table[sector] ?? LAST_SECTOR) {
      // A table that loops would never end
      if (sectors.length >= limit) throw corrupt();
      sectors.push(sector);
    }
    return sectors;
  };
  const readChain = (first: number, size?: number): Uint8Array => {
    const sectors = chain(first, next, sectorCount);
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
  let root: { start: number; size: number } | undefined;
  let book: { start: number; size: number } | undefined;
  for (let at = 0; at + 128 <= directory.length; at += 128) {
    const nameBytes = Math.min(Math.max(entries.getUint16(at + 64, true) - 2, 0), 62);
    const name = names.decode(directory.subarray(at, at + nameBytes));
    const type = entries.getUint8(at + 66);
    const entry = {
      start: entries.getUint32(at + 116, true),
      size: entries.getUint32(at + 120, true),
    };
    if (type === 5) root = entry;
    // Only streams of the top level are ever named Workbook
    else if (type === 2 && (name === 'Workbook' || (name === 'Book' && !book))) book = entry;
  }
  if (!book) throw new SpreadsheetError(t('import:spreadsheet.notWorkbook'));

  if (book.size >= view.getUint32(56, true)) return readChain(book.start, book.size);

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
  for (let j = 0; j + 4 <= miniTableBytes.length; j += 4)
    miniNext.push(miniTable.getUint32(j, true));
  const sectors = chain(book.start, miniNext, miniNext.length);
  const out = new Uint8Array(sectors.length * 64);
  sectors.forEach((sector, i) => {
    if ((sector + 1) * 64 > miniStream.length) throw corrupt();
    out.set(miniStream.subarray(sector * 64, sector * 64 + 64), i * 64);
  });
  return out.subarray(0, Math.min(book.size, out.length));
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

interface BiffRecord {
  type: number;
  data: Uint8Array;
}

/** The records of a stream, from the one at `at` to the last whole one */
function* records(stream: Uint8Array, at: number): Generator<BiffRecord> {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  while (at + 4 <= stream.length) {
    const type = view.getUint16(at, true);
    const length = view.getUint16(at + 2, true);
    if (at + 4 + length > stream.length) return;
    yield { type, data: stream.subarray(at + 4, at + 4 + length) };
    at += 4 + length;
  }
}

/**
 * Reads strings from a record and the CONTINUE records after it. Text that crosses into
 * the next record starts again there with a byte saying whether it is one or two bytes a
 * character, which may differ from how it began.
 */
class StringReader {
  private chunk = 0;
  private at = 0;

  constructor(
    private chunks: Uint8Array[],
    at = 0,
  ) {
    this.at = at;
  }

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

  /** A string with a length of `lengthBytes` bytes in front, its formatting left out */
  read(lengthBytes: 1 | 2): string {
    let left = this.uint(lengthBytes);
    const flags = this.uint(1);
    let wide = (flags & 0x01) !== 0;
    const formattingRuns = flags & 0x08 ? this.uint(2) : 0;
    const phoneticBytes = flags & 0x04 ? this.uint(4) : 0;

    let text = '';
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
        text += String.fromCharCode(
          wide ? chunk[this.at] | (chunk[this.at + 1] << 8) : chunk[this.at],
        );
        this.at += wide ? 2 : 1;
      }
      left -= take;
      // Half a character can't be left over: the rest is in the next record
      if (left > 0) this.at = chunk.length;
    }
    this.skip(formattingRuns * 4 + phoneticBytes);
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

/** Every visible worksheet of an .xls workbook, in the workbook's order */
export function readXls(bytes: Uint8Array): Sheet[] {
  const stream = workbookStream(bytes);
  const first = records(stream, 0).next().value;
  if (!first || first.type !== BOF || first.data.length < 4) throw corrupt();
  // 0x0600 is BIFF8 (Excel 97 and later); older ones store text in the PC's code page
  if (new DataView(first.data.buffer, first.data.byteOffset).getUint16(0, true) !== 0x0600) {
    throw new SpreadsheetError(t('import:spreadsheet.tooOld'));
  }

  // The workbook's own records: sheet names and places, the text of every cell, formats
  let date1904 = false;
  const formatCodes = new Map<number, string>();
  const styleFormats: number[] = [];
  const bound: { name: string; at: number }[] = [];
  let strings: string[] = [];
  let stringChunks: Uint8Array[] | null = null;
  const finishStrings = () => {
    if (!stringChunks) return;
    const reader = new StringReader(stringChunks, 8);
    const count = new DataView(stringChunks[0].buffer, stringChunks[0].byteOffset).getUint32(
      4,
      true,
    );
    strings = [];
    for (let i = 0; i < count && !reader.done; i++) strings.push(reader.read(2));
    stringChunks = null;
  };

  for (const { type, data } of records(stream, 0)) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (type === CONTINUE && stringChunks) {
      (stringChunks as Uint8Array[]).push(data);
      continue;
    }
    finishStrings();
    if (type === EOF) break;
    if (type === FILEPASS) {
      throw new SpreadsheetError(t('import:spreadsheet.passwordProtected'));
    }
    if (type === DATEMODE && data.length >= 2) date1904 = view.getUint16(0, true) === 1;
    else if (type === FORMAT && data.length >= 5) {
      formatCodes.set(view.getUint16(0, true), new StringReader([data], 2).read(2));
    } else if (type === XF && data.length >= 4) styleFormats.push(view.getUint16(2, true));
    else if (type === SST && data.length >= 8) stringChunks = [data];
    else if (type === BOUNDSHEET && data.length >= 8) {
      // Visible worksheets only: not hidden ones, charts or macro sheets
      if ((data[4] & 0x03) === 0 && data[5] === 0) {
        bound.push({ name: new StringReader([data], 6).read(1), at: view.getUint32(0, true) });
      }
    }
  }

  const isDateStyle = styleFormats.map((id) => isDateFormat(id, formatCodes.get(id)));
  const numberCell = (value: number, style: number): Cell =>
    isDateStyle[style] ? (serialToIsoDate(value, date1904) ?? value) : value;

  return bound.map(({ name, at }) => {
    const rows: SparseRows = new Map();
    let formulaText: { row: number; col: number } | null = null;
    let depth = 0;
    for (const { type, data } of records(stream, at)) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      // A sheet can hold further BOF…EOF blocks (embedded charts): it ends with its own EOF
      if (type === BOF) depth++;
      else if (type === EOF && --depth <= 0) break;
      if (depth !== 1) continue;
      if (type === STRING && formulaText) {
        setCell(rows, formulaText.row, formulaText.col, new StringReader([data]).read(2).trim());
        formulaText = null;
        continue;
      }
      if (data.length < 6) continue;

      const row = view.getUint16(0, true);
      const col = view.getUint16(2, true);
      const style = view.getUint16(4, true);
      if (type === LABELSST && data.length >= 10) {
        setCell(rows, row, col, (strings[view.getUint32(6, true)] ?? '').trim());
      } else if ((type === LABEL || type === RSTRING) && data.length >= 9) {
        setCell(rows, row, col, new StringReader([data], 6).read(2).trim());
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
        // The result: a number, or a marker that its text follows in a STRING record
        if (view.getUint16(12, true) !== 0xffff) {
          setCell(rows, row, col, numberCell(view.getFloat64(6, true), style));
        } else if (data[6] === 0) {
          formulaText = { row, col };
        }
      }
    }
    return { name, rows: denseRows(rows) };
  });
}
