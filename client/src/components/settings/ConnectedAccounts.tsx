import { useState } from 'react';
import { RefreshCw, Plus, Building2, Loader2 } from 'lucide-react';
import { usePlaidStatus, usePlaidItems, useSyncAll } from '../../hooks/usePlaid';
import { PlaidConfigForm } from '../plaid/PlaidConfigForm';
import { ConnectBankModal } from '../plaid/ConnectBankModal';
import { ConnectedInstitutionCard } from '../plaid/ConnectedInstitutionCard';
import { Button } from '../ui/Button';

export function ConnectedAccounts() {
  const { data: status, isLoading: statusLoading } = usePlaidStatus();
  const { data: items = [], isLoading: itemsLoading } = usePlaidItems();
  const syncAll = useSyncAll();
  const [showConnect, setShowConnect] = useState(false);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
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
          <h2 className="text-sm font-semibold text-text">Connected Banks</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Automatically import transactions from your financial institutions.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => syncAll.mutate()} disabled={syncAll.isPending}>
            {syncAll.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Syncing All...</>
            ) : (
              <><RefreshCw size={12} /> Sync All</>
            )}
          </Button>
        )}
      </div>

      {syncAll.isSuccess && syncAll.data && (
        <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
          <p className="text-xs text-positive">
            Sync complete:{' '}
            {syncAll.data.results.reduce((s, r) => s + r.added, 0)} new transactions imported.
          </p>
        </div>
      )}

      {itemsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-surface-alt rounded-lg">
          <div className="w-16 h-16 rounded-lg bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-brand-500" />
          </div>
          <h3 className="text-sm font-medium text-text-secondary">No Connected Banks</h3>
          <p className="text-xs text-text-tertiary mt-1 max-w-xs mx-auto">
            Connect your first financial institution to start automatically importing transactions.
          </p>
          <Button onClick={() => setShowConnect(true)} className="mt-4 mx-auto">
            <Plus size={14} /> Connect Bank
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <ConnectedInstitutionCard key={item.id} item={item} />
          ))}

          <Button variant="secondary" onClick={() => setShowConnect(true)}>
            <Plus size={14} /> Connect Another Bank
          </Button>
        </div>
      )}

      <div className="bg-surface-alt rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-medium text-text">Plaid Configuration</h3>
        <PlaidConfigForm />
      </div>

      <ConnectBankModal isOpen={showConnect} onClose={() => setShowConnect(false)} />
    </div>
  );
}
