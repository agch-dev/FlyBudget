import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormReset } from '../../hooks/useFormReset';
import { Modal } from '../ui/Modal';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useUpdateAccount, useCloseAccount } from '../../hooks/useAccounts';
import { HOME_CURRENCY, type Account, type AccountType, type Currency } from '../../types';
import { AccountIcon } from './AccountIcon';
import { AccountTypeSelect } from './AccountTypeSelect';
import { CurrencySelect } from './CurrencySelect';
import { AccountGroupField } from './AccountGroupField';
import { fileToSquareDataUrl } from '../../utils/imageResize';
import { usePreferencesStore } from '../../store/preferencesStore';

/** An account from a copy saved before `currencyLockedBy` existed only says `hasTransactions` */
function currencyLock(account: Account | null): Account['currencyLockedBy'] {
  if (!account) return 'transactions';
  if (account.currencyLockedBy !== undefined) return account.currencyLockedBy;
  return account.hasTransactions === false ? null : 'transactions';
}

interface Props {
  account: Account | null;
  onClose: () => void;
}

export function EditAccountModal({ account, onClose }: Props) {
  const { t } = useTranslation('accounts');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState<Currency>(HOME_CURRENCY);
  const [startingBalance, setStartingBalance] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [isOffBudget, setIsOffBudget] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const canSave = useCanSave();
  const lock = currencyLock(account);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const showAccountIcons = usePreferencesStore((s) => s.showAccountIcons);

  const updateAccount = useUpdateAccount();
  const closeAccount = useCloseAccount();

  // Filled once per opening, not on every refetch of the account (that would undo edits)
  useFormReset(account?.id ?? null, () => {
    if (!account) return;
    setName(account.name);
    setType(account.type);
    setCurrency(account.currency);
    setStartingBalance(account.startingBalance);
    setGroupName(account.groupName ?? '');
    setIsOffBudget(account.isOffBudget === 1);
    setLogo(account.logo ?? null);
    setLogoError(false);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !name.trim()) return;
    const group = groupName.trim() || null;
    await updateAccount.mutateAsync({
      id: account.id,
      data: {
        name: name.trim(),
        type,
        startingBalance,
        isOffBudget: isOffBudget ? 1 : 0,
        // Only when chosen anew: the server refuses a change once something depends on it
        ...(currency !== account.currency ? { currency } : {}),
        ...(logo !== (account.logo ?? null) ? { logo } : {}),
        ...(group !== (account.groupName ?? null) ? { groupName: group } : {}),
      },
    });
    onClose();
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      setLogo(await fileToSquareDataUrl(file));
      setLogoError(false);
    } catch {
      setLogoError(true);
    }
  }

  async function handleCloseAccount() {
    if (!account) return;
    await closeAccount.mutateAsync(account.id);
    onClose();
  }

  return (
    <>
      <Modal isOpen={!!account} onClose={onClose} title={t('form.editTitle')} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('form.logo')}
            </label>
            <div className="flex items-center gap-3">
              <AccountIcon name={name} type={type} logo={logo} size="lg" force />
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-md hover:bg-hover transition-colors cursor-pointer"
                  >
                    {logo ? t('form.logoChange') : t('form.logoUpload')}
                  </button>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo(null)}
                      className="px-3 py-1.5 text-xs font-medium text-text-tertiary hover:text-negative transition-colors cursor-pointer"
                    >
                      {t('form.logoUseInitials')}
                    </button>
                  )}
                </div>
                <p className={`text-xs ${logoError ? 'text-negative' : 'text-text-tertiary'}`}>
                  {logoError
                    ? t('form.logoError')
                    : logo
                      ? t('form.logoCropped')
                      : t('form.logoInitials')}
                </p>
                {!showAccountIcons && <p className="text-xs text-caution">{t('form.iconsOff')}</p>}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFile}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('form.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t('form.nameLabel')}
              autoFocus
              className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface text-text focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <AccountTypeSelect value={type} onChange={setType} />

          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            locked={lock != null}
            lockedHint={
              lock === 'recurring' || lock === 'goal'
                ? t(`form.currencyLockedBy.${lock}`)
                : undefined
            }
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('form.startingBalance')}
            </label>
            <CurrencyInput
              value={startingBalance}
              onChange={setStartingBalance}
              allowNegative
              currency={currency}
              aria-label={t('form.startingBalanceLabel')}
            />
          </div>

          <AccountGroupField value={groupName} onChange={setGroupName} />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isOffBudget}
              onChange={(e) => setIsOffBudget(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-text-secondary">{t('form.offBudgetExcluded')}</span>
          </label>

          <SavingPausedHint className="text-right" />
          <div className="flex items-center justify-between pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="text-sm text-negative hover:underline font-medium transition-colors"
            >
              {t('form.close')}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border rounded-lg hover:bg-hover transition-colors"
              >
                {t('ui.cancel', { ns: 'common' })}
              </button>
              <button
                type="submit"
                disabled={!name.trim() || updateAccount.isPending || !canSave}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateAccount.isPending ? t('form.saving') : t('form.save')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleCloseAccount}
        title={t('form.close')}
        message={t('form.closeMessage', { name: account?.name ?? '' })}
        confirmLabel={t('form.close')}
        danger
      />
    </>
  );
}
