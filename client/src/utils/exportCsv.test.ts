import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { setLanguage } from '../i18n';
import {
  csvCell,
  csvFileName,
  csvFileText,
  csvRows,
  customReportCsvRows,
  rowsInCurrency,
} from './exportCsv';

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

  it('names the column in the App Language and keeps the sign', () => {
    setLanguage('es');
    expect(rowsInCurrency([{ mes: '2026-03' }], 'USD')).toEqual([
      { mes: '2026-03', moneda: 'US$' },
    ]);
  });
});

// A report's "Export CSV" file follows the App Language: its header row, the names the app
// supplies and its file name. Expected text is written by hand, not built from the catalog.
describe('a report file in the App Language', () => {
  const summary = [
    { month: '2026-03', income_cents: 500_000, expenses_cents: 123_456, net_cents: 376_544 },
    { month: '2026-04', income_cents: 0, expenses_cents: 120, net_cents: -120 },
  ];
  const file = () => csvFileText(rowsInCurrency(csvRows(summary), 'USD'));

  it('is written in English', () => {
    expect(file()).toBe(
      'month,income_cents,expenses_cents,net_cents,currency\n' +
        '2026-03,500000,123456,376544,US$\n' +
        '2026-04,0,120,-120,US$',
    );
  });

  it('has Spanish headers, with months, amounts and the sign written as in English', () => {
    setLanguage('es');
    expect(file()).toBe(
      'mes,ingresos_centavos,gastos_centavos,neto_centavos,moneda\n' +
        '2026-03,500000,123456,376544,US$\n' +
        '2026-04,0,120,-120,US$',
    );
  });

  it('names every column of the built-in reports and cash flow in Spanish', () => {
    setLanguage('es');
    const [row] = csvRows([
      {
        transactions: 1,
        assets_cents: 1,
        liabilities_cents: 1,
        net_worth_cents: 1,
        change_cents: 1,
        pesos_cents: 1,
        dollars_cents: 1,
        category: 'x',
        group: 'x',
        spent_cents: 1,
        monthly_average_cents: 1,
        date: '2026-03-05',
        money_in_cents: 1,
        money_out_cents: 1,
        total_cents: 1,
      },
    ]);
    expect(Object.keys(row)).toEqual([
      'transacciones',
      'activos_centavos',
      'pasivos_centavos',
      'patrimonio_neto_centavos',
      'variación_centavos',
      'pesos_centavos',
      'dólares_centavos',
      'categoría',
      'grupo',
      'gastado_centavos',
      'promedio_mensual_centavos',
      'fecha',
      'entradas_centavos',
      'salidas_centavos',
      'total_centavos',
    ]);
  });

  it('takes rows without a column the report only sometimes has', () => {
    const rows: { month: string; pesos_cents?: number }[] = [{ month: '2026-03' }];
    expect(csvRows(rows)).toEqual([{ month: '2026-03' }]);
  });

  it('escapes a header like any other text cell', () => {
    expect(csvFileText([{ '=SUM(A1)': 1, 'a,b': 2 }])).toBe(`'=SUM(A1),"a,b"\n1,2`);
  });

  it('has no text when there are no rows', () => {
    expect(csvFileText([])).toBe('');
  });

  it('is named in the App Language', () => {
    const names = () => [
      csvFileName('summary', '2026-01', '2026-03'),
      csvFileName('net-worth', '2026-01', '2026-03'),
      csvFileName('income-expenses', '2026-01', '2026-03'),
      csvFileName('spending', '2026-01', '2026-03'),
      csvFileName('spending-trends', '2026-01', '2026-03'),
      csvFileName('calendar', '2026-01', '2026-03'),
      csvFileName('custom', '2026-01', '2026-03'),
      csvFileName('cash-flow', '2026-01', '2026-03'),
    ];
    expect(names()).toEqual([
      'report-summary-2026-01-to-2026-03.csv',
      'report-net-worth-2026-01-to-2026-03.csv',
      'report-income-expenses-2026-01-to-2026-03.csv',
      'report-spending-2026-01-to-2026-03.csv',
      'report-spending-trends-2026-01-to-2026-03.csv',
      'report-calendar-2026-01-to-2026-03.csv',
      'custom-report-2026-01-2026-03.csv',
      'cash-flow-2026-01-2026-03.csv',
    ]);
    setLanguage('es');
    expect(names()).toEqual([
      'reporte-resumen-2026-01-a-2026-03.csv',
      'reporte-patrimonio-neto-2026-01-a-2026-03.csv',
      'reporte-ingresos-y-gastos-2026-01-a-2026-03.csv',
      'reporte-gastos-2026-01-a-2026-03.csv',
      'reporte-tendencias-de-gastos-2026-01-a-2026-03.csv',
      'reporte-calendario-2026-01-a-2026-03.csv',
      'reporte-personalizado-2026-01-a-2026-03.csv',
      'flujo-de-fondos-2026-01-a-2026-03.csv',
    ]);
  });
});

describe('customReportCsvRows', () => {
  const totals = {
    mode: 'total',
    data: [
      { name: 'Supermercado', id: 'a', value: 5000 },
      { name: null, id: null, value: 700 },
    ],
  } as const;
  const overTime = {
    mode: 'time',
    groups: [
      { key: 'g0', name: 'Corner Market' },
      { key: 'g1', name: null },
    ],
    data: [
      { month: '2026-02', g0: 100 },
      { month: '2026-03', g0: 200, g1: 50 },
    ],
  } as const;
  const rows = (data: typeof totals | typeof overTime, groupBy: 'category' | 'payee') =>
    customReportCsvRows(data as unknown as Parameters<typeof customReportCsvRows>[0], groupBy);

  it('totals: one row per group, an unnamed one under the name the app gives it', () => {
    expect(rows(totals, 'category')).toEqual([
      { name: 'Supermercado', amount_cents: 5000 },
      { name: 'Uncategorized', amount_cents: 700 },
    ]);
    setLanguage('es');
    expect(rows(totals, 'category')).toEqual([
      { nombre: 'Supermercado', monto_centavos: 5000 },
      { nombre: 'Sin categoría', monto_centavos: 700 },
    ]);
  });

  it('over time: one column per group, named as shown, with 0 where a month has nothing', () => {
    expect(rows(overTime, 'payee')).toEqual([
      { month: '2026-02', 'Corner Market': 100, Unknown: 0 },
      { month: '2026-03', 'Corner Market': 200, Unknown: 50 },
    ]);
    setLanguage('es');
    expect(rows(overTime, 'payee')).toEqual([
      { mes: '2026-02', 'Corner Market': 100, 'Sin beneficiario': 0 },
      { mes: '2026-03', 'Corner Market': 200, 'Sin beneficiario': 50 },
    ]);
  });

  it('over time: a payee called "Unknown" and rows with no payee are one column, summed', () => {
    const data = {
      mode: 'time',
      groups: [
        { key: 'g0', name: 'Unknown' },
        { key: 'g1', name: null },
      ],
      data: [{ month: '2026-03', g0: 30, g1: 50 }],
    } as const;
    expect(
      customReportCsvRows(data as unknown as Parameters<typeof customReportCsvRows>[0], 'payee'),
    ).toEqual([{ month: '2026-03', Unknown: 80 }]);
  });
});
