import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { csvCell, rowsInCurrency } from './exportCsv';

// Reads back one cell as a spreadsheet would: strips the quotes and unescapes `""`
const unquote = (cell: string) =>
  cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;

const text = fc.string({
  unit: fc.constantFrom('=', '+', '-', '@', '\t', '\r', '\n', '"', ',', 'a', ' '),
});

describe('csvCell (property-based)', () => {
  it('never lets text start like a formula', () => {
    fc.assert(
      fc.property(text, (s) => {
        expect(unquote(csvCell(s))).not.toMatch(/^[=+\-@\t\r]/);
      }),
    );
  });

  it('keeps the text, adding only the leading quote mark', () => {
    fc.assert(
      fc.property(text, (s) => {
        const back = unquote(csvCell(s));
        expect(back === s || back === `'${s}`).toBe(true);
      }),
    );
  });

  it('quotes any cell with a comma, quote or line break, so it stays one cell', () => {
    fc.assert(
      fc.property(text, (s) => {
        const cell = csvCell(s);
        if (/[",\n\r]/.test(s)) expect(cell).toMatch(/^".*"$/s);
        else expect(cell).not.toMatch(/[",\n\r]/);
      }),
    );
  });

  it('leaves numbers alone, including negative amounts', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(csvCell(n)).toBe(String(n));
      }),
    );
  });
});

describe('rowsInCurrency', () => {
  it('says on every row which currency its amounts are in, by its sign', () => {
    const rows = [
      { month: '2026-03', net_cents: 5_000 },
      { month: '2026-04', net_cents: -120 },
    ];
    expect(rowsInCurrency(rows, 'USD')).toEqual([
      { month: '2026-03', net_cents: 5_000, currency: 'US$' },
      { month: '2026-04', net_cents: -120, currency: 'US$' },
    ]);
    expect(rowsInCurrency(rows, 'UYU')[0]).toEqual({
      month: '2026-03',
      net_cents: 5_000,
      currency: '$',
    });
  });

  it('keeps the amounts as plain numbers and the currency as the last column', () => {
    const [row] = rowsInCurrency([{ name: 'Rent', amount_cents: 1 }], 'USD');
    expect(Object.keys(row)).toEqual(['name', 'amount_cents', 'currency']);
    expect(csvCell(row.currency)).toBe('US$');
  });
});
