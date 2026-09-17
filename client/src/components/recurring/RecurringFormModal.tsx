import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Input';
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
          <label className="block text-sm font-medium text-text-secondary mb-1">Title</label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Netflix, Rent, Paycheck…"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Amount</label>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Type</label>
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setIsExpense(true)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  isExpense ? 'bg-negative-subtle text-negative ring-1 ring-negative/20' : 'text-text-tertiary hover:bg-hover'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setIsExpense(false)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  !isExpense ? 'bg-positive-subtle text-positive ring-1 ring-positive/20' : 'text-text-tertiary hover:bg-hover'
                }`}
              >
                Income
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Frequency</label>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
            >
              {FREQUENCY_LABELS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Account</label>
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">End Date <span className="text-text-tertiary font-normal">(optional)</span></label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">No category</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Notes <span className="text-text-tertiary font-normal">(optional)</span></label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
          />
        </div>

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isApproximate}
              onChange={(e) => setIsApproximate(e.target.checked)}
              className="rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-text-secondary">Amount varies</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreate}
              onChange={(e) => setAutoCreate(e.target.checked)}
              className="rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-text-secondary">Auto-create transactions</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-surface-alt transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title || amount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {editItem ? 'Save Changes' : 'Add Recurring'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
