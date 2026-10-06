import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { formatDateRange } from './dateRange';
import { formatDateAxisLabels, formatDateLabel } from './chartTicks';
import { comparisonLabels, groupName } from './reportText';
import { customReportCsvRows } from './exportCsv';
import { CSV_DELETED_CATEGORY, CSV_UNCATEGORIZED } from './exportCsv';

// What the reports say in each App Language. Expected text is written by hand, not built
// from the catalog.

describe('formatDateRange', () => {
  it('names a live range in the App Language', () => {
    const range = { preset: '6m', from: '2026-05', to: '2026-10' } as const;
    expect(formatDateRange(range)).toBe('Last 6 months');
    setLanguage('es');
    expect(formatDateRange(range)).toBe('Últimos 6 meses');
  });

  it('writes frozen months with the month names of the App Language', () => {
    const range = { preset: 'custom', from: '2026-01', to: '2026-08' } as const;
    expect(formatDateRange(range)).toBe('Jan 2026 – Aug 2026');
    setLanguage('es');
    expect(formatDateRange(range)).toBe('ene 2026 – ago 2026');
  });
});

describe('chart dates', () => {
  it('puts the day before the month in Spanish', () => {
    expect(formatDateAxisLabels(['2026-03-05', '2026-03-06'])).toEqual(['Mar 5', 'Mar 6']);
    expect(formatDateLabel('2026-03-05')).toBe('Mar 5, 2026');
    setLanguage('es');
    expect(formatDateAxisLabels(['2026-03-05', '2026-03-06'])).toEqual(['5 mar', '6 mar']);
    expect(formatDateAxisLabels(['2025-12-31', '2026-01-01'])).toEqual(["31 dic '25", "1 ene '26"]);
    expect(formatDateLabel('2026-03-05')).toBe('5 mar 2026');
    expect(formatDateLabel('2026-03')).toBe('marzo de 2026');
  });

  it('keeps month labels short in Spanish', () => {
    setLanguage('es');
    expect(formatDateAxisLabels(['2026-01', '2026-02'])).toEqual(['ene', 'feb']);
  });
});

describe('comparisonLabels', () => {
  const today = new Date(2026, 9, 5);

  it('names both periods of a spending comparison', () => {
    expect(comparisonLabels('month_vs_last_month', today)).toEqual({
      period: 'month',
      current: 'This month',
      comparison: 'Last month',
    });
    expect(comparisonLabels('week_vs_last_week', today)).toMatchObject({
      period: 'week',
      comparison: 'Last week',
    });
    expect(comparisonLabels('year_vs_last_year', today)).toMatchObject({
      period: 'year',
      current: 'This year',
    });
  });

  it('names the same month of last year', () => {
    expect(comparisonLabels('month_vs_last_year', today).comparison).toBe('Oct 2025');
    setLanguage('es');
    expect(comparisonLabels('month_vs_last_year', today).comparison).toBe('oct 2025');
  });

  it('is in Spanish when the app is', () => {
    setLanguage('es');
    expect(comparisonLabels('month_vs_average', today)).toEqual({
      period: 'month',
      current: 'Este mes',
      comparison: 'Mes promedio (últimos 12 meses)',
    });
  });
});

describe('groupName', () => {
  it('writes the label of a group the server sends no name for: no category, or no payee', () => {
    expect(groupName(null, 'category')).toBe('Uncategorized');
    expect(groupName(null, 'categoryGroup')).toBe('Uncategorized');
    expect(groupName(null, 'payee')).toBe('Unknown');
    setLanguage('es');
    expect(groupName(null, 'category')).toBe('Sin categoría');
    expect(groupName(null, 'categoryGroup')).toBe('Sin categoría');
    expect(groupName(null, 'payee')).toBe('Sin beneficiario');
  });

  it('shows every name the server sends as it is', () => {
    setLanguage('es');
    expect(groupName('Supermercado', 'category')).toBe('Supermercado');
    // A category or payee really called that: a name, not the label
    expect(groupName('Uncategorized', 'category')).toBe('Uncategorized');
    expect(groupName('Unknown', 'payee')).toBe('Unknown');
  });
});

describe('customReportCsvRows', () => {
  it('totals: one row per group, an unnamed one under the file’s English label', () => {
    const rows = customReportCsvRows(
      {
        mode: 'total',
        data: [
          { name: 'Supermercado', id: 'a', value: 5000 },
          { name: null, id: null, value: 700 },
        ],
      },
      'category',
    );
    expect(rows).toEqual([
      { name: 'Supermercado', amount_cents: 5000 },
      { name: 'Uncategorized', amount_cents: 700 },
    ]);
  });

  it('over time: one column per group, named as shown, with 0 where a month has nothing', () => {
    setLanguage('es');
    const rows = customReportCsvRows(
      {
        mode: 'time',
        groups: [
          { key: 'g0', name: 'Corner Market' },
          { key: 'g1', name: null },
        ],
        data: [
          { month: '2026-02', g0: 100 },
          { month: '2026-03', g0: 200, g1: 50 },
        ],
      },
      'payee',
    );
    expect(rows).toEqual([
      { month: '2026-02', 'Corner Market': 100, Unknown: 0 },
      { month: '2026-03', 'Corner Market': 200, Unknown: 50 },
    ]);
  });
});

describe('exported names', () => {
  it('stay English whatever the App Language', () => {
    setLanguage('es');
    expect(CSV_UNCATEGORIZED).toBe('Uncategorized');
    expect(CSV_DELETED_CATEGORY).toBe('Deleted category');
  });
});
