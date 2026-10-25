/** A cell: text, a number, or a number shown as a date (`{ date: 'YYYY-MM-DD' }`) */
export type XlsxCell = string | number | { date: string };

/** Excel's day number for a date (days since 30 December 1899) */
const serial = (iso: string) => (Date.parse(iso) - Date.UTC(1899, 11, 30)) / 86_400_000;

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cell(value: XlsxCell): string {
  if (typeof value === 'number') return `<c><v>${value}</v></c>`;
  if (typeof value === 'object') return `<c s="1"><v>${serial(value.date)}</v></c>`;
  return `<c t="inlineStr"><is><t>${escape(value)}</t></is></c>`;
}

/** An .xlsx workbook with these sheets, in order (a zip of XML files, stored uncompressed) */
export function xlsx(sheets: Record<string, XlsxCell[][]>): Buffer {
  const names = Object.keys(sheets);
  const files: Record<string, string> = {
    'xl/workbook.xml': `<workbook xmlns:r="r"><sheets>${names
      .map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships>${names
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
    // Style 1 shows numbers as dates
    'xl/styles.xml':
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
      '<cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
  };
  names.forEach((name, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet><sheetData>${sheets[name]
      .map((row) => `<row>${row.map(cell).join('')}</row>`)
      .join('')}</sheetData></worksheet>`;
  });

  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const entry = Buffer.alloc(26);
    entry.writeUInt16LE(20, 0);
    entry.writeUInt32LE(data.length, 14);
    entry.writeUInt32LE(data.length, 18);
    entry.writeUInt16LE(Buffer.byteLength(name), 22);
    const local = Buffer.concat([
      Buffer.from('PK\x03\x04', 'latin1'),
      entry,
      Buffer.from(name),
      data,
    ]);
    const where = Buffer.alloc(14);
    where.writeUInt32LE(at, 10);
    directory.push(
      Buffer.concat([Buffer.from('PK\x01\x02\x14\x00', 'latin1'), entry, where, Buffer.from(name)]),
    );
    parts.push(local);
    at += local.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.write('PK\x05\x06', 'latin1');
  end.writeUInt16LE(directory.length, 8);
  end.writeUInt16LE(directory.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(at, 16);
  return Buffer.concat([...parts, central, end]);
}
