import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Split, Plus, Trash2 } from 'lucide-react';
import { PayeeCombobox } from './PayeeCombobox';
import { CategorySelect } from './CategorySelect';
import type { Account, CategoryGroup, Payee, Transaction } from '../../types';
import type { CreateTransactionData, SplitItem } from '../../api/transactions';
import { parseCents, centsToInput, formatCurrency } from '../../utils/currency';

interface Props {
  initial?: Transaction;
  accountId: string;
  groups: CategoryGroup[];
  payees: Payee[];
  accounts?: Account[];
  onSave: (data: CreateTransactionData) => void;
  onCancel: () => void;
  showAccountCol?: boolean;
}

interface SplitRow { categoryId: string | null; amount: string; notes: string; }

export function TransactionFormRow({ initial, accountId, groups, payees, accounts, onSave, onCancel, showAccountCol }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initial?.date ?? today);
  const [payee, setPayee] = useState({ id: initial?.payeeId ?? null, name: initial?.payeeName ?? '' });
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [outflow, setOutflow] = useState(initial?.amount !== undefined && initial.amount < 0 ? centsToInput(initial.amount) : '');
  const [inflow, setInflow] = useState(initial?.amount !== undefined && initial.amount > 0 ? centsToInput(initial.amount) : '');
  const [cleared, setCleared] = useState(Boolean(initial?.cleared));

  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([
    { categoryId: null, amount: '', notes: '' },
    { categoryId: null, amount: '', notes: '' },
  ]);

  const isTransfer = categoryId?.startsWith('transfer:');
  const isEditingParent = initial?.isParent === 1;

  function getTotalCents() {
    const inflowCents = parseCents(inflow);
    return inflowCents > 0 ? inflowCents : -parseCents(outflow);
  }

  function handleSave() {
    const amount = getTotalCents();

    if (splitMode) {
      const splitItems: SplitItem[] = splits
        .filter(s => parseCents(s.amount) > 0)
        .map(s => ({
          categoryId: s.categoryId,
          amount: amount < 0 ? -parseCents(s.amount) : parseCents(s.amount),
          notes: s.notes || null,
        }));

      if (splitItems.length < 2) return;

      onSave({
        accountId, date,
        payeeId: payee.id,
        payeeName: payee.name || null,
        categoryId: null,
        notes: notes || null,
        amount,
        cleared: cleared ? 1 : 0,
        splits: splitItems,
      });
      return;
    }

    onSave({
      accountId, date,
      payeeId: payee.id,
      payeeName: payee.name || null,
      categoryId: isTransfer ? categoryId : categoryId,
      notes: notes || null,
      amount,
      cleared: cleared ? 1 : 0,
    });
  }

  function updateSplit(idx: number, field: keyof SplitRow, value: string | null) {
    setSplits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addSplitRow() {
    setSplits(prev => [...prev, { categoryId: null, amount: '', notes: '' }]);
  }

  function removeSplitRow(idx: number) {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }

  const splitTotal = splits.reduce((sum, s) => sum + parseCents(s.amount), 0);
  const totalCents = Math.abs(getTotalCents());
  const splitRemaining = totalCents - splitTotal;

  const inputCls = 'block w-full bg-transparent text-sm text-text placeholder-text-disabled focus:outline-none';
  const colCount = showAccountCol ? 9 : 8;

  return (
    <>
      <tr className="bg-brand-50 border-b border-brand-100">
        {showAccountCol && <td className="px-3 py-2 text-xs text-text-tertiary italic">—</td>}
        <td className="px-3 py-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} text-xs`} />
        </td>
        <td className="px-3 py-2">
          <PayeeCombobox value={payee} onChange={setPayee} payees={payees} />
        </td>
        <td className="px-3 py-2">
          {splitMode ? (
            <span className="text-xs text-brand-600 font-medium">Split</span>
          ) : (
            <CategorySelect value={categoryId} onChange={setCategoryId} groups={groups} accounts={accounts} currentAccountId={accountId} />
          )}
        </td>
        <td className="px-3 py-2">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={inputCls} />
        </td>
        <td className="px-3 py-2">
          <input
            type="number" value={outflow} onChange={(e) => setOutflow(e.target.value)}
            onFocus={() => setInflow('')} placeholder="0.00" min="0" step="0.01"
            className={`${inputCls} text-right tabular-nums`}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number" value={inflow} onChange={(e) => setInflow(e.target.value)}
            onFocus={() => setOutflow('')} placeholder="0.00" min="0" step="0.01"
            className={`${inputCls} text-right tabular-nums`}
          />
        </td>
        <td className="px-3 py-2 text-center">
          <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} className="w-4 h-4 accent-brand-600" />
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 rounded text-brand-600 hover:text-brand-700"><Check size={14} /></button>
            {!isEditingParent && !isTransfer && (
              <button
                onClick={() => setSplitMode(!splitMode)}
                className={`p-1 rounded ${splitMode ? 'text-brand-600' : 'text-text-tertiary hover:text-text-secondary'}`}
                title="Split transaction"
              >
                <Split size={14} />
              </button>
            )}
            <button onClick={onCancel} className="p-1 rounded text-text-tertiary hover:text-text-secondary"><X size={14} /></button>
          </div>
        </td>
      </tr>
      {splitMode && splits.map((s, i) => (
        <tr key={i} className="bg-brand-50/60 border-b border-brand-50">
          {showAccountCol && <td />}
          <td />
          <td />
          <td className="px-3 py-1.5">
            <CategorySelect value={s.categoryId} onChange={(v) => updateSplit(i, 'categoryId', v)} groups={groups} className="text-xs" />
          </td>
          <td className="px-3 py-1.5">
            <input type="text" value={s.notes} onChange={(e) => updateSplit(i, 'notes', e.target.value)} placeholder="Notes" className={`${inputCls} text-xs`} />
          </td>
          <td className="px-3 py-1.5" colSpan={2}>
            <input
              type="number" value={s.amount} onChange={(e) => updateSplit(i, 'amount', e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              className={`${inputCls} text-right tabular-nums text-xs`}
            />
          </td>
          <td />
          <td className="px-3 py-1.5">
            {splits.length > 2 && (
              <button onClick={() => removeSplitRow(i)} className="p-0.5 rounded text-text-tertiary hover:text-negative">
                <Trash2 size={12} />
              </button>
            )}
          </td>
        </tr>
      ))}
      {splitMode && (
        <tr className="bg-brand-50/40 border-b border-brand-100">
          {showAccountCol && <td />}
          <td />
          <td />
          <td className="px-3 py-1.5">
            <button onClick={addSplitRow} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
              <Plus size={12} /> Add split
            </button>
          </td>
          <td />
          <td colSpan={2} className="px-3 py-1.5 text-right">
            <span className={`text-xs tabular-nums ${splitRemaining === 0 ? 'text-positive' : 'text-negative'}`}>
              {splitRemaining === 0 ? 'Balanced' : `${formatCurrency(splitRemaining)} remaining`}
            </span>
          </td>
          <td />
          <td />
        </tr>
      )}
    </>
  );
}
