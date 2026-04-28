import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useUpdateAccount, useCloseAccount } from '../../hooks/useAccounts';
import { ACCOUNT_TYPES, type Account, type AccountType } from '../../types';

interface Props {
  account: Account | null;
  onClose: () => void;
}

export function EditAccountModal({ account, onClose }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [startingBalance, setStartingBalance] = useState(0);
  const [isOffBudget, setIsOffBudget] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const updateAccount = useUpdateAccount();
  const closeAccount = useCloseAccount();

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setStartingBalance(account.startingBalance);
      setIsOffBudget(account.isOffBudget === 1);
    }
  }, [account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !name.trim()) return;
    await updateAccount.mutateAsync({
      id: account.id,
      data: { name: name.trim(), type, startingBalance, isOffBudget: isOffBudget ? 1 : 0 },
    });
    onClose();
  }

  async function handleCloseAccount() {
    if (!account) return;
    await closeAccount.mutateAsync(account.id);
    onClose();
  }

  return (
    <>
      <Modal isOpen={!!account} onClose={onClose} title="Edit Account" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starting Balance</label>
            <CurrencyInput value={startingBalance} onChange={setStartingBalance} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isOffBudget}
              onChange={(e) => setIsOffBudget(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Off budget (excluded from budgeting)</span>
          </label>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Close Account
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || updateAccount.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateAccount.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleCloseAccount}
        title="Close Account"
        message={`Are you sure you want to close "${account?.name}"? It will be hidden from your accounts list.`}
        confirmLabel="Close Account"
        danger
      />
    </>
  );
}
