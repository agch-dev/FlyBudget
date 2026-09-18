import { useState, useRef, useMemo } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useBudget, useBudgetSummary, useSetBudget } from '../hooks/useBudget';
import { formatCurrency, parseCents, centsToInput } from '../utils/currency';
import { StatCard } from '../components/ui/StatCard';
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
      className="w-28 text-right tabular-nums text-sm bg-surface border border-brand-500 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
    />
  );
}

function SpentBar({ spent, budgeted }: { spent: number; budgeted: number }) {
  if (budgeted <= 0) return null;
  const ratio = Math.min(spent / budgeted, 1);
  const color = ratio >= 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-caution' : 'bg-positive';
  return (
    <div className="mt-0.5 h-1 w-full bg-surface-alt rounded-full overflow-hidden">
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
  const balColor = cat.balance > 0 ? 'text-positive' : cat.balance < 0 ? 'text-negative' : 'text-text-disabled';

  return (
    <tr className="hover:bg-brand-50 border-b border-border-light group">
      <td className="py-2 pl-10 pr-3 text-sm text-text-secondary">
        {cat.name}
        {!isIncome && cat.carryOver !== 0 && (
          <span className={`ml-2 text-xs ${cat.carryOver > 0 ? 'text-positive' : 'text-negative'}`} title="Carried from prior months">
            ({cat.carryOver > 0 ? '+' : ''}{formatCurrency(cat.carryOver)})
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {isIncome ? (
          <span className="text-text-disabled text-sm tabular-nums">—</span>
        ) : isEditing ? (
          <AmountInput cents={cat.budgeted} onSave={onSave} onCancel={onCancel} />
        ) : (
          <button
            onClick={() => onStartEdit(cat.id)}
            className="tabular-nums text-sm rounded-md px-2 py-0.5 min-w-[7rem] text-right transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            {cat.budgeted === 0
              ? <span className="text-text-disabled group-hover:text-brand-300">{formatCurrency(0)}</span>
              : <span className="text-text">{formatCurrency(cat.budgeted)}</span>
            }
          </button>
        )}
      </td>
      <td className="py-2 px-3">
        {isIncome ? (
          <div className="text-right tabular-nums text-sm text-positive font-medium">
            {cat.balance > 0 ? formatCurrency(cat.balance) : <span className="text-text-disabled">—</span>}
          </div>
        ) : (
          <div className="text-right">
            <span className="tabular-nums text-sm text-text-tertiary">
              {cat.spent > 0 ? formatCurrency(cat.spent) : <span className="text-text-disabled">—</span>}
            </span>
            <SpentBar spent={cat.spent} budgeted={cat.budgeted} />
          </div>
        )}
      </td>
      <td className="py-2 pl-3 pr-6 text-right">
        {isIncome ? (
          <span className="text-text-disabled text-sm tabular-nums">—</span>
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

  const totBalColor = totals.balance > 0 ? 'text-positive' : totals.balance < 0 ? 'text-negative' : 'text-text-disabled';

  return (
    <>
      <tr
        className="bg-surface-alt border-y border-border-light cursor-pointer select-none hover:bg-hover transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <td className="py-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary shrink-0">
              {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </span>
            <span className="text-xs font-semibold text-text-secondary">{group.name}</span>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-xs font-semibold text-text-secondary">
          {!isIncome && totals.budgeted > 0 ? formatCurrency(totals.budgeted) : ''}
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-xs text-text-tertiary">
          {isIncome
            ? (totals.balance > 0 ? <span className="text-positive font-semibold">{formatCurrency(totals.balance)}</span> : '')
            : (totals.spent > 0 ? formatCurrency(totals.spent) : '')}
        </td>
        <td className={`py-2 pl-3 pr-6 text-right tabular-nums text-xs font-semibold ${isIncome ? 'text-text-disabled' : totBalColor}`}>
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
  const tbbColor = tbb > 0 ? 'text-positive' : tbb < 0 ? 'text-negative' : 'text-text-disabled';
  const tbbLabel = tbb >= 0 ? 'Left to Plan' : 'Over Budget';

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-lg font-semibold text-text w-40 text-center">
              {format(monthDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-text-tertiary mb-0.5">{tbbLabel}</p>
            <p className={`text-2xl font-semibold tabular-nums ${tbbColor}`}>{formatCurrency(tbb)}</p>
          </div>
        </div>
        <div className={`grid gap-3 ${carryOver !== 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {carryOver !== 0 && (
            <StatCard label="Carry Over" value={formatCurrency(carryOver)} valueColor={carryOver >= 0 ? 'text-positive' : 'text-negative'} />
          )}
          <StatCard label="Income" value={formatCurrency(summary?.income ?? 0)} valueColor="text-positive" />
          <StatCard label="Planned" value={formatCurrency(summary?.totalBudgeted ?? 0)} valueColor="text-brand-600" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface z-10 border-b border-border">
            <tr>
              <th className="py-2.5 px-4 text-left text-xs font-medium text-text-tertiary">Category</th>
              <th className="py-2.5 px-3 text-right text-xs font-medium text-text-tertiary w-40">Planned</th>
              <th className="py-2.5 px-3 text-right text-xs font-medium text-text-tertiary w-40">Actual</th>
              <th className="py-2.5 pl-3 pr-6 text-right text-xs font-medium text-text-tertiary w-40">Remaining</th>
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
                <td colSpan={4} className="py-16 text-center text-sm text-text-tertiary">
                  No categories yet. Add some in Settings.
                </td>
              </tr>
            )}
          </tbody>
          {tbb !== 0 && groups.length > 0 && (
            <tfoot>
              <tr className="sticky bottom-0 bg-surface border-t border-border">
                <td className="py-3 px-4 text-sm font-semibold text-text">{tbbLabel}</td>
                <td colSpan={2} />
                <td className={`py-3 pl-3 pr-6 text-right text-sm font-semibold tabular-nums ${tbbColor}`}>
                  {formatCurrency(tbb)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
