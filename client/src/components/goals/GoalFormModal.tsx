import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CurrencySelect } from '../accounts/CurrencySelect';
import { useAccounts } from '../../hooks/useAccounts';
import { useFormReset } from '../../hooks/useFormReset';
import { formatCurrency } from '../../utils/currency';
import { formCurrency, targetNeedsConfirming } from '../../utils/goals';
import { CURRENCIES, HOME_CURRENCY, type Currency, type Goal } from '../../types';

const ICONS = ['🎯', '🏠', '✈️', '🚗', '💰', '🎓', '💍', '🏖️', '📱', '🛡️', '🎁', '⭐'];
const COLORS = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#4F46E5',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string | null;
    accountId: string | null;
    currency: Currency;
    icon: string;
    color: string;
  }) => void;
  editGoal?: Goal | null;
}

export function GoalFormModal({ isOpen, onClose, onSave, editGoal }: Props) {
  const { data: accounts = [] } = useAccounts();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  // What the user picked; a linked account overrides it (see `formCurrency`)
  const [chosenCurrency, setChosenCurrency] = useState<Currency>(HOME_CURRENCY);
  // Saving is waiting for the user to confirm the target in its new currency
  const [confirming, setConfirming] = useState(false);
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#2563EB');

  // Once per opening: the goal refetches in the background and must not wipe what was typed
  useFormReset(isOpen ? (editGoal?.id ?? 'new') : null, () => {
    setName(editGoal?.name ?? '');
    setTargetAmount(editGoal?.targetAmount ?? 0);
    setCurrentAmount(editGoal?.currentAmount ?? 0);
    setTargetDate(editGoal?.targetDate ?? '');
    setAccountId(editGoal?.accountId ?? '');
    setChosenCurrency(editGoal?.currency ?? HOME_CURRENCY);
    setIcon(editGoal?.icon ?? '🎯');
    setColor(editGoal?.color ?? '#2563EB');
    setConfirming(false);
  });

  const { currency, locked } = formCurrency(accountId, accounts, chosenCurrency);
  const linkedAccount = accounts.find((a) => a.id === accountId);
  const currencyName = (c: Currency) =>
    CURRENCIES.find((x) => x.value === c)?.label.toLowerCase() ?? c;

  function changeAccount(id: string) {
    setAccountId(id);
    // The goal takes the account's currency, and keeps it if the account is unlinked again
    const account = accounts.find((a) => a.id === id);
    if (account) setChosenCurrency(account.currency);
  }

  function save() {
    onSave({
      name: name.trim(),
      targetAmount,
      currentAmount,
      targetDate: targetDate || null,
      accountId: accountId || null,
      currency,
      icon,
      color,
    });
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || targetAmount <= 0) return;
    if (targetNeedsConfirming(editGoal, { accountId, currency })) {
      setConfirming(true);
      return;
    }
    save();
  }

  if (confirming && editGoal) {
    const was = editGoal.currency ?? HOME_CURRENCY;
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Check the target" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {linkedAccount?.name ?? 'The linked account'} is in {currencyName(currency)}, so this
            goal changes from {currencyName(was)} to {currencyName(currency)}. Its amounts keep
            their numbers and are not converted.
          </p>
          <dl className="text-sm rounded-md border border-border-light divide-y divide-border-light">
            <div className="flex justify-between px-3 py-2">
              <dt className="text-text-secondary">Target</dt>
              <dd className="font-medium tabular-nums text-text">
                {formatCurrency(targetAmount, currency)}
              </dd>
            </div>
            <div className="flex justify-between px-3 py-2">
              <dt className="text-text-secondary">Saved so far</dt>
              <dd className="font-medium tabular-nums text-text">
                {formatCurrency(currentAmount, currency)}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-text-secondary">Is that the right target?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Change amounts
            </Button>
            <Button onClick={save}>Yes, save</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editGoal ? 'Edit Goal' : 'Add Goal'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Fund"
            aria-label="Name"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Target</label>
            <CurrencyInput
              value={targetAmount}
              onChange={setTargetAmount}
              currency={currency}
              className="w-full"
              aria-label="Target"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Saved so far</label>
            <CurrencyInput
              value={currentAmount}
              onChange={setCurrentAmount}
              currency={currency}
              className="w-full"
              aria-label="Saved so far"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Target date (optional)</label>
          <input
            type="date"
            aria-label="Target date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">
            Linked account (optional)
          </label>
          <select
            aria-label="Linked account"
            value={accountId}
            onChange={(e) => changeAccount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
          >
            <option value="">None</option>
            {accounts
              .filter((a) => !a.closedAt)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>

        <CurrencySelect
          value={currency}
          onChange={setChosenCurrency}
          locked={locked}
          lockedHint="A goal is in its linked account's currency."
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-pressed={icon === i}
                className={`w-9 h-9 text-lg rounded-md border transition-colors ${
                  icon === i ? 'border-brand-500 bg-brand-50' : 'border-border-light hover:bg-hover'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  color === c ? 'border-text scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || targetAmount <= 0}>
            {editGoal ? 'Save' : 'Add Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
