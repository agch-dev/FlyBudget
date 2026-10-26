import type { XlsxCell } from './xlsx';

// An Excel 97-2003 workbook: BIFF8 records in an OLE compound file ([MS-XLS], [MS-CFB])

/** Excel's day number for a date (days since 30 December 1899) */
const serial = (iso: string) => (Date.parse(iso) - Date.UTC(1899, 11, 30)) / 86_400_000;

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const f64 = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(n);
  return b;
};
const record = (type: number, ...data: Buffer[]) => {
  const body = Buffer.concat(data);
  return Buffer.concat([u16(type), u16(body.length), body]);
};
/** A string as BIFF8 writes it, two bytes a character */
const text = (value: string, lengthBytes: 1 | 2 = 2) =>
  Buffer.concat([
    lengthBytes === 1 ? Buffer.from([value.length]) : u16(value.length),
    Buffer.from([1]),
    Buffer.from(value, 'utf16le'),
  ]);
const cellAt = (row: number, col: number, style: number) =>
  Buffer.concat([u16(row), u16(col), u16(style)]);
const bof = (kind: number) => record(0x0809, u16(0x0600), u16(kind), Buffer.alloc(12));
const EOF = record(0x000a);

function workbookStream(sheets: Record<string, XlsxCell[][]>): Buffer {
  const strings: string[] = [];
  const parts = Object.values(sheets).map((rows) =>
    Buffer.concat([
      bof(0x0010),
      ...rows.flatMap((row, r) =>
        row.map((value, c) => {
          if (value === '') return Buffer.alloc(0);
          // Style 1 shows numbers as dates
          if (typeof value === 'object')
            return record(0x0203, cellAt(r, c, 1), f64(serial(value.date)));
          if (typeof value === 'number') return record(0x0203, cellAt(r, c, 0), f64(value));
          return record(0x00fd, cellAt(r, c, 0), u32(strings.push(value) - 1));
        }),
      ),
      EOF,
    ]),
  );
  const globals = (offsets: number[]) =>
    Buffer.concat([
      bof(0x0005),
      record(0x041e, u16(164), text('dd/mm/yyyy')),
      record(0x00e0, u16(0), u16(0), Buffer.alloc(16)),
      record(0x00e0, u16(0), u16(164), Buffer.alloc(16)),
      ...Object.keys(sheets).map((name, i) =>
        record(0x0085, u32(offsets[i] ?? 0), Buffer.from([0, 0]), text(name, 1)),
      ),
      record(0x00fc, u32(strings.length), u32(strings.length), ...strings.map((s) => text(s))),
      EOF,
    ]);
  let at = globals([]).length;
  const offsets = parts.map((part) => (at += part.length) - part.length);
  return Buffer.concat([globals(offsets), ...parts]);
}

/** An .xls workbook with these sheets, in order */
export function xls(sheets: Record<string, XlsxCell[][]>): Buffer {
  const stream = workbookStream(sheets);
  // Streams under 4096 bytes would go in the small sectors: padded, it takes big ones
  const data = Buffer.alloc(Math.ceil(Math.max(stream.length, 4096) / 512) * 512);
  stream.copy(data);
  const count = data.length / 512;
  const END = 0xfffffffe;
  // Sector 0 is the allocation table, 1 the directory, then the workbook's sectors
  const fat = Buffer.alloc(512, 0xff);
  [0xfffffffd, END, ...Array.from({ length: count }, (_, i) => (i === count - 1 ? END : i + 3))]
    .slice(0, 128)
    .forEach((next, i) => fat.writeUInt32LE(next, i * 4));
  const directory = Buffer.alloc(512);
  const entry = (at: number, name: string, type: number, start: number, size: number) => {
    directory.write(name, at, 'utf16le');
    directory.writeUInt16LE(name.length * 2 + 2, at + 64);
    directory[at + 66] = type;
    directory.writeUInt32LE(start, at + 116);
    directory.writeUInt32LE(size, at + 120);
  };
  entry(0, 'Root Entry', 5, END, 0);
  entry(128, 'Workbook', 2, 2, data.length);
  const header = Buffer.alloc(512, 0xff);
  header.fill(0, 8, 76);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header);
  header.writeUInt16LE(9, 30);
  header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44);
  header.writeUInt32LE(1, 48);
  header.writeUInt32LE(4096, 56);
  header.writeUInt32LE(END, 60);
  header.writeUInt32LE(END, 68);
  header.writeUInt32LE(0, 76);
  return Buffer.concat([header, fat, directory, data]);
}
