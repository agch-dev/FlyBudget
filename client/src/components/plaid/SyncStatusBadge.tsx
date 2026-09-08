import { Loader2 } from 'lucide-react';
import type { PlaidSyncStatus } from '../../types';

interface Props {
  status: PlaidSyncStatus;
  className?: string;
}

const statusConfig: Record<PlaidSyncStatus, { dot: string; label: string }> = {
  good: { dot: 'bg-emerald-400', label: 'Synced' },
  syncing: { dot: '', label: 'Syncing...' },
  error: { dot: 'bg-red-400', label: 'Error' },
  login_required: { dot: 'bg-amber-400', label: 'Login Required' },
};

export function SyncStatusBadge({ status, className = '' }: Props) {
  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 ${className}`}>
      {status === 'syncing' ? (
        <Loader2 size={12} className="animate-spin text-blue-500" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  );
}
