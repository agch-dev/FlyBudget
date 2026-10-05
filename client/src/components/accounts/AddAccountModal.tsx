import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useCreateAccount } from '../../hooks/useAccounts';
import { HOME_CURRENCY, type AccountType, type Currency } from '../../types';
import { accountTypeInfo } from '../../utils/accountTypes';
import { AccountTypeSelect } from './AccountTypeSelect';
import { CurrencySelect } from './CurrencySelect';
import { AccountGroupField } from './AccountGroupField';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAccountModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation('accounts');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState<Currency>(HOME_CURRENCY);
  const [amount, setAmount] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [isOffBudget, setIsOffBudget] = useState(false);
  const canSave = useCanSave();
  const createAccount = useCreateAccount();
  const info = accountTypeInfo(type);

  function handleClose() {
    setName('');
    setType('checking');
    setCurrency(HOME_CURRENCY);
    setAmount(0);
    setGroupName('');
    setIsOffBudget(false);
    onClose();
  }

  function handleTypeChange(next: AccountType) {
    setType(next);
    setIsOffBudget(!accountTypeInfo(next).onBudget);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createAccount.mutateAsync({
      name: name.trim(),
      type,
      currency,
      groupName: groupName.trim() || null,
      // Debts are entered as the amount owed and stored as a negative balance
      startingBalance: info.liability ? -Math.abs(amount) : amount,
      isOffBudget: isOffBudget ? 1 : 0,
    });
    handleClose();
  }

  const amountLabel = info.liability
    ? t('form.amountOwed')
    : info.group === 'property'
      ? t('form.currentValue')
      : t('form.currentBalance');
  const amountHint = info.liability
    ? t('form.amountOwedHint')
    : info.group === 'property'
      ? t('form.currentValueHint')
      : t('form.currentBalanceHint');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('form.addTitle')} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t('form.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t('form.nameLabel')}
            placeholder={
              info.group === 'property'
                ? t('form.namePlaceholderProperty')
                : t('form.namePlaceholder')
            }
            autoFocus
            className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface text-text placeholder-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <AccountTypeSelect value={type} onChange={handleTypeChange} />

        <CurrencySelect value={currency} onChange={setCurrency} />

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {amountLabel}
          </label>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            aria-label={amountLabel}
            allowNegative={!info.liability}
            currency={currency}
          />
          <p className="mt-1 text-xs text-text-secondary">{amountHint}</p>
        </div>

        <AccountGroupField value={groupName} onChange={setGroupName} />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isOffBudget}
            onChange={(e) => setIsOffBudget(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-text-secondary">
            {t('form.offBudget')}
            <span className="block text-xs text-text-tertiary">{t('form.offBudgetHint')}</span>
          </span>
        </label>

        <SavingPausedHint className="text-right" />
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-hover transition-colors"
          >
            {t('ui.cancel', { ns: 'common' })}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || createAccount.isPending || !canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createAccount.isPending ? t('form.adding') : t('form.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
