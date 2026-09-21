import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Search, X } from 'lucide-react';
import type { TransactionQueryParams } from '../../types';

export type DatePreset = 'this-month' | 'last-3' | 'this-year' | 'all';

export interface FilterState {
  search: string;
  datePreset: DatePreset;
  cleared: 'all' | '0' | '1';
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  datePreset: 'this-month',
  cleared: 'all',
};

function dateRangeFor(preset: DatePreset): { from?: string; to?: string } {
  const today = new Date();
  switch (preset) {
    case 'this-month':
      return {
        from: format(startOfMonth(today), 'yyyy-MM-dd'),
        to: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'last-3':
      return {
        from: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
        to: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'this-year':
      return {
        from: format(startOfYear(today), 'yyyy-MM-dd'),
        to: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'all':
      return {};
  }
}

export function filtersToParams(f: FilterState, accountId?: string): TransactionQueryParams {
  const range = dateRangeFor(f.datePreset);
  return {
    ...(accountId ? { accountId } : {}),
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(f.search ? { search: f.search } : {}),
    ...(f.cleared !== 'all' ? { cleared: Number(f.cleared) as 0 | 1 } : {}),
  };
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-3', label: 'Last 3 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

interface Props {
  state: FilterState;
  onChange: (s: FilterState) => void;
}

export function TransactionFilters({ state, onChange }: Props) {
  const [rawSearch, setRawSearch] = useState(state.search);

  useEffect(() => { setRawSearch(state.search); }, [state.search]);

  const activeCount = [
    state.datePreset !== 'this-month',
    !!state.search,
    state.cleared !== 'all',
  ].filter(Boolean).length;

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const search = e.target.value;
    setRawSearch(search);
    onChange({ ...state, search });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border-light bg-surface flex-wrap">
      <div className="relative flex items-center flex-1 min-w-40">
        <Search size={14} className="absolute left-2.5 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={rawSearch}
          onChange={handleSearchChange}
          placeholder="Search payee or notes…"
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-full bg-surface text-text focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        {rawSearch && (
          <button
            onClick={() => { setRawSearch(''); onChange({ ...state, search: '' }); }}
            className="absolute right-2 text-text-tertiary hover:text-text-secondary"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex gap-0 border-b border-transparent">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange({ ...state, datePreset: p.value })}
            className={`px-2.5 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
              state.datePreset === p.value
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-0 border-b border-transparent">
        {(['all', '1', '0'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange({ ...state, cleared: v })}
            className={`px-2.5 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
              state.cleared === v
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {v === 'all' ? 'All' : v === '1' ? 'Cleared' : 'Uncleared'}
          </button>
        ))}
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => { setRawSearch(''); onChange(DEFAULT_FILTERS); }}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          Reset
        </button>
      )}
    </div>
  );
}
