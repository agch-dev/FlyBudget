import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { format } from 'date-fns';
import { FREQUENCY_LABELS, type RecurringTransaction, type RecurringFrequency } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  editItem?: RecurringTransaction | null;
}

export default function RecurringFormModal({ isOpen, onClose, onSave, editItem }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: groups = [] } = useCategories();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [isExpense, setIsExpense] = useState(true);
  const [isApproximate, setIsApproximate] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [autoCreate, setAutoCreate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setTitle(editItem.title);
        setAmount(Math.abs(editItem.amount));
        setIsExpense(editItem.amount < 0);
        setIsApproximate(Boolean(editItem.isApproximate));
        setFrequency(editItem.frequency);
        setStartDate(editItem.startDate);
        setEndDate(editItem.endDate || '');
        setAccountId(editItem.accountId || '');
        setCategoryId(editItem.categoryId || '');
        setNotes(editItem.notes || '');
        setAutoCreate(Boolean(editItem.autoCreate));
      } else {
        setTitle('');
        setAmount(0);
        setIsExpense(true);
        setIsApproximate(false);
        setFrequency('monthly');
        setStartDate(format(new Date(), 'yyyy-MM-dd'));
        setEndDate('');
        setAccountId(accounts.length > 0 ? accounts[0].id : '');
        setCategoryId('');
        setNotes('');
        setAutoCreate(false);
      }
    }
  }, [isOpen, editItem, accounts]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const signedAmount = isExpense ? -Math.abs(amount) : Math.abs(amount);
    onSave({
      title,
      amount: signedAmount,
      isApproximate: isApproximate ? 1 : 0,
      frequency,
      startDate,
      endDate: endDate || null,
      accountId: accountId || null,
      categoryId: categoryId || null,
      notes: notes || null,
      autoCreate: autoCreate ? 1 : 0,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editItem ? 'Edit Recurring' : 'Add Recurring'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Netflix, Rent, Paycheck…"
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setIsExpense(true)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  isExpense ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setIsExpense(false)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  !isExpense ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                Income
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {FREQUENCY_LABELS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">No category</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isApproximate}
              onChange={(e) => setIsApproximate(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Amount varies</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreate}
              onChange={(e) => setAutoCreate(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto-create transactions</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title || amount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {editItem ? 'Save Changes' : 'Add Recurring'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
