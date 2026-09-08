import { useState, useCallback } from 'react';
import { RefreshCw, Unlink, AlertTriangle, Loader2 } from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';
import { PlaidLinkButton } from './PlaidLinkButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useSyncItem, useDisconnectItem, useCreateUpdateLinkToken } from '../../hooks/usePlaid';
import { formatDistanceToNow } from 'date-fns';
import type { PlaidItem } from '../../types';

interface Props {
  item: PlaidItem;
}

export function ConnectedInstitutionCard({ item }: Props) {
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [updateLinkToken, setUpdateLinkToken] = useState<string | null>(null);
  const syncItem = useSyncItem();
  const disconnectItem = useDisconnectItem();
  const createUpdateLink = useCreateUpdateLinkToken();

  const isSyncing = syncItem.isPending || item.syncStatus === 'syncing';
  const initial = item.institutionName.charAt(0).toUpperCase();

  async function handleSync() {
    await syncItem.mutateAsync(item.id);
  }

  async function handleReconnect() {
    try {
      const { linkToken } = await createUpdateLink.mutateAsync(item.id);
      setUpdateLinkToken(linkToken);
    } catch {
      // handled by mutation state
    }
  }

  const handleUpdateSuccess = useCallback(() => {
    setUpdateLinkToken(null);
    syncItem.mutate(item.id);
  }, [item.id, syncItem]);

  async function handleDisconnect() {
    await disconnectItem.mutateAsync(item.id);
  }

  const enabledAccounts = item.accounts.filter(a => a.isEnabled);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
              {initial}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{item.institutionName}</h3>
              <SyncStatusBadge status={item.syncStatus} className="mt-0.5" />
            </div>
          </div>
          {item.lastSyncedAt && (
            <span className="text-xs text-gray-400">
              Last synced {formatDistanceToNow(new Date(item.lastSyncedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {item.syncStatus === 'error' && item.syncError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600">{item.syncError}</p>
          </div>
        )}

        {item.syncStatus === 'login_required' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Your bank requires you to re-authenticate. Click "Reconnect" to update your credentials.
            </p>
          </div>
        )}

        {enabledAccounts.length > 0 && (
          <div className="space-y-1.5">
            {enabledAccounts.map(acct => (
              <div key={acct.plaidAccountId} className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  <span className="capitalize">{acct.plaidAccountType}</span>
                  {acct.mask && <span className="text-gray-400 ml-1">****{acct.mask}</span>}
                </span>
                <span className="text-gray-400">
                  {acct.accountName ? `→ ${acct.accountName}` : 'Not linked'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {isSyncing ? (
              <><Loader2 size={12} className="animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw size={12} /> Sync Now</>
            )}
          </button>

          {item.syncStatus === 'login_required' && !updateLinkToken && (
            <button
              onClick={handleReconnect}
              disabled={createUpdateLink.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Reconnect
            </button>
          )}

          {updateLinkToken && (
            <PlaidLinkButton
              linkToken={updateLinkToken}
              onSuccess={handleUpdateSuccess}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Open Link to Reconnect
            </PlaidLinkButton>
          )}

          <button
            onClick={() => setShowDisconnect(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-auto"
          >
            <Unlink size={12} /> Disconnect
          </button>
        </div>

        {syncItem.isSuccess && syncItem.data && (
          <p className="text-xs text-emerald-600">
            Synced: {syncItem.data.added} added, {syncItem.data.modified} modified, {syncItem.data.removed} removed.
          </p>
        )}
      </div>

      <ConfirmModal
        isOpen={showDisconnect}
        onClose={() => setShowDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Institution"
        message={`Are you sure you want to disconnect ${item.institutionName}? Your existing accounts and transactions will not be deleted.`}
        confirmLabel="Disconnect"
        danger
      />
    </>
  );
}
