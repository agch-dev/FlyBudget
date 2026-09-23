import { useState, useRef, useMemo } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, Eye } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useBudget, useBudgetSummary, useSetBudget } from '../hooks/useBudget';
import { formatCurrency, parseCents, centsToInput } from '../utils/currency';
import { BudgetSummaryWidget } from '../components/budget/BudgetSummaryWidget';
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
      onFocus={(e) => { const el = e.target; const len = el.value.length; el.setSelectionRange(len, len); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { cancelled.current = true; onCancel(); }
      }}
      onBlur={() => { if (!cancelled.current) onSave(parseCents(raw)); }}
      className="w-28 text-right tabular-nums text-sm bg-surface border border-brand-500 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
    />
  );
}

function SpentBar({ spent, budgeted, groupBalance }: { spent: number; budgeted: number; groupBalance?: number }) {
  if (budgeted <= 0 && spent <= 0) return null;
  const effectiveBudget = Math.max(budgeted, 1);
  const ratio = Math.min(spent / effectiveBudget, 1);

  let color: string;
  if (spent <= budgeted) {
    color = 'bg-positive';
  } else if (groupBalance !== undefined && groupBalance >= 0) {
    color = 'bg-caution';
  } else {
    color = 'bg-negative';
  }

  const fillWidth = spent > budgeted ? 100 : ratio * 100;

  return (
    <div className="h-0.5 w-full bg-surface-alt overflow-hidden">
      <div className={`h-full transition-all ${color}`} style={{ width: `${fillWidth.toFixed(1)}%` }} />
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
  groupBalance?: number;
}

function CategoryRow({ cat, isIncome, editingId, onStartEdit, onSave, onCancel, groupBalance }: CategoryRowProps) {
  const isEditing = editingId === cat.id;
  const actual = isIncome ? cat.balance : cat.spent;
  const remaining = cat.budgeted - actual;
  const balColor = remaining > 0 ? 'text-positive' : remaining < 0 ? 'text-negative' : 'text-text-disabled';

  return (
    <>
      <tr className="border-b border-border-light">
        <td className="py-2 pl-10 pr-3 text-sm text-text-secondary">
          {cat.icon ? `${cat.icon} ` : ''}{cat.name}
        </td>
        <td className="py-2 px-3 text-right">
          {isEditing ? (
            <AmountInput cents={cat.budgeted} onSave={onSave} onCancel={onCancel} />
          ) : (
            <button
              onClick={() => onStartEdit(cat.id)}
              className="tabular-nums text-sm rounded-md px-2 py-1 min-w-[7rem] text-right border border-border bg-surface transition-colors hover:border-brand-400 hover:text-brand-600 cursor-text"
            >
              <span className="text-text">{formatCurrency(cat.budgeted)}</span>
            </button>
          )}
        </td>
        <td className="py-2 px-3">
          <div className="text-right">
            <span className={`tabular-nums text-sm ${isIncome ? 'text-positive font-medium' : 'text-text-tertiary'}`}>
              {actual > 0
                ? formatCurrency(actual)
                : <span className="text-text-disabled">—</span>
              }
            </span>
          </div>
        </td>
        <td className="py-2 pl-3 pr-6 text-right">
          <span className={`tabular-nums text-sm font-medium ${balColor}`}>{formatCurrency(remaining)}</span>
        </td>
      </tr>
      {(cat.budgeted > 0 || actual > 0) && (
        <tr>
          <td />
          <td colSpan={3} className="pr-6 pt-0 pb-2">
            <SpentBar spent={actual} budgeted={cat.budgeted} groupBalance={groupBalance} />
          </td>
        </tr>
      )}
    </>
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
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-text-secondary">
          {totals.budgeted > 0 ? formatCurrency(totals.budgeted) : ''}
        </td>
        <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-positive">
          {totals.balance > 0 ? formatCurrency(totals.balance) : ''}
        </td>
        <td className={`py-3 pl-3 pr-6 text-right tabular-nums text-sm font-semibold ${totals.budgeted - totals.balance > 0 ? 'text-positive' : totals.budgeted - totals.balance < 0 ? 'text-negative' : 'text-text-disabled'}`}>
          {formatCurrency(totals.budgeted - totals.balance)}
        </td>
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
  const remainingColor = status === 'over' ? 'text-negative' : 'text-positive';

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
                <div className="h-1.5 w-full bg-surface-alt overflow-hidden">
                  {status === 'over' ? (
                    <div className="h-full w-full bg-negative" />
                  ) : (
                    <div className="h-full bg-positive" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
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
              groupBalance={remaining}
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
  { key: 'savings', label: 'Savings/Investments' },
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

  const savingsTotals = useMemo(() => {
    const cats = allExpenseCats.filter(c => c.budgetType === 'savings');
    return {
      budgeted: cats.reduce((s, c) => s + c.budgeted, 0),
      spent: cats.reduce((s, c) => s + c.spent, 0),
    };
  }, [allExpenseCats]);

  function handleSave(categoryId: string, budgeted: number) {
    setBudgetMutation.mutate({ month: selectedMonth, categoryId, budgeted });
    setEditingId(null);
  }

  function goToToday() {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  }

  const tbb = summary?.toBeBudgeted ?? 0;
  const carryOver = summary?.carryOver ?? 0;
  const expRemaining = expenseTotals.budgeted - expenseTotals.spent;
  const expBalColor = expRemaining > 0 ? 'text-positive' : expRemaining < 0 ? 'text-negative' : 'text-text-disabled';

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
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
      </div>

      <div className="flex flex-1 overflow-y-auto">
      <div className="flex-1">
        <table className="w-full border-collapse">
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
                    {formatCurrency(expRemaining)}
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

      <div className="w-80 shrink-0 border-l border-border p-4 self-start sticky top-0">
        <div>
          <BudgetSummaryWidget
            toBeBudgeted={tbb}
            carryOver={carryOver}
            incomePlanned={incomeTotals.budgeted}
            incomeEarned={incomeTotals.received}
            expensesPlanned={expenseTotals.budgeted}
            expensesSpent={expenseTotals.spent}
            savingsPlanned={savingsTotals.budgeted}
            savingsContributed={savingsTotals.spent}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
