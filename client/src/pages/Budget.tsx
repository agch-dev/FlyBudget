import { useState, useRef, useMemo } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, Eye } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useBudget, useBudgetSummary, useSetBudget } from '../hooks/useBudget';
import { formatCurrency, parseCents, centsToInput } from '../utils/currency';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import type { BudgetCategory, BudgetGroup, BudgetType } from '../types';

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
  const color = ratio >= 1 ? 'bg-negative' : 'bg-positive';
  return (
    <div className="mt-0.5 h-1 w-full bg-surface-alt rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
    </div>
  );
}

function getStatus(spent: number, planned: number): 'over' | 'healthy' {
  if (spent > planned) return 'over';
  return 'healthy';
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
        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
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

interface IncomeGroupProps {
  group: BudgetGroup;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onSave: (categoryId: string, cents: number) => void;
  onCancel: () => void;
}

function IncomeGroupSection({ group, editingId, onStartEdit, onSave, onCancel }: IncomeGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  const totals = useMemo(
    () => group.categories.reduce(
      (acc, c) => ({ budgeted: acc.budgeted + c.budgeted, spent: acc.spent + c.spent, balance: acc.balance + c.balance }),
      { budgeted: 0, spent: 0, balance: 0 }
    ),
    [group.categories]
  );

  const budgeted = group.categories.filter(c => c.budgeted > 0 || c.spent > 0);
  const unbudgeted = group.categories.filter(c => c.budgeted === 0 && c.spent === 0);
  const visibleCats = showUnbudgeted ? group.categories : budgeted;

  return (
    <>
      <tr
        className="bg-surface border-y border-border-light cursor-pointer select-none hover:bg-hover transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary shrink-0">
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="text-sm font-bold text-text">{group.name}</span>
          </div>
        </td>
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary" />
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-positive">
          {totals.balance > 0 ? formatCurrency(totals.balance) : ''}
        </td>
        <td className="py-3 pl-3 pr-6 text-right tabular-nums text-sm font-semibold text-text-disabled">—</td>
      </tr>
      {!collapsed && (
        <>
          {visibleCats.map(cat => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              isIncome
              editingId={editingId}
              onStartEdit={onStartEdit}
              onSave={(cents) => onSave(cat.id, cents)}
              onCancel={onCancel}
            />
          ))}
          {unbudgeted.length > 0 && (
            <tr className="border-b border-border-light">
              <td colSpan={4} className="py-2 pl-10 pr-3">
                <button
                  onClick={() => setShowUnbudgeted(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  <Eye size={12} />
                  {showUnbudgeted ? 'Hide' : 'Show'} {unbudgeted.length} unbudgeted
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

interface BudgetTypeSectionProps {
  budgetType: BudgetType;
  label: string;
  categories: BudgetCategory[];
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onSave: (categoryId: string, cents: number) => void;
  onCancel: () => void;
}

function BudgetTypeSection({ label, categories, editingId, onStartEdit, onSave, onCancel }: BudgetTypeSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  const totals = useMemo(
    () => categories.reduce(
      (acc, c) => ({ budgeted: acc.budgeted + c.budgeted, spent: acc.spent + c.spent, balance: acc.balance + c.balance }),
      { budgeted: 0, spent: 0, balance: 0 }
    ),
    [categories]
  );

  const budgeted = categories.filter(c => c.budgeted > 0 || c.spent > 0);
  const unbudgeted = categories.filter(c => c.budgeted === 0 && c.spent === 0);
  const visibleCats = showUnbudgeted ? categories : budgeted;

  const status = getStatus(totals.spent, totals.budgeted);
  const ratio = totals.budgeted > 0 ? Math.min(totals.spent / totals.budgeted, 1) : 0;
  const remaining = totals.budgeted - totals.spent;
  const remainingColor = status === 'over' ? 'text-red-500' : 'text-green-600';

  return (
    <>
      <tr
        className="bg-surface border-y border-border-light cursor-pointer select-none hover:bg-hover transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary shrink-0">
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
            <span className="text-sm font-bold text-text">{label}</span>
          </div>
        </td>
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
          {totals.budgeted > 0 ? formatCurrency(totals.budgeted) : ''}
        </td>
        <td className="py-3 px-3 text-right tabular-nums text-sm text-text-tertiary">
          {totals.spent > 0 ? formatCurrency(totals.spent) : ''}
        </td>
        <td className={`py-3 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${remainingColor}`}>
          {formatCurrency(remaining)}
        </td>
      </tr>

      {!collapsed && (
        <>
          {totals.budgeted > 0 && (
            <tr className="border-b border-border-light">
              <td colSpan={4} className="px-4 py-1">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                  {status === 'over' ? (
                    <div className="h-full w-full bg-red-500 rounded-full" />
                  ) : (
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
                  )}
                </div>
              </td>
            </tr>
          )}

          {visibleCats.map(cat => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              isIncome={false}
              editingId={editingId}
              onStartEdit={onStartEdit}
              onSave={(cents) => onSave(cat.id, cents)}
              onCancel={onCancel}
            />
          ))}

          {unbudgeted.length > 0 && (
            <tr className="border-b border-border-light">
              <td colSpan={4} className="py-2 pl-10 pr-3">
                <button
                  onClick={() => setShowUnbudgeted(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  <Eye size={12} />
                  {showUnbudgeted ? 'Hide' : 'Show'} {unbudgeted.length} unbudgeted
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

const BUDGET_TYPES: { key: BudgetType; label: string }[] = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'flexible', label: 'Flexible' },
  { key: 'non_monthly', label: 'Non-Monthly' },
];

export default function BudgetPage() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);

  const { data: groups = [] } = useBudget(selectedMonth);
  const { data: summary } = useBudgetSummary(selectedMonth);
  const setBudgetMutation = useSetBudget();

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);

  const incomeGroups = useMemo(() => groups.filter(g => g.isIncome), [groups]);
  const allExpenseCats = useMemo(
    () => groups.filter(g => !g.isIncome).flatMap(g => g.categories),
    [groups],
  );

  const expensesByType = useMemo(() =>
    BUDGET_TYPES.map(t => ({
      ...t,
      categories: allExpenseCats.filter(c => c.budgetType === t.key),
    })).filter(bt => bt.categories.length > 0),
    [allExpenseCats],
  );

  const incomeTotals = useMemo(() => {
    const cats = incomeGroups.flatMap(g => g.categories);
    return {
      budgeted: cats.reduce((s, c) => s + c.budgeted, 0),
      received: cats.reduce((s, c) => s + c.balance, 0),
    };
  }, [incomeGroups]);

  const expenseTotals = useMemo(() => ({
    budgeted: allExpenseCats.reduce((s, c) => s + c.budgeted, 0),
    spent: allExpenseCats.reduce((s, c) => s + c.spent, 0),
    balance: allExpenseCats.reduce((s, c) => s + c.balance, 0),
  }), [allExpenseCats]);

  function handleSave(categoryId: string, budgeted: number) {
    setBudgetMutation.mutate({ month: selectedMonth, categoryId, budgeted });
    setEditingId(null);
  }

  function goToToday() {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }

  const tbb = summary?.toBeBudgeted ?? 0;
  const carryOver = summary?.carryOver ?? 0;
  const tbbColor = tbb > 0 ? 'text-positive' : tbb < 0 ? 'text-negative' : 'text-text-disabled';
  const tbbLabel = tbb >= 0 ? 'Left to Plan' : 'Over Budget';
  const expBalColor = expenseTotals.balance > 0 ? 'text-positive' : expenseTotals.balance < 0 ? 'text-negative' : 'text-text-disabled';

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <span className="text-lg font-semibold text-text">
              {format(monthDate, 'MMMM yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))}
              className="p-1.5 rounded-md hover:bg-surface-alt text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <Button variant="secondary" size="sm" onClick={goToToday}>Today</Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-0.5">{tbbLabel}</p>
            <p className={`text-2xl font-semibold tabular-nums ${tbbColor}`}>{formatCurrency(tbb)}</p>
          </div>
          <div className={`grid gap-3 ${carryOver !== 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {carryOver !== 0 && (
              <StatCard label="Carry Over" value={formatCurrency(carryOver)} valueColor={carryOver >= 0 ? 'text-positive' : 'text-negative'} />
            )}
            <StatCard label="Income" value={formatCurrency(summary?.income ?? 0)} valueColor="text-positive" />
            <StatCard label="Planned" value={formatCurrency(summary?.totalBudgeted ?? 0)} valueColor="text-brand-600" />
          </div>
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
            {/* Income section header */}
            <tr
              className="bg-gray-100 border-y border-border cursor-pointer select-none hover:bg-gray-200 transition-colors"
              onClick={() => setIncomeCollapsed(c => !c)}
            >
              <td className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary shrink-0">
                    {incomeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                  <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Income</span>
                </div>
              </td>
              <td className="py-2 px-3 text-right text-xs font-medium text-text-tertiary">Planned</td>
              <td className="py-2 px-3 text-right text-xs font-medium text-text-tertiary">Actual</td>
              <td className="py-2 pl-3 pr-6 text-right text-xs font-medium text-text-tertiary">Remaining</td>
            </tr>

            {!incomeCollapsed && (
              <>
                {incomeGroups.map(group => (
                  <IncomeGroupSection
                    key={group.id}
                    group={group}
                    editingId={editingId}
                    onStartEdit={setEditingId}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                  />
                ))}

                {/* Total Income row */}
                <tr className="bg-surface border-y border-border">
                  <td className="py-2.5 px-4 text-sm font-bold text-text">Total Income</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                    {formatCurrency(incomeTotals.budgeted)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm font-semibold text-positive">
                    {formatCurrency(incomeTotals.received)}
                  </td>
                  <td className="py-2.5 pl-3 pr-6" />
                </tr>
              </>
            )}

            {/* Expenses section header */}
            <tr
              className="bg-gray-100 border-y border-border cursor-pointer select-none hover:bg-gray-200 transition-colors"
              onClick={() => setExpensesCollapsed(c => !c)}
            >
              <td className="py-2 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary shrink-0">
                    {expensesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                  <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Expenses</span>
                </div>
              </td>
              <td className="py-2 px-3 text-right text-xs font-medium text-text-tertiary">Planned</td>
              <td className="py-2 px-3 text-right text-xs font-medium text-text-tertiary">Actual</td>
              <td className="py-2 pl-3 pr-6 text-right text-xs font-medium text-text-tertiary">Remaining</td>
            </tr>

            {!expensesCollapsed && (
              <>
                {expensesByType.map(bt => (
                  <BudgetTypeSection
                    key={bt.key}
                    budgetType={bt.key}
                    label={bt.label}
                    categories={bt.categories}
                    editingId={editingId}
                    onStartEdit={setEditingId}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                  />
                ))}

                {/* Total Expenses row */}
                <tr className="bg-surface border-y border-border">
                  <td className="py-2.5 px-4 text-sm font-bold text-text">Total Expenses</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                    {formatCurrency(expenseTotals.budgeted)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
                    {formatCurrency(expenseTotals.spent)}
                  </td>
                  <td className={`py-2.5 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${expBalColor}`}>
                    {formatCurrency(expenseTotals.balance)}
                  </td>
                </tr>
              </>
            )}

            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="py-16 text-center text-sm text-text-tertiary">
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
