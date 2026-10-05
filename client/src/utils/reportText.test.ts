import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { formatDateRange } from './dateRange';
import { formatDateAxisLabels, formatDateLabel } from './chartTicks';
import { comparisonLabels, groupName } from './reportText';
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
  it("translates the server's names for what has no category or payee", () => {
    expect(groupName('Uncategorized')).toBe('Uncategorized');
    setLanguage('es');
    expect(groupName('Uncategorized')).toBe('Sin categoría');
    expect(groupName('Unknown')).toBe('Desconocido');
  });

  it('leaves the names the user chose alone', () => {
    setLanguage('es');
    expect(groupName('Groceries')).toBe('Groceries');
    expect(groupName('Income')).toBe('Income');
  });
});

describe('exported names', () => {
  it('stay English whatever the App Language', () => {
    setLanguage('es');
    expect(CSV_UNCATEGORIZED).toBe('Uncategorized');
    expect(CSV_DELETED_CATEGORY).toBe('Deleted category');
  });
});
