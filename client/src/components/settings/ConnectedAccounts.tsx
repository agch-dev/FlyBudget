import { useState } from 'react';
import { RefreshCw, Plus, Building2, Loader2 } from 'lucide-react';
import { usePlaidStatus, usePlaidItems, useSyncAll } from '../../hooks/usePlaid';
import { PlaidConfigForm } from '../plaid/PlaidConfigForm';
import { ConnectBankModal } from '../plaid/ConnectBankModal';
import { ConnectedInstitutionCard } from '../plaid/ConnectedInstitutionCard';

export function ConnectedAccounts() {
  const { data: status, isLoading: statusLoading } = usePlaidStatus();
  const { data: items = [], isLoading: itemsLoading } = usePlaidItems();
  const syncAll = useSyncAll();
  const [showConnect, setShowConnect] = useState(false);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!status?.configured) {
    return <PlaidConfigForm />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Connected Banks</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Automatically import transactions from your financial institutions.
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => syncAll.mutate()}
            disabled={syncAll.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {syncAll.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Syncing All...</>
            ) : (
              <><RefreshCw size={12} /> Sync All</>
            )}
          </button>
        )}
      </div>

      {syncAll.isSuccess && syncAll.data && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2">
          <p className="text-xs text-emerald-700">
            Sync complete:{' '}
            {syncAll.data.results.reduce((s, r) => s + r.added, 0)} new transactions imported.
          </p>
        </div>
      )}

      {itemsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-700">No Connected Banks</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Connect your first financial institution to start automatically importing transactions.
          </p>
          <button
            onClick={() => setShowConnect(true)}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus size={14} /> Connect Bank
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <ConnectedInstitutionCard key={item.id} item={item} />
          ))}

          <button
            onClick={() => setShowConnect(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus size={14} /> Connect Another Bank
          </button>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-800">Plaid Configuration</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Environment: <span className="font-medium text-gray-700 capitalize">{status.environment}</span>
          </span>
        </div>
        <PlaidConfigForm />
      </div>

      <ConnectBankModal isOpen={showConnect} onClose={() => setShowConnect(false)} />
    </div>
  );
}
