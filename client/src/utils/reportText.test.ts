import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n';
import { formatDateRange } from './dateRange';
import { formatDateAxisLabels, formatDateLabel } from './chartTicks';
import { comparisonLabels, groupName, shownReport } from './reportText';
import type { CustomReportData } from '../types';

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

describe('shownReport', () => {
  it('totals: a stored "Uncategorized" and rows with no category are one row, figures summed', () => {
    const data: CustomReportData = {
      mode: 'total',
      data: [
        { name: 'Groceries', id: 'g', value: 300 },
        { name: 'Uncategorized', id: 'u', value: 100 },
        { name: null, id: null, value: 250 },
      ],
    };
    expect(shownReport(data, 'category')).toEqual({
      mode: 'total',
      data: [
        { name: 'Uncategorized', value: 350 },
        { name: 'Groceries', value: 300 },
      ],
    });
  });

  it('over time: a payee named "Unknown" and rows with no payee are one group', () => {
    const data: CustomReportData = {
      mode: 'time',
      groups: [
        { key: 'g0', name: 'Corner Market' },
        { key: 'g1', name: 'Unknown' },
        { key: 'g2', name: null },
      ],
      data: [
        { month: '2026-02', g0: 100, g1: 40 },
        { month: '2026-03', g1: 5, g2: 50 },
      ],
    };
    expect(shownReport(data, 'payee')).toEqual({
      mode: 'time',
      groups: [
        { key: 'g0', name: 'Corner Market' },
        { key: 'g1', name: 'Unknown' },
      ],
      data: [
        { month: '2026-02', g0: 100, g1: 40 },
        { month: '2026-03', g0: 0, g1: 55 },
      ],
    });
  });

  it('names an unnamed group in the App Language', () => {
    setLanguage('es');
    const data: CustomReportData = { mode: 'total', data: [{ name: null, id: null, value: 7 }] };
    expect(shownReport(data, 'category')).toEqual({
      mode: 'total',
      data: [{ name: 'Sin categoría', value: 7 }],
    });
  });

  // Names drawn from a small set so labels often collide, the unnamed group among them
  const name = fc.constantFrom<string | null>(null, 'Uncategorized', 'Unknown', 'Food', 'Rent');
  const cents = fc.integer({ min: -1_000_000, max: 1_000_000 });
  const groupBy = fc.constantFrom('category' as const, 'payee' as const);

  it('totals: no figure is lost, and every label is shown once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ name, id: fc.option(fc.string()), value: cents })),
        groupBy,
        (rows, by) => {
          const shown = shownReport({ mode: 'total', data: rows }, by);
          if (shown.mode !== 'total') throw new Error('mode changed');
          const labels = shown.data.map((r) => r.name);
          expect(new Set(labels).size).toBe(labels.length);
          for (const label of new Set(rows.map((r) => groupName(r.name, by)))) {
            const sent = rows
              .filter((r) => groupName(r.name, by) === label)
              .reduce((s, r) => s + r.value, 0);
            expect(shown.data.find((r) => r.name === label)?.value ?? 0).toBe(sent);
          }
        },
      ),
    );
  });

  it('over time: no figure is lost in any month, and every label is one group', () => {
    fc.assert(
      fc.property(
        fc.array(name, { maxLength: 6 }),
        fc.array(fc.array(fc.option(cents), { minLength: 6, maxLength: 6 }), { maxLength: 4 }),
        groupBy,
        (names, months, by) => {
          const groups = names.map((n, i) => ({ key: `g${i}`, name: n }));
          const data = months.map((cells, m) => {
            const row: Record<string, string | number> = { month: `2026-0${m + 1}` };
            groups.forEach((g, i) => {
              if (cells[i] !== null) row[g.key] = cells[i];
            });
            return row;
          });
          const shown = shownReport({ mode: 'time', groups, data }, by);
          if (shown.mode !== 'time') throw new Error('mode changed');
          const labels = shown.groups.map((g) => g.name);
          expect(new Set(labels).size).toBe(labels.length);
          expect(shown.data.map((r) => r.month)).toEqual(data.map((r) => r.month));
          data.forEach((row, m) => {
            for (const g of shown.groups) {
              const sent = groups
                .filter((s) => groupName(s.name, by) === g.name)
                .reduce((s, s2) => s + Number(row[s2.key] ?? 0), 0);
              expect(shown.data[m][g.key]).toBe(sent);
            }
          });
        },
      ),
    );
  });
});
