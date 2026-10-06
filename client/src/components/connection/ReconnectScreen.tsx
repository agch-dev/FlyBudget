import { Trans, useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import { useConnection } from '../../hooks/useConnection';
import type { AppMode } from '../../hooks/useServer';
import { AuthScreen } from '../auth/AuthScreen';
import { Button } from '../ui/Button';
import { RetryProgress, retryLabel } from './RetryStatus';

/**
 * Shown instead of the app when FlyBudget's server can't be reached on startup. Keeps
 * retrying on its own (see store/connectionStore.ts); the app loads, without a page
 * reload, as soon as the server answers.
 */
export function ReconnectScreen({ mode, onRetry }: { mode: AppMode; onRetry: () => void }) {
  const { t } = useTranslation('connection');
  const connection = useConnection();
  const host = window.location.host;
  // The server answered, but with an error: retrying is up to the button
  const serverError = connection.status === 'connected';

  function tryNow() {
    void connection.retryNow();
    onRetry();
  }

  return (
    <AuthScreen
      title={t(`reconnect.title.${mode}`)}
      subtitle={
        mode === 'desktop' ? (
          t('reconnect.fewSeconds')
        ) : (
          <span className="font-mono text-xs break-all">{host}</span>
        )
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            {connection.checking ? (
              <Loader2 size={14} className="animate-spin shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-caution shrink-0" aria-hidden />
            )}
            {serverError
              ? t('reconnect.serverError')
              : mode === 'desktop'
                ? retryLabel(connection)
                : t('reconnect.cantReach', { retry: retryLabel(connection) })}
          </p>
          {!serverError && <RetryProgress connection={connection} />}
        </div>

        <Button className="w-full" onClick={tryNow} disabled={connection.checking}>
          <RefreshCw size={14} /> {t('reconnect.tryNow')}
        </Button>

        {mode === 'desktop' && (
          <p className="text-xs text-text-tertiary leading-relaxed">{t('reconnect.desktopHint')}</p>
        )}
        {mode === 'dev' && (
          <p className="text-xs text-text-tertiary leading-relaxed">
            <Trans
              t={t}
              i18nKey="reconnect.devHint"
              components={{ code: <code className="font-mono" /> }}
            />
          </p>
        )}
        {mode === 'server' && (
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer select-none text-text-secondary hover:text-text">
              {t('reconnect.troubleshooting')}
            </summary>
            <div className="mt-3 space-y-3 leading-relaxed">
              <p>{t('reconnect.budgetSafe')}</p>
              <div>
                <p>{t('reconnect.checkContainer')}</p>
                <pre className="mt-1 px-2 py-1.5 rounded bg-surface-alt font-mono text-[11px] overflow-x-auto">
                  docker ps --filter name=flybudget
                </pre>
              </div>
              <div>
                <p>{t('reconnect.seeLogs')}</p>
                <pre className="mt-1 px-2 py-1.5 rounded bg-surface-alt font-mono text-[11px] overflow-x-auto">
                  docker logs --tail 50 flybudget
                </pre>
              </div>
              <p>{t('reconnect.proxy')}</p>
            </div>
          </details>
        )}
      </div>
    </AuthScreen>
  );
}
