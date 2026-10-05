import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { restoreBackup } from '../../api/backup';
import { IS_DEMO, downloadFromApi } from '../../demo/demoApi';

const API_BASE = '/api/export';

// The server sends these as downloads; the demo's in-browser API can only answer fetch
const download = (url: string) =>
  IS_DEMO ? void downloadFromApi(url) : void (window.location.href = url);

export function DataExport() {
  const { t } = useTranslation('settings');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [restoring, setRestoring] = useState(false);
  // The text is looked up while rendering, so it follows a language switch
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; text: () => string } | null>(
    null,
  );
  const queryClient = useQueryClient();

  async function chooseBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setRestoreMessage(null);
    try {
      setPending({ name: file.name, data: JSON.parse(await file.text()) });
    } catch {
      setRestoreMessage({
        ok: false,
        text: () => t('data.restore.notBackup', { name: file.name }),
      });
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(pending.data);
      const count = result.restored.transactions ?? 0;
      const name = pending.name;
      const safetyCopy = result.safetyCopy;
      setRestoreMessage({
        ok: true,
        text: () =>
          safetyCopy
            ? t('data.restore.doneWithCopy', {
                name,
                count,
                total: count.toLocaleString('en-US'),
                file: safetyCopy,
              })
            : t('data.restore.done', { name, count, total: count.toLocaleString('en-US') }),
      });
      // Everything on screen is from before the restore
      await queryClient.invalidateQueries();
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setRestoreMessage({ ok: false, text: () => message ?? t('data.restore.failed') });
    } finally {
      setRestoring(false);
      setPending(null);
    }
  }

  function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    download(`${API_BASE}/transactions/csv${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-text">{t('data.title')}</h2>
        <p className="text-xs text-text-tertiary mt-0.5">{t('data.description')}</p>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">{t('data.transactions.title')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{t('data.transactions.description')}</p>
        </div>
        <div className="flex items-end gap-3 max-md:flex-wrap">
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">
              {t('data.transactions.from')}
            </label>
            <input
              type="date"
              aria-label={t('data.transactions.from')}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-tertiary mb-1">
              {t('data.transactions.to')}
            </label>
            <input
              type="date"
              aria-label={t('data.transactions.to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
            />
          </div>
          <Button onClick={downloadCsv} size="sm">
            <Download size={14} /> {t('data.transactions.download')}
          </Button>
        </div>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">{t('data.rates.title')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{t('data.rates.description')}</p>
        </div>
        <Button onClick={() => download(`${API_BASE}/exchange-rates/csv`)} size="sm">
          <Download size={14} /> {t('data.rates.download')}
        </Button>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">{t('data.backup.title')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{t('data.backup.description')}</p>
        </div>
        <button
          onClick={() => {
            download(`${API_BASE}/backup`);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-text-secondary rounded-md hover:opacity-90 transition-colors"
        >
          <Download size={14} /> {t('data.backup.download')}
        </button>
      </div>

      <div className="bg-surface-alt rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text">{t('data.restore.title')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">{t('data.restore.description')}</p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={t('data.restore.file')}
          onChange={chooseBackup}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={restoring}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={14} /> {restoring ? t('data.restore.restoring') : t('data.restore.choose')}
        </Button>
        {restoreMessage && (
          <p
            role="status"
            className={`text-xs ${restoreMessage.ok ? 'text-text-secondary' : 'text-red-600'}`}
          >
            {restoreMessage.text()}
          </p>
        )}
      </div>

      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirmRestore}
        title={t('data.restore.confirmTitle')}
        message={t('data.restore.confirmMessage', {
          name: pending?.name ?? t('data.restore.theBackup'),
        })}
        confirmLabel={t('data.restore.confirm')}
        danger
      />
    </div>
  );
}
