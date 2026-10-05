import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  detectDelimiter,
  generateImportId,
  guessColumnRoles,
  guessConventions,
  parseCsv,
  parseImportAmount,
  parseImportDate,
  readImportRows,
  type DateOrder,
  type DecimalSeparator,
} from './csv';

/** Quotes a field the way spreadsheets and banks do */
const quote = (f: string) => `"${f.replace(/"/g, '""')}"`;

// Fields with no leading/trailing spaces (the parser trims) and at least one visible character
const field = fc
  .string({ unit: fc.constantFrom('a', 'Z', '1', ' ', ',', ';', '"', '\n', '\r\n', '$', '-') })
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

describe('parseCsv (property-based)', () => {
  it('finds the delimiter (comma or semicolon) and round-trips quoted fields holding either', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(field, { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 20 }),
        fc.constantFrom(',', ';'),
        fc.constantFrom('\n', '\r\n'),
        (records, delimiter, eol) => {
          const text = records.map((r) => r.map(quote).join(delimiter)).join(eol);
          expect(detectDelimiter(text)).toBe(delimiter);
          const { headers, rows } = parseCsv(text);
          expect([headers, ...rows]).toEqual(records);
        },
      ),
    );
  });

  it('reads a semicolon file whose amounts hold commas', () => {
    expect(parseCsv('Fecha;Concepto;Importe\r\n05/03/2026;Supermercado;-1.234,56\r\n')).toEqual({
      headers: ['Fecha', 'Concepto', 'Importe'],
      rows: [['05/03/2026', 'Supermercado', '-1.234,56']],
    });
  });

  it('round-trips any quoted fields, including commas, quotes and line breaks', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(field, { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 20 }),
        fc.constantFrom('\n', '\r\n'),
        fc.boolean(),
        (records, eol, bom) => {
          const text = (bom ? '﻿' : '') + records.map((r) => r.map(quote).join(',')).join(eol);
          const { headers, rows } = parseCsv(text);
          expect([headers, ...rows]).toEqual(records);
        },
      ),
    );
  });

  it('skips blank lines and strips an Excel byte order mark from the first header', () => {
    expect(parseCsv('﻿Date,Amount\r\n\r\n2024-01-02,5\r\n')).toEqual({
      headers: ['Date', 'Amount'],
      rows: [['2024-01-02', '5']],
    });
  });
});

/** Digits grouped in threes: 1234567 -> "1,234,567" */
const grouped = (n: number, separator: string) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator);

interface AmountStyle {
  thousands: boolean;
  negative: 'minus' | 'parens' | 'trailing';
  symbol: string;
}

/** An amount the way a bank writes it under one decimal convention */
function writeAmount(cents: number, decimal: DecimalSeparator, style: AmountStyle): string {
  const abs = Math.abs(cents);
  const [thousandsSep, decimalSep] = decimal === 'comma' ? ['.', ','] : [',', '.'];
  const whole = Math.floor(abs / 100);
  const digits =
    (style.thousands ? grouped(whole, thousandsSep) : String(whole)) +
    decimalSep +
    String(abs % 100).padStart(2, '0');
  const body = style.symbol + digits;
  if (cents >= 0) return body;
  if (style.negative === 'parens') return `(${body})`;
  if (style.negative === 'trailing') return `${body}-`;
  return `-${body}`;
}

const decimalStyle = fc.constantFrom<DecimalSeparator>('comma', 'point');
const amountStyle: fc.Arbitrary<AmountStyle> = fc.record({
  thousands: fc.boolean(),
  negative: fc.constantFrom<AmountStyle['negative']>('minus', 'parens', 'trailing'),
  symbol: fc.constantFrom('', '$', '$ ', 'US$ ', 'U$S '),
});
const centsArb = fc.integer({ min: -99_999_999_999, max: 99_999_999_999 });

describe('parseImportAmount', () => {
  it.each([
    ['12.34', 1234],
    ['-12.34', -1234],
    ['$1,234.56', 123456],
    ['(12.00)', -1200],
    ['12.00-', -1200],
    ['1,234', 123400],
    ['.5', 50],
    ['', 0],
  ])('point decimals: %s', (raw, cents) => {
    expect(parseImportAmount(raw, 'point')).toBe(cents);
  });

  it.each([
    ['12,34', 1234],
    ['-1.234,56', -123456],
    ['US$ 1.234,56', 123456],
    ['(12,00)', -1200],
    ['12,00-', -1200],
    ['1.234', 123400],
    ['1.234.567,8', 123456780],
  ])('comma decimals: %s', (raw, cents) => {
    expect(parseImportAmount(raw, 'comma')).toBe(cents);
  });

  it('reads any amount written in either decimal style (property-based)', () => {
    fc.assert(
      fc.property(centsArb, decimalStyle, amountStyle, (cents, decimal, style) => {
        expect(parseImportAmount(writeAmount(cents, decimal, style), decimal)).toBe(cents);
      }),
    );
  });

  it('never reads a grouped amount under the other decimal style (property-based)', () => {
    fc.assert(
      fc.property(
        centsArb.filter((c) => Math.abs(c) >= 100_000),
        decimalStyle,
        amountStyle,
        (cents, decimal, style) => {
          const other = decimal === 'comma' ? 'point' : 'comma';
          const written = writeAmount(cents, decimal, { ...style, thousands: true });
          expect(parseImportAmount(written, other)).toBeNull();
        },
      ),
    );
  });

  it.each(['n/a', 'abc', '12.34.56', '1,2,3.4.5', '12.345', '--5'])(
    'says %s is unreadable instead of calling it zero',
    (raw) => {
      expect(parseImportAmount(raw, 'point')).toBeNull();
    },
  );
});

const pad = (n: number) => String(n).padStart(2, '0');
type Day = readonly [year: number, month: number, day: number];
// Any real calendar day
const dayArb: fc.Arbitrary<Day> = fc
  .date({
    min: new Date(Date.UTC(2000, 0, 1)),
    max: new Date(Date.UTC(2099, 11, 31)),
    noInvalidDate: true,
  })
  .map((d) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()] as const);
const dateOrder = fc.constantFrom<DateOrder>('day-first', 'month-first');
const dateSeparator = fc.constantFrom('/', '-', '.');

function writeDate([y, m, d]: Day, order: DateOrder, separator: string, padded: boolean): string {
  const p = (n: number) => (padded ? pad(n) : String(n));
  const [a, b] = order === 'day-first' ? [d, m] : [m, d];
  return `${p(a)}${separator}${p(b)}${separator}${y}`;
}

describe('parseImportDate', () => {
  it('reads 05/03/2026 as 5 March day first and as 3 May month first', () => {
    expect(parseImportDate('05/03/2026', 'day-first')).toBe('2026-03-05');
    expect(parseImportDate('05/03/2026', 'month-first')).toBe('2026-05-03');
  });

  it('keeps the calendar day for written-out dates in any time zone', () => {
    expect(parseImportDate('Jan 5, 2024', 'month-first')).toBe('2024-01-05');
    expect(parseImportDate('03/07/2024', 'month-first')).toBe('2024-03-07');
  });

  it('reads two-digit years and a time after the date', () => {
    expect(parseImportDate('5/3/26', 'day-first')).toBe('2026-03-05');
    expect(parseImportDate('05/03/2026 14:30', 'day-first')).toBe('2026-03-05');
  });

  it('reads any day in either order, and ISO dates in both (property-based)', () => {
    fc.assert(
      fc.property(dayArb, dateOrder, dateSeparator, fc.boolean(), (day, order, sep, padded) => {
        const iso = `${day[0]}-${pad(day[1])}-${pad(day[2])}`;
        expect(parseImportDate(writeDate(day, order, sep, padded), order)).toBe(iso);
        expect(parseImportDate(iso, order)).toBe(iso);
      }),
    );
  });

  it('never turns a day above 12 into a month (property-based)', () => {
    fc.assert(
      fc.property(
        dayArb.filter(([, , d]) => d > 12),
        dateOrder,
        dateSeparator,
        (day, order, sep) => {
          const other = order === 'day-first' ? 'month-first' : 'day-first';
          expect(parseImportDate(writeDate(day, order, sep, true), other)).toBeNull();
        },
      ),
    );
  });

  it.each(['', '31/02/2026', '2026-02-30', '00/00/0000', 'yesterday', '12345'])(
    'says "%s" is not a date',
    (raw) => {
      expect(parseImportDate(raw, 'day-first')).toBeNull();
    },
  );
});

describe('guessConventions', () => {
  it('guesses day first and comma decimals from a Uruguayan file', () => {
    const { rows } = parseCsv(
      'Fecha;Concepto;Débito;Crédito\n05/03/2026;Super;1.234,56;\n25/03/2026;Sueldo;;80.000,00\n',
    );
    expect(guessConventions(rows)).toEqual({ dateOrder: 'day-first', decimal: 'comma' });
  });

  it('falls back to month first and point decimals when the file gives no clue', () => {
    expect(guessConventions([['05/03/2026', 'Cafe', '1,234']])).toEqual({
      dateOrder: 'month-first',
      decimal: 'point',
    });
  });

  it('finds the date order from any file with a day above 12 (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(dayArb, { maxLength: 20 }),
        dayArb.filter(([, , d]) => d > 12),
        dateOrder,
        dateSeparator,
        (days, telling, order, sep) => {
          const rows = [...days, telling].map((day) => [writeDate(day, order, sep, true), 'x']);
          expect(guessConventions(rows).dateOrder).toBe(order);
        },
      ),
    );
  });

  it('finds the decimal style from amounts with cents (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(centsArb, amountStyle), { minLength: 1, maxLength: 20 }),
        decimalStyle,
        (amounts, decimal) => {
          const rows = amounts.map(([cents, style]) => [
            '2026-03-05',
            writeAmount(cents, decimal, style),
          ]);
          expect(guessConventions(rows).decimal).toBe(decimal);
        },
      ),
    );
  });
});

describe('readImportRows', () => {
  const uruguayan = { dateOrder: 'day-first', decimal: 'comma' } as const;
  const american = { dateOrder: 'month-first', decimal: 'point' } as const;

  it('reads a Uruguayan bank file under its conventions', () => {
    const { headers, rows } = parseCsv(
      'Fecha;Descripción;Débito;Crédito\r\n' +
        '05/03/2026;"Supermercado; sucursal 3";1.234,56;\r\n' +
        '25/03/2026;Sueldo;;80.000,00\r\n',
    );
    expect(guessColumnRoles(headers)).toEqual(['date', 'payee', 'outflow', 'inflow']);
    expect(readImportRows(rows, guessColumnRoles(headers), uruguayan)).toEqual({
      rows: [
        {
          date: '2026-03-05',
          amount: -123456,
          payeeName: 'Supermercado; sucursal 3',
          notes: null,
          importedId: '2026-03-05|-123456|supermercado; sucursal 3',
        },
        {
          date: '2026-03-25',
          amount: 8000000,
          payeeName: 'Sueldo',
          notes: null,
          importedId: '2026-03-25|8000000|sueldo',
        },
      ],
      problems: [],
    });
  });

  it('reports rows it cannot read under the chosen conventions instead of importing them', () => {
    const rows = [
      ['05/03/2026', 'Cafe', '-120,00'],
      ['25/03/2026', 'Super', '-1.234,56'],
      ['06/03/2026', 'Kiosco', 'pendiente'],
    ];
    const read = readImportRows(rows, ['date', 'payee', 'amount'], american);
    expect(read.rows).toEqual([]);
    expect(read.problems.map((p) => [p.row, p.message])).toEqual([
      [1, 'Can\'t read the amount "-120,00"'],
      [2, 'Can\'t read the date "25/03/2026"'],
      [3, 'Can\'t read the amount "pendiente"'],
    ]);

    const fixed = readImportRows(rows, ['date', 'payee', 'amount'], uruguayan);
    expect(fixed.rows.map((r) => [r.date, r.amount])).toEqual([
      ['2026-03-05', -12000],
      ['2026-03-25', -123456],
    ]);
    expect(fixed.problems.map((p) => p.row)).toEqual([3]);
  });

  it('skips empty rows and rows with no amount without reporting them', () => {
    const rows = [
      ['', '', ''],
      ['01/15/2025', 'Pending', ''],
      ['01/16/2025', 'Zero', '0.00'],
      ['01/17/2025', 'Cafe', '(4.50)'],
    ];
    const read = readImportRows(rows, ['date', 'payee', 'amount'], american);
    expect(read.rows.map((r) => [r.date, r.amount])).toEqual([['2025-01-17', -450]]);
    expect(read.problems).toEqual([]);
  });

  it('numbers identical rows so two same-day coffees are both imported', () => {
    const rows = [
      ['01/15/2025', 'Cafe', '-4.50'],
      ['01/15/2025', 'Cafe', '-4.50'],
    ];
    const read = readImportRows(rows, ['date', 'payee', 'amount'], american);
    expect(read.rows.map((r) => r.importedId)).toEqual([
      '2025-01-15|-450|cafe',
      '2025-01-15|-450|cafe|2',
    ]);
  });
});

describe('generateImportId', () => {
  it('tells identical rows in one file apart, and keeps the first one compatible', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (n) => {
        const ids = Array.from({ length: n }, (_, i) =>
          generateImportId('2024-01-01', -500, 'Cafe', i + 1),
        );
        expect(new Set(ids).size).toBe(n);
        expect(ids[0]).toBe(generateImportId('2024-01-01', -500, 'Cafe'));
      }),
    );
  });
});
