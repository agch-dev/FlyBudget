import { useState } from 'react';
import { Loader2, CheckCircle2, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PlaidLinkButton } from './PlaidLinkButton';
import { useCreateLinkToken, useExchangePublicToken, useMapAccounts, useSyncItem } from '../../hooks/usePlaid';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { PlaidDiscoveredAccount, PlaidExchangeResult, AccountType, Account } from '../../types';
import type { AccountMappingAction } from '../../api/plaid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'link' | 'mapping' | 'syncing' | 'done';

interface MappingChoice {
  plaidAccountId: string;
  action: 'create' | 'link' | 'skip';
  accountId?: string;
  accountName: string;
  accountType: AccountType;
}

export function ConnectBankModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>('link');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchangeResult, setExchangeResult] = useState<PlaidExchangeResult | null>(null);
  const [mappings, setMappings] = useState<MappingChoice[]>([]);
  const [syncSummary, setSyncSummary] = useState<{ added: number; accounts: number } | null>(null);

  const createLinkToken = useCreateLinkToken();
  const exchangeToken = useExchangePublicToken();
  const mapAccounts = useMapAccounts();
  const syncItem = useSyncItem();
  const { data: existingAccounts = [] } = useAccounts();

  const linkedAccountIds = new Set(
    mappings.filter(m => m.action === 'link').map(m => m.accountId)
  );

  async function handleOpen() {
    try {
      const { linkToken: token } = await createLinkToken.mutateAsync();
      setLinkToken(token);
    } catch {
      // Error handled by mutation state
    }
  }

  async function handlePlaidSuccess(publicToken: string, metadata: any) {
    try {
      const result = await exchangeToken.mutateAsync({
        publicToken,
        institutionId: metadata.institution?.institution_id ?? '',
        institutionName: metadata.institution?.name ?? 'Unknown Institution',
      });

      setExchangeResult(result);
      setMappings(
        result.accounts.map((a: PlaidDiscoveredAccount) => ({
          plaidAccountId: a.plaidAccountId,
          action: 'create' as const,
          accountName: a.name,
          accountType: a.suggestedType,
        }))
      );
      setStep('mapping');
    } catch {
      // Error handled by mutation state
    }
  }

  function updateMapping(plaidAccountId: string, updates: Partial<MappingChoice>) {
    setMappings(prev =>
      prev.map(m =>
        m.plaidAccountId === plaidAccountId ? { ...m, ...updates } : m
      )
    );
  }

  async function handleSaveAndSync() {
    if (!exchangeResult) return;

    const actions: AccountMappingAction[] = mappings.map(m => ({
      plaidAccountId: m.plaidAccountId,
      action: m.action,
      accountId: m.action === 'link' ? m.accountId : undefined,
      accountName: m.action === 'create' ? m.accountName : undefined,
      accountType: m.action === 'create' ? m.accountType : undefined,
    }));

    setStep('syncing');

    try {
      await mapAccounts.mutateAsync({ itemId: exchangeResult.itemId, mappings: actions });
      const syncResult = await syncItem.mutateAsync(exchangeResult.itemId);
      const activeCount = mappings.filter(m => m.action !== 'skip').length;
      setSyncSummary({ added: syncResult.added, accounts: activeCount });
      setStep('done');
    } catch {
      setStep('done');
      setSyncSummary({ added: 0, accounts: 0 });
    }
  }

  function handleClose() {
    setStep('link');
    setLinkToken(null);
    setExchangeResult(null);
    setMappings([]);
    setSyncSummary(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect Bank Account" size="lg">
      {step === 'link' && (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Building2 size={32} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Connect Your Financial Institution</h3>
            <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
              Securely link your bank accounts to automatically import transactions
              and keep your balances up to date.
            </p>
          </div>

          {!linkToken ? (
            <div className="flex justify-center">
              <button
                onClick={handleOpen}
                disabled={createLinkToken.isPending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createLinkToken.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Preparing...</>
                ) : (
                  <><Building2 size={16} /> Connect Bank</>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <PlaidLinkButton linkToken={linkToken} onSuccess={handlePlaidSuccess} />
            </div>
          )}

          {(createLinkToken.isError || exchangeToken.isError) && (
            <p className="text-xs text-red-500 text-center">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      )}

      {step === 'mapping' && exchangeResult && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {exchangeResult.institutionName}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose how to set up each discovered account.
            </p>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {exchangeResult.accounts.map(account => {
              const mapping = mappings.find(m => m.plaidAccountId === account.plaidAccountId)!;
              return (
                <AccountMappingCard
                  key={account.plaidAccountId}
                  account={account}
                  mapping={mapping}
                  existingAccounts={existingAccounts}
                  linkedAccountIds={linkedAccountIds}
                  onChange={updates => updateMapping(account.plaidAccountId, updates)}
                />
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndSync}
              disabled={mappings.every(m => m.action === 'skip')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Save & Sync
            </button>
          </div>
        </div>
      )}

      {step === 'syncing' && (
        <div className="text-center py-10">
          <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">Syncing Transactions</h3>
          <p className="text-xs text-gray-500 mt-1">
            Importing your transactions. This may take a moment...
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Connection Complete</h3>
          {syncSummary && (
            <p className="text-xs text-gray-500 mt-1">
              Imported {syncSummary.added} transaction{syncSummary.added !== 1 ? 's' : ''} across{' '}
              {syncSummary.accounts} account{syncSummary.accounts !== 1 ? 's' : ''}.
            </p>
          )}
          <button
            onClick={handleClose}
            className="mt-6 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

interface AccountMappingCardProps {
  account: PlaidDiscoveredAccount;
  mapping: MappingChoice;
  existingAccounts: Account[];
  linkedAccountIds: Set<string | undefined>;
  onChange: (updates: Partial<MappingChoice>) => void;
}

function AccountMappingCard({ account, mapping, existingAccounts, linkedAccountIds, onChange }: AccountMappingCardProps) {
  const availableAccounts = existingAccounts.filter(
    a => !a.closedAt && (!linkedAccountIds.has(a.id) || mapping.accountId === a.id)
  );

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-900">{account.name}</span>
          {account.mask && (
            <span className="text-xs text-gray-400 ml-2">****{account.mask}</span>
          )}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {formatCurrency(account.currentBalance)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 capitalize">{account.type}{account.subtype ? ` · ${account.subtype}` : ''}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onChange({ action: 'create', accountName: account.name, accountType: account.suggestedType })}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            mapping.action === 'create'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Create New
        </button>
        <button
          onClick={() => onChange({ action: 'link' })}
          disabled={availableAccounts.length === 0}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            mapping.action === 'link'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          Link Existing
        </button>
        <button
          onClick={() => onChange({ action: 'skip' })}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            mapping.action === 'skip'
              ? 'bg-gray-500 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Skip
        </button>
      </div>

      {mapping.action === 'link' && (
        <select
          value={mapping.accountId ?? ''}
          onChange={e => onChange({ accountId: e.target.value })}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="">Select an account...</option>
          {availableAccounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatCurrency(a.balance)})
            </option>
          ))}
        </select>
      )}

      {mapping.action === 'create' && (
        <input
          type="text"
          value={mapping.accountName}
          onChange={e => onChange({ accountName: e.target.value })}
          placeholder="Account name"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        />
      )}
    </div>
  );
}
