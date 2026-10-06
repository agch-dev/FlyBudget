import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isValid as isValidDate, parseISO } from 'date-fns';
import { MinusCircle, PlusCircle, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SavedOnDeviceHint } from '../connection/SavingPausedHint';
import { CurrencyInput } from '../ui/CurrencyInput';
import { currencySymbol, formatCurrency, impliedRate } from '../../utils/currency';
import { useAccounts } from '../../hooks/useAccounts';
import { useAddTransaction } from '../../hooks/useOffline';
import { MerchantSelect } from './MerchantSelect';
import { CategorySelectButton } from './CategorySelectButton';
import { AccountIcon } from '../accounts/AccountIcon';
import { TransferRate } from './TransferRate';
import type { Account } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'block w-full rounded-md border border-border px-3 py-2 text-sm text-text bg-surface placeholder-text-disabled focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

export function AddTransactionModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation('transactions');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState(0);
  /** The other account's side of a transfer between currencies, in that account's currency */
  const [otherAmount, setOtherAmount] = useState(0);
  const [payeeName, setPayeeName] = useState('');
  const [payeeId, setPayeeId] = useState<string | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [notes, setNotes] = useState('');

  const accountRef = useRef<HTMLDivElement>(null);

  const { data: accounts = [] } = useAccounts();
  const newTx = useAddTransaction();

  const openAccounts = accounts.filter((a) => !a.closedAt);
  const onBudgetAccounts = openAccounts.filter((a) => !a.isOffBudget);
  const offBudgetAccounts = openAccounts.filter((a) => a.isOffBudget);
  const selectedAccount = openAccounts.find((a) => a.id === accountId);
  // Once an account is chosen, the category list also offers a transfer to any other account
  const transferAccounts = accountId ? openAccounts.filter((a) => a.id !== accountId) : [];
  const transferToId = categoryId?.startsWith('transfer:')
    ? categoryId.slice('transfer:'.length)
    : null;

  // A transfer between a pesos and a dollars account has two amounts: what leaves one and
  // what arrives in the other, each as its own statement shows it
  const transferTo = transferToId ? openAccounts.find((a) => a.id === transferToId) : undefined;
  const otherCurrency =
    transferTo && selectedAccount && transferTo.currency !== selectedAccount.currency
      ? transferTo.currency
      : null;
  // A debit moves money out of this account, a credit brings it in
  const leavesHere = type === 'debit';
  const sideLabel = (leaving: boolean, account: Account) =>
    t(leaving ? 'form.amountLeavingAccount' : 'form.amountArrivingAccount', {
      account: account.name,
      symbol: currencySymbol(account.currency),
    });
  const sideName = (leaving: boolean, account: Account) =>
    t(leaving ? 'form.amountLeaving' : 'form.amountArriving', {
      symbol: currencySymbol(account.currency),
    });

  const hasConfirmedMerchant = payeeId !== null;
  const dateValid = date !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidDate(parseISO(date));
  const isValid =
    amount > 0 &&
    (otherCurrency === null || otherAmount > 0) &&
    (hasConfirmedMerchant || transferToId !== null) &&
    dateValid &&
    accountId !== '';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setType('debit');
      setAmount(0);
      setOtherAmount(0);
      setPayeeName('');
      setPayeeId(null);
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setAccountId('');
      setShowAccountPicker(false);
      setCategoryId(null);
      setNotes('');
    }
  }, [isOpen]);

  function chooseAccount(id: string) {
    setAccountId(id);
    setShowAccountPicker(false);
    // A transfer to the account just chosen would go nowhere
    if (categoryId === `transfer:${id}`) setCategoryId(null);
  }

  function handleSubmit() {
    if (!isValid) return;
    if (transferToId) {
      const out = leavesHere;
      newTx.add(
        {
          kind: 'transfer',
          data: {
            fromAccountId: out ? accountId : transferToId,
            toAccountId: out ? transferToId : accountId,
            date,
            ...(otherCurrency === null
              ? { amount }
              : { amount: out ? amount : otherAmount, toAmount: out ? otherAmount : amount }),
            notes: notes || null,
          },
        },
        onClose,
      );
      return;
    }
    const finalAmount = type === 'debit' ? -amount : amount;
    newTx.add(
      {
        kind: 'transaction',
        data: {
          accountId,
          date,
          amount: finalAmount,
          payeeId,
          payeeName,
          categoryId,
          notes: notes || null,
        },
      },
      onClose,
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('add.title')} size="md">
      <div className="space-y-5">
        {/* Debit / Credit toggle */}
        <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
          <button
            type="button"
            onClick={() => setType('debit')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              type === 'debit'
                ? 'bg-negative-subtle text-negative ring-1 ring-negative/20'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-hover'
            }`}
          >
            <MinusCircle size={15} />
            {t('add.debit')}
          </button>
          <button
            type="button"
            onClick={() => setType('credit')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              type === 'credit'
                ? 'bg-positive-subtle text-positive ring-1 ring-positive/20'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-hover'
            }`}
          >
            <PlusCircle size={15} />
            {t('add.credit')}
          </button>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {otherCurrency && selectedAccount
              ? sideLabel(leavesHere, selectedAccount)
              : t('field.amount')}{' '}
            *
          </label>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            onTyping={otherCurrency ? setAmount : undefined}
            placeholder={`${currencySymbol(selectedAccount?.currency)}0.00`}
            currency={selectedAccount?.currency}
            aria-label={
              otherCurrency && selectedAccount
                ? sideName(leavesHere, selectedAccount)
                : t('field.amount')
            }
          />
        </div>

        {otherCurrency && transferTo && selectedAccount && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {sideLabel(!leavesHere, transferTo)} *
            </label>
            <CurrencyInput
              value={otherAmount}
              onChange={setOtherAmount}
              onTyping={setOtherAmount}
              placeholder={`${currencySymbol(otherCurrency)}0.00`}
              currency={otherCurrency}
              aria-label={sideName(!leavesHere, transferTo)}
            />
            <TransferRate
              className="mt-1.5"
              rate={impliedRate(
                { amount, currency: selectedAccount.currency },
                { amount: otherAmount, currency: otherCurrency },
              )}
            />
          </div>
        )}

        {/* Merchant (a transfer has none: it's named after the other account) */}
        {!transferToId && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('field.merchant')} *
            </label>
            <MerchantSelect
              value={{ id: payeeId, name: payeeName }}
              onChange={(v) => {
                setPayeeId(v.id);
                setPayeeName(v.name);
              }}
            />
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('field.date')} *</label>
          <input
            type="date"
            aria-label={t('field.date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('field.account')} *</label>
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAccountPicker(!showAccountPicker)}
              className={`${inputClass} text-left flex items-center justify-between cursor-pointer`}
            >
              <span className="flex items-center gap-2 truncate">
                {selectedAccount ? (
                  <>
                    <AccountIcon
                      name={selectedAccount.name}
                      type={selectedAccount.type}
                      logo={selectedAccount.logo}
                    />
                    <span className="text-text">{selectedAccount.name}</span>
                  </>
                ) : (
                  <span className="text-text-disabled">{t('add.selectAccount')}</span>
                )}
              </span>
              <ChevronDown size={14} className="text-text-tertiary shrink-0" />
            </button>
            {showAccountPicker && (
              <div
                className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto origin-top animate-menu-in"
                onClick={(e) => e.stopPropagation()}
              >
                {onBudgetAccounts.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-text-tertiary bg-surface-alt">
                      {t('add.onBudget')}
                    </div>
                    {onBudgetAccounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          chooseAccount(a.id);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-hover cursor-pointer ${
                          accountId === a.id ? 'bg-brand-50 text-brand-700' : 'text-text'
                        }`}
                      >
                        <AccountIcon name={a.name} type={a.type} logo={a.logo} />
                        <span className="truncate flex-1">{a.name}</span>
                        <span
                          className={`text-xs tabular-nums shrink-0 ${a.balance >= 0 ? 'text-text-tertiary' : 'text-negative'}`}
                        >
                          {formatCurrency(a.balance, a.currency)}
                        </span>
                      </button>
                    ))}
                  </>
                )}
                {offBudgetAccounts.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-text-tertiary bg-surface-alt">
                      {t('add.offBudget')}
                    </div>
                    {offBudgetAccounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          chooseAccount(a.id);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-hover cursor-pointer ${
                          accountId === a.id ? 'bg-brand-50 text-brand-700' : 'text-text'
                        }`}
                      >
                        <AccountIcon name={a.name} type={a.type} logo={a.logo} />
                        <span className="truncate flex-1">{a.name}</span>
                        <span
                          className={`text-xs tabular-nums shrink-0 ${a.balance >= 0 ? 'text-text-tertiary' : 'text-negative'}`}
                        >
                          {formatCurrency(a.balance, a.currency)}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('field.category')}</label>
          <CategorySelectButton
            value={categoryId}
            onChange={setCategoryId}
            position="above"
            transferAccounts={transferAccounts}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('field.notes')}</label>
          <input
            type="text"
            aria-label={t('field.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('add.notesPlaceholder')}
            className={inputClass}
          />
        </div>

        {/* Footer */}
        <SavedOnDeviceHint className="text-right" />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          <Button
            size="md"
            onClick={handleSubmit}
            disabled={!isValid || newTx.pending || !newTx.allowed}
          >
            {newTx.pending
              ? t('add.adding')
              : newTx.onDevice
                ? t('form.saveOnDevice')
                : t('add.title')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
