import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { PayeeCombobox } from './PayeeCombobox';
import { CategorySelect } from './CategorySelect';
import type { CategoryGroup, Payee, Transaction } from '../../types';
import type { CreateTransactionData } from '../../api/transactions';
import { parseCents, centsToInput } from '../../utils/currency';

interface Props {
  initial?: Transaction;
  accountId: string;
  groups: CategoryGroup[];
  payees: Payee[];
  onSave: (data: CreateTransactionData) => void;
  onCancel: () => void;
  showAccountCol?: boolean;
}

export function TransactionFormRow({ initial, accountId, groups, payees, onSave, onCancel, showAccountCol }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initial?.date ?? today);
  const [payee, setPayee] = useState({ id: initial?.payeeId ?? null, name: initial?.payeeName ?? '' });
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [outflow, setOutflow] = useState(initial?.amount !== undefined && initial.amount < 0 ? centsToInput(initial.amount) : '');
  const [inflow, setInflow] = useState(initial?.amount !== undefined && initial.amount > 0 ? centsToInput(initial.amount) : '');
  const [cleared, setCleared] = useState(Boolean(initial?.cleared));

  function handleSave() {
    const inflowCents = parseCents(inflow);
    onSave({
      accountId,
      date,
      payeeId: payee.id,
      payeeName: payee.name || null,
      categoryId,
      notes: notes || null,
      amount: inflowCents > 0 ? inflowCents : -parseCents(outflow),
      cleared: cleared ? 1 : 0,
    });
  }

  const inputCls = 'block w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none';

  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      {showAccountCol && <td className="px-3 py-2 text-xs text-gray-400 italic">—</td>}
      <td className="px-3 py-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} text-xs`} />
      </td>
      <td className="px-3 py-2">
        <PayeeCombobox value={payee} onChange={setPayee} payees={payees} />
      </td>
      <td className="px-3 py-2">
        <CategorySelect value={categoryId} onChange={setCategoryId} groups={groups} />
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
        <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} className="w-4 h-4 accent-blue-600" />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleSave} className="p-1 rounded text-blue-600 hover:text-blue-800"><Check size={14} /></button>
          <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      </td>
    </tr>
  );
}
