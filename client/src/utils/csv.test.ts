import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  decodeCsvBytes,
  detectDelimiter,
  generateImportId,
  guessChargesPositive,
  guessColumnRoles,
  guessConventions,
  guessRoles,
  parseCsv,
  parseImportAmount,
  parseImportCurrency,
  parseImportDate,
  readCsvFile,
  readImportRows,
  type ColumnRole,
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

describe('decodeCsvBytes', () => {
  it('reads UTF-8 and falls back to Windows-1252 for older bank files', () => {
    expect(decodeCsvBytes(new TextEncoder().encode('Número,Débito'))).toBe('Número,Débito');
    // "Número" as Latin-1 bytes: ú is the single byte 0xFA, which is not valid UTF-8
    expect(decodeCsvBytes(Uint8Array.from([0x4e, 0xfa, 0x6d, 0x65, 0x72, 0x6f]))).toBe('Número');
  });

  it('round-trips any text written as UTF-8 (property-based)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (text) => {
        fc.pre(text.charCodeAt(0) !== 0xfeff);
        expect(decodeCsvBytes(new TextEncoder().encode(text))).toBe(text);
      }),
    );
  });
});

describe('readCsvFile', () => {
  // A Santander Uruguay statement: account details first, and transaction rows with one
  // cell fewer than the header (no "Descripción"), unlike the balance rows
  const santander =
    'Cliente,Chaer B Agustina,\r\nCuenta,Ca Total Convenio,\r\nMoneda,UYU,\r\n\r\n' +
    'Movimientos,\r\nDesde:,01/10/2026,Hasta:,31/10/2026\r\n\r\n' +
    'Fecha,Referencia,Concepto,Descripción,Débito,Crédito,Saldos,\r\n' +
    ',,Saldo inicial,,,,15919.26\r\n\r\n' +
    '02/10/2026,764991,DEBITO OPERACION EN BANCA DIGITAL T--,-6425.00,,9494.26,\r\n\r\n' +
    '03/10/2026,764992,CREDITO POR SUELDO,,80000.00,89494.26,\r\n\r\n' +
    ',,Saldo final,,,,89494.26';

  it('finds the headers under the account details and lines them up with the data', () => {
    const { headers, rows, preamble } = readCsvFile(santander);
    expect(headers).toEqual(['Fecha', 'Referencia', 'Concepto', 'Débito', 'Crédito', 'Saldos', '']);
    expect(preamble).toHaveLength(5);
    expect(guessConventions([...preamble, ...rows])).toEqual({
      dateOrder: 'day-first',
      decimal: 'point',
    });
    const read = readImportRows(rows, guessColumnRoles(headers), {
      dateOrder: 'day-first',
      decimal: 'point',
    });
    expect(read.problems).toEqual([]);
    expect(read.rows.map((r) => [r.date, r.amount, r.payeeName, r.notes])).toEqual([
      ['2026-10-02', -642500, 'DEBITO OPERACION EN BANCA DIGITAL T--', '764991'],
      ['2026-10-03', 8000000, 'CREDITO POR SUELDO', '764992'],
    ]);
  });

  it('leaves the headers alone when rows only drop empty cells at the end', () => {
    const { headers } = readCsvFile(
      'Fecha,Concepto,Importe,Referencia\n05/03/2026,Kiosco,-50.00\n',
    );
    expect(headers).toEqual(['Fecha', 'Concepto', 'Importe', 'Referencia']);
  });

  it('reads a file with its headers on the first line like parseCsv (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(field, { minLength: 3, maxLength: 3 }), { minLength: 1, maxLength: 20 }),
        (records) => {
          const text = records.map((r) => r.map(quote).join(',')).join('\n');
          const { headers, rows, preamble } = readCsvFile(text);
          expect([...preamble, headers, ...rows]).toEqual(records);
        },
      ),
    );
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
          currency: null,
        },
        {
          date: '2026-03-25',
          amount: 8000000,
          payeeName: 'Sueldo',
          notes: null,
          importedId: '2026-03-25|8000000|sueldo',
          currency: null,
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

describe('card statements in pesos and dollars', () => {
  const uruguayan = { dateOrder: 'day-first', decimal: 'comma' } as const;

  // A Santander Uruguay card statement: the card's details and balances first, one column
  // per currency, and purchases written as positive amounts
  const santanderCard =
    'Cliente,Número de tarjeta de crédito,Alias,Fecha de corte,Límite de crédito (US$),Límite de crédito ($),\r\n' +
    '"Perez, Ana",XXXXX-0000,Visa,04/09/2026,"0,00","40.000,00",\r\n\r\n' +
    'Período,\r\nDesde:,01/09/2026,Hasta:,30/09/2026\r\n\r\n' +
    'Movimientos,\r\n' +
    'Fecha,Número de tarjeta,Número de autorización,Descripción,Importe original,Pesos,Dólares,\r\n' +
    '04/08/2026,XXXXX-0000,770,Streaming,"0,00","0,00","9,99",\r\n' +
    '19/08/2026,XXXXX-0000,770,Supermercado,"0,00","1.343,28","0,00",\r\n' +
    '20/08/2026,,770,Pago Automatico,"0,00","-13.821,26","0,00",\r\n' +
    '21/08/2026,XXXXX-0000,770,Reembolso,"0,00","0,00","-4,99",\r\n';

  it('finds the transactions under the card details, with a column for each currency', () => {
    const { headers, rows, preamble } = readCsvFile(santanderCard);
    expect(preamble).toHaveLength(5);
    expect(guessRoles(headers, rows)).toEqual([
      'date',
      'skip',
      'skip',
      'payee',
      'skip',
      'amountUYU',
      'amountUSD',
      'skip',
    ]);
    expect(guessConventions([...preamble, ...rows])).toEqual(uruguayan);
  });

  it('gives each row the currency of the column its amount is in, signs turned around', () => {
    const { headers, rows } = readCsvFile(santanderCard);
    const read = readImportRows(rows, guessRoles(headers, rows), uruguayan, {
      chargesPositive: true,
    });
    expect(read.problems).toEqual([]);
    expect(read.rows.map((r) => [r.date, r.payeeName, r.amount, r.currency])).toEqual([
      ['2026-08-04', 'Streaming', -999, 'USD'],
      ['2026-08-19', 'Supermercado', -134328, 'UYU'],
      ['2026-08-20', 'Pago Automatico', 1382126, 'UYU'],
      ['2026-08-21', 'Reembolso', 499, 'USD'],
    ]);
  });

  it('reads a currency column next to one amount column (Itaú card)', () => {
    const headers = [
      'Fecha',
      'Concepto',
      'Imp. cuota',
      'Imp. total',
      'Cuotas',
      'Moneda',
      'Categoría',
    ];
    const rows = [
      ['2026-09-30', 'DLOPedidosYa', '666,89', '666,89', '1/1', 'Pesos', 'Gastronomía'],
      ['2026-10-01', 'APPLECOMBILL', '3,03', '3,03', '1/1', 'Dolares', 'Otros'],
      ['2026-10-02', 'Heladera', '1000', '12000', '1/12', 'Pesos', 'Otros'],
      ['2026-10-03', 'Kiosco', '50', '50', '1/1', 'Euros', 'Otros'],
    ];
    const roles = guessColumnRoles(headers);
    expect(roles).toEqual(['date', 'payee', 'amount', 'skip', 'skip', 'currency', 'skip']);
    const read = readImportRows(rows, roles, uruguayan, { chargesPositive: true });
    expect(read.rows.map((r) => [r.payeeName, r.amount, r.currency])).toEqual([
      ['DLOPedidosYa', -66689, 'UYU'],
      ['APPLECOMBILL', -303, 'USD'],
      // The instalment charged this month, not the whole purchase
      ['Heladera', -100000, 'UYU'],
    ]);
    // Never imported into an account of another currency
    expect(read.problems).toEqual([{ row: 4, message: 'Can\'t read the currency "Euros"' }]);
  });

  it('only takes a "Currency" column that names pesos or dollars', () => {
    const headers = ['Date', 'Description', 'Amount', 'Currency'];
    expect(guessRoles(headers, [['2026-01-05', 'Cafe', '-4.50', 'USD']])[3]).toBe('currency');
    // Another bank's export: importing it keeps working as it did
    expect(guessRoles(headers, [['2026-01-05', 'Cafe', '-4.50', 'EUR']])[3]).toBe('skip');
    expect(guessRoles(headers, [])[3]).toBe('skip');
  });

  it('reads the ways banks name the two currencies', () => {
    for (const cell of ['Pesos', 'pesos uruguayos', 'UYU', '$', ' Peso ']) {
      expect(parseImportCurrency(cell)).toBe('UYU');
    }
    for (const cell of ['Dólares', 'Dolares', 'USD', 'US$', 'U$S', 'dollars']) {
      expect(parseImportCurrency(cell)).toBe('USD');
    }
    for (const cell of ['', 'EUR', 'Reales', '1.234,56'])
      expect(parseImportCurrency(cell)).toBeNull();
  });

  it('counts identical rows apart in each currency, so each account numbers its own', () => {
    const rows = [
      ['01/02/2026', 'Cafe', '5,00', '0,00'],
      ['01/02/2026', 'Cafe', '0,00', '5,00'],
      ['01/02/2026', 'Cafe', '5,00', '5,00'],
    ];
    const read = readImportRows(rows, ['date', 'payee', 'amountUYU', 'amountUSD'], uruguayan);
    expect(read.rows.map((r) => [r.currency, r.importedId])).toEqual([
      ['UYU', '2026-02-01|500|cafe'],
      ['USD', '2026-02-01|500|cafe'],
      ['UYU', '2026-02-01|500|cafe|2'],
      ['USD', '2026-02-01|500|cafe|2'],
    ]);
  });

  it('turning signs around changes nothing but the signs (property-based)', () => {
    const amount = fc.integer({ min: -9_999_999, max: 9_999_999 });
    const text = (cents: number) =>
      `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`;
    fc.assert(
      fc.property(fc.array(fc.tuple(amount, amount), { maxLength: 30 }), (amounts) => {
        const rows = amounts.map(([pesos, dollars]) => [
          '05/03/2026',
          'Cafe',
          text(pesos),
          text(dollars),
        ]);
        const roles: ColumnRole[] = ['date', 'payee', 'amountUYU', 'amountUSD'];
        const asWritten = readImportRows(rows, roles, uruguayan).rows;
        const turned = readImportRows(rows, roles, uruguayan, { chargesPositive: true }).rows;
        expect(turned.map((r) => [r.currency, -r.amount])).toEqual(
          asWritten.map((r) => [r.currency, r.amount]),
        );
        // Every amount of the file is read once, in its own currency
        for (const currency of ['UYU', 'USD'] as const) {
          const column = currency === 'UYU' ? 0 : 1;
          expect(asWritten.filter((r) => r.currency === currency).map((r) => r.amount)).toEqual(
            amounts.map((pair) => pair[column]).filter((cents) => cents !== 0),
          );
        }
      }),
    );
  });

  it('inflow and outflow columns already say the direction: signs are left alone', () => {
    const rows = [['05/03/2026', 'Cafe', '120,00', '']];
    const roles: ColumnRole[] = ['date', 'payee', 'outflow', 'inflow'];
    expect(readImportRows(rows, roles, uruguayan, { chargesPositive: true }).rows[0].amount).toBe(
      -12000,
    );
  });

  it('guesses that purchases are positive when most amounts are', () => {
    expect(guessChargesPositive([100, 200, -50])).toBe(true);
    expect(guessChargesPositive([-100, -200, 50])).toBe(false);
    expect(guessChargesPositive([100, -100])).toBe(false);
    expect(guessChargesPositive([])).toBe(false);
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
