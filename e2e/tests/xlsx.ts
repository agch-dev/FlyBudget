/** An .xlsx workbook with one sheet (a zip of XML files, stored uncompressed) */
export function xlsx(rows: (string | number)[][]): Buffer {
  const cell = (value: string | number) =>
    typeof value === 'number'
      ? `<c><v>${value}</v></c>`
      : `<c t="inlineStr"><is><t>${value}</t></is></c>`;
  const files: Record<string, string> = {
    'xl/workbook.xml':
      '<workbook xmlns:r="r"><sheets><sheet name="Estado de Cuenta" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${rows
      .map((row) => `<row>${row.map(cell).join('')}</row>`)
      .join('')}</sheetData></worksheet>`,
  };
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
