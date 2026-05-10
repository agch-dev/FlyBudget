import { useState, useRef, useMemo } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useBudget, useBudgetSummary, useSetBudget } from '../hooks/useBudget';
import { formatCurrency, parseCents, centsToInput } from '../utils/currency';
import type { BudgetCategory, BudgetGroup } from '../types';

function AmountInput({ cents, onSave, onCancel }: { cents: number; onSave: (c: number) => void; onCancel: () => void }) {
  const [raw, setRaw] = useState(centsToInput(cents));
  const cancelled = useRef(false);

  return (
    <input
      autoFocus
      type="number"
      min="0"
      step="0.01"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { cancelled.current = true; onCancel(); }
      }}
      onBlur={() => { if (!cancelled.current) onSave(parseCents(raw)); }}
      className="w-28 text-right tabular-nums text-sm bg-white border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

function SpentBar({ spent, budgeted }: { spent: number; budgeted: number }) {
  if (budgeted <= 0) return null;
  const ratio = Math.min(spent / budgeted, 1);
  const color = ratio >= 1 ? 'bg-red-400' : ratio >= 0.8 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="mt-0.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
    </div>
  );
}

interface CategoryRowProps {
  cat: BudgetCategory;
  isIncome: boolean;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onSave: (cents: number) => void;
  onCancel: () => void;
}

function CategoryRow({ cat, isIncome, editingId, onStartEdit, onSave, onCancel }: CategoryRowProps) {
  const isEditing = editingId === cat.id;
  const balColor = cat.balance > 0 ? 'text-emerald-600' : cat.balance < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <tr className="hover:bg-blue-50/20 border-b border-gray-50 group">
      <td className="py-2.5 pl-10 pr-3 text-sm text-gray-700">
        {cat.name}
        {!isIncome && cat.carryOver !== 0 && (
          <span className={`ml-2 text-xs ${cat.carryOver > 0 ? 'text-emerald-400' : 'text-red-400'}`} title="Carried from prior months">
            ({cat.carryOver > 0 ? '+' : ''}{formatCurrency(cat.carryOver)})
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right">
        {isIncome ? (
          <span className="text-gray-300 text-sm tabular-nums">—</span>
        ) : isEditing ? (
          <AmountInput cents={cat.budgeted} onSave={onSave} onCancel={onCancel} />
        ) : (
          <button
            onClick={() => onStartEdit(cat.id)}
            className="tabular-nums text-sm rounded px-2 py-0.5 min-w-[7rem] text-right transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            {cat.budgeted === 0
              ? <span className="text-gray-300 group-hover:text-blue-300">{formatCurrency(0)}</span>
              : <span className="text-gray-800">{formatCurrency(cat.budgeted)}</span>
            }
          </button>
        )}
      </td>
      <td className="py-2.5 px-3">
        {isIncome ? (
          <div className="text-right tabular-nums text-sm text-emerald-600 font-medium">
            {cat.balance > 0 ? formatCurrency(cat.balance) : <span className="text-gray-300">—</span>}
          </div>
        ) : (
          <div className="text-right">
            <span className="tabular-nums text-sm text-gray-500">
              {cat.spent > 0 ? formatCurrency(cat.spent) : <span className="text-gray-200">—</span>}
            </span>
            <SpentBar spent={cat.spent} budgeted={cat.budgeted} />
          </div>
        )}
      </td>
      <td className="py-2.5 pl-3 pr-6 text-right">
        {isIncome ? (
          <span className="text-gray-300 text-sm tabular-nums">—</span>
        ) : (
          <span className={`tabular-nums text-sm font-medium ${balColor}`}>{formatCurrency(cat.balance)}</span>
        )}
      </td>
    </tr>
  );
}

interface GroupSectionProps {
  group: BudgetGroup;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onSave: (categoryId: string, cents: number) => void;
  onCancel: () => void;
}

function GroupSection({ group, editingId, onStartEdit, onSave, onCancel }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isIncome = Boolean(group.isIncome);

  const totals = useMemo(
    () => group.categories.reduce(
      (acc, c) => ({ budgeted: acc.budgeted + c.budgeted, spent: acc.spent + c.spent, balance: acc.balance + c.balance }),
      { budgeted: 0, spent: 0, balance: 0 }
    ),
    [group.categories]
  );

  const totBalColor = totals.balance > 0 ? 'text-emerald-700' : totals.balance < 0 ? 'text-red-600' : 'text-gray-400';

  return (
    <>
      <tr
        className="bg-gray-50 border-y border-gray-100 cursor-pointer select-none hover:bg-gray-100/80 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <td className="py-2.5 px-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 shrink-0">
              {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{group.name}</span>
            <span className="text-xs text-gray-400 ml-1">({group.categories.length})</span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums text-xs font-semibold text-gray-600">
          {!isIncome && totals.budgeted > 0 ? formatCurrency(totals.budgeted) : ''}
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums text-xs text-gray-400">
          {isIncome
            ? (totals.balance > 0 ? <span className="text-emerald-600 font-semibold">{formatCurrency(totals.balance)}</span> : '')
            : (totals.spent > 0 ? formatCurrency(totals.spent) : '')}
        </td>
        <td className={`py-2.5 pl-3 pr-6 text-right tabular-nums text-xs font-bold ${isIncome ? 'text-gray-300' : totBalColor}`}>
          {isIncome ? '—' : formatCurrency(totals.balance)}
        </td>
      </tr>
      {!collapsed && group.categories.map((cat) => (
        <CategoryRow
          key={cat.id}
          cat={cat}
          isIncome={isIncome}
          editingId={editingId}
          onStartEdit={onStartEdit}
          onSave={(cents) => onSave(cat.id, cents)}
          onCancel={onCancel}
        />
      ))}
    </>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
      <p className="text-xs text-gray-400 mb-0.5 uppercase tracking-wide">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export default function BudgetPage() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: groups = [] } = useBudget(selectedMonth);
  const { data: summary } = useBudgetSummary(selectedMonth);
  const setBudgetMutation = useSetBudget();

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);

  function handleSave(categoryId: string, budgeted: number) {
    setBudgetMutation.mutate({ month: selectedMonth, categoryId, budgeted });
    setEditingId(null);
  }

  const tbb = summary?.toBeBudgeted ?? 0;
  const carryOver = summary?.carryOver ?? 0;
  const tbbColor = tbb > 0 ? 'text-emerald-600' : tbb < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-b from-white to-slate-50/50 shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-lg font-bold text-gray-800 w-40 text-center">
              {format(monthDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">To Be Budgeted</p>
            <p className={`text-3xl font-bold tabular-nums ${tbbColor}`}>{formatCurrency(tbb)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {carryOver !== 0 && (
            <SummaryCard label="Carry Over" value={carryOver} color={carryOver >= 0 ? 'text-emerald-600' : 'text-red-500'} />
          )}
          <SummaryCard label="Income" value={summary?.income ?? 0} color="text-emerald-600" />
          <SummaryCard label="Budgeted" value={summary?.totalBudgeted ?? 0} color="text-blue-600" />
          <SummaryCard label="Remaining" value={tbb} color={tbbColor} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
            <tr>
              <th className="py-2.5 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Category</th>
              <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-40">Budgeted</th>
              <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-40">Spent</th>
              <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-40">Balance</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                editingId={editingId}
                onStartEdit={setEditingId}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
              />
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="py-16 text-center text-sm text-gray-400">
                  No categories yet. Add some in Settings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
