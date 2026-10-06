import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';

/** Shown while the user finishes connecting their bank on Plaid's page in their browser. */
export function HostedLinkWaiting({
  onReopen,
  onCancel,
}: {
  onReopen: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('settings');
  return (
    <div className="text-center space-y-4 py-2">
      <Loader2 size={28} className="animate-spin text-brand-600 mx-auto" />
      <div>
        <h3 className="text-sm font-semibold text-text">{t('banks.hostedLink.title')}</h3>
        <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
          {t('banks.hostedLink.detail')}
        </p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <ShieldCheck size={12} /> {t('banks.hostedLink.secure')}
      </p>
      <div className="flex justify-center gap-2 max-md:flex-wrap">
        <Button variant="secondary" onClick={onReopen}>
          <ExternalLink size={14} /> {t('banks.hostedLink.reopen')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('ui.cancel', { ns: 'common' })}
        </Button>
      </div>
    </div>
  );
}
