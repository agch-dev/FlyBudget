import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { PlaidSyncStatus } from '../../types';

interface Props {
  status: PlaidSyncStatus;
  className?: string;
}

const DOTS: Record<PlaidSyncStatus, string> = {
  good: 'bg-positive',
  syncing: '',
  error: 'bg-negative',
  login_required: 'bg-caution',
};

export function SyncStatusBadge({ status, className = '' }: Props) {
  const { t } = useTranslation('settings');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary ${className}`}
    >
      {status === 'syncing' ? (
        <Loader2 size={12} className="animate-spin text-brand-500" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${DOTS[status]}`} />
      )}
      {t(`banks.syncStatus.${status}`)}
    </span>
  );
}
