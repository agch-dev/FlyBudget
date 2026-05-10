import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/currency';

export const EXPENSE_COLORS = ['#f59e0b', '#ef4444', '#f97316', '#06b6d4', '#6366f1', '#ec4899', '#84cc16', '#0ea5e9', '#a78bfa', '#fb7185'];

export const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMM yy');

export function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-full flex items-end gap-2 px-4 pb-4 pt-8 animate-pulse">
      {[55, 72, 40, 85, 60, 78, 45, 90, 50, 65].map((h, i) => (
        <div key={i} className="flex-1 bg-gray-200 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ message = 'No data for this period.' }: { message?: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-sm text-gray-400">{message}</div>
    </div>
  );
}

export interface StatCard { label: string; value: string; sub?: string }

export function StatCardRow({ cards }: { cards: StatCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="flex gap-3 mb-5 flex-wrap">
      {cards.map(c => (
        <div key={c.label} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 min-w-[110px]">
          <p className="text-xs text-gray-400">{c.label}</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">{c.value}</p>
          {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
