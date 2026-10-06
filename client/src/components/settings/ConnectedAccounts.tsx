import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';
import { usePlaidStatus, usePlaidItems, useSyncAll } from '../../hooks/usePlaid';
import { useSimplefinConnections, useSyncAllSimplefin } from '../../hooks/useSimplefin';
import { PlaidConfigForm } from '../plaid/PlaidConfigForm';
import { ConnectBankModal } from '../plaid/ConnectBankModal';
import { ConnectedInstitutionCard } from '../plaid/ConnectedInstitutionCard';
import { SimplefinConnectModal } from '../simplefin/SimplefinConnectModal';
import { SimplefinConnectionCard } from '../simplefin/SimplefinConnectionCard';
import { SimplefinConfigForm } from '../simplefin/SimplefinConfigForm';
import { Button } from '../ui/Button';
import type { SimplefinSetupResult } from '../../types';
import { IS_DEMO } from '../../demo/demoApi';
import { NotInDemo } from '../demo/NotInDemo';

type Provider = 'plaid' | 'simplefin';

export function ConnectedAccounts() {
  return IS_DEMO ? <ConnectedAccountsDemo /> : <ConnectedAccountsSettings />;
}

/** The demo can't connect banks: say so where the setup would be */
function ConnectedAccountsDemo() {
  const { t } = useTranslation('settings');
  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-sm font-semibold text-text">{t('banks.title')}</h2>
        <p className="text-xs text-text-tertiary mt-0.5">{t('banks.description')}</p>
      </div>
      <NotInDemo />
    </div>
  );
}

function ConnectedAccountsSettings() {
  const { t } = useTranslation('settings');
  const { data: status, isLoading: statusLoading } = usePlaidStatus();
  const { data: items = [], isLoading: itemsLoading } = usePlaidItems();
  const { data: sfConnections = [], isLoading: sfLoading } = useSimplefinConnections();
  const syncAll = useSyncAll();
  const syncAllSf = useSyncAllSimplefin();
  const [provider, setProvider] = useState<Provider>('plaid');
  const [showConnect, setShowConnect] = useState(false);
  const [showSimplefin, setShowSimplefin] = useState(false);
  const [sfSetupResult, setSfSetupResult] = useState<SimplefinSetupResult | undefined>();

  const plaidConfigured = status?.configured ?? false;
  const isLoading = statusLoading || itemsLoading || sfLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-tertiary" aria-label={t('loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-text">{t('banks.title')}</h2>
        <p className="text-xs text-text-tertiary mt-0.5">{t('banks.description')}</p>
      </div>

      {/* Provider toggle */}
      <div className="flex rounded-lg bg-surface-alt p-1 w-fit">
        <button
          onClick={() => setProvider('plaid')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out ${
            provider === 'plaid'
              ? 'bg-surface text-text shadow-sm ring-2 ring-brand-600'
              : 'text-text-tertiary hover:text-text-secondary ring-0 ring-transparent'
          }`}
        >
          Plaid
          {items.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setProvider('simplefin')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ease-in-out ${
            provider === 'simplefin'
              ? 'bg-surface text-text shadow-sm ring-2 ring-brand-600'
              : 'text-text-tertiary hover:text-text-secondary ring-0 ring-transparent'
          }`}
        >
          SimpleFIN
          {sfConnections.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full">
              {sfConnections.length}
            </span>
          )}
        </button>
      </div>

      {/* Plaid content */}
      {provider === 'plaid' && (
        <div className="space-y-4">
          {syncAll.isSuccess && syncAll.data && (
            <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
              <p className="text-xs text-positive">
                {t('banks.plaidSynced', {
                  count: syncAll.data.results.reduce((s, r) => s + r.added, 0),
                })}
              </p>
            </div>
          )}

          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <ConnectedInstitutionCard key={item.id} item={item} />
              ))}
              <div className="flex items-center gap-2">
                {plaidConfigured && (
                  <Button variant="secondary" size="sm" onClick={() => setShowConnect(true)}>
                    <Plus size={14} /> {t('banks.addAnotherBank')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncAll.mutate()}
                  disabled={syncAll.isPending}
                >
                  {syncAll.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> {t('banks.syncing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> {t('banks.syncAll')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : plaidConfigured ? (
            <div className="bg-surface-alt rounded-lg px-5 py-8 text-center">
              <p className="text-xs text-text-tertiary mb-3">{t('banks.noPlaidBanks')}</p>
              <Button onClick={() => setShowConnect(true)}>
                <Plus size={14} /> {t('banks.connectBank')}
              </Button>
            </div>
          ) : null}

          <div className="bg-surface-alt rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-medium text-text">{t('banks.plaidConfig')}</h3>
            {!plaidConfigured && (
              <p className="text-xs text-text-tertiary">{t('banks.plaidConfigHint')}</p>
            )}
            <PlaidConfigForm />
          </div>
        </div>
      )}

      {/* SimpleFIN content */}
      {provider === 'simplefin' && (
        <div className="space-y-4">
          {syncAllSf.isSuccess && syncAllSf.data && (
            <div className="bg-positive-subtle border border-positive/10 rounded-md px-4 py-2">
              <p className="text-xs text-positive">
                {t('banks.simplefinSynced', {
                  count: syncAllSf.data.results.reduce((s, r) => s + r.added, 0),
                })}
              </p>
            </div>
          )}

          {sfConnections.length > 0 ? (
            <div className="space-y-3">
              {sfConnections.map((conn) => (
                <SimplefinConnectionCard key={conn.id} connection={conn} />
              ))}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowSimplefin(true)}>
                  <Plus size={14} /> {t('banks.addAnotherConnection')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncAllSf.mutate()}
                  disabled={syncAllSf.isPending}
                >
                  {syncAllSf.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> {t('banks.syncing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} /> {t('banks.syncAll')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="bg-surface-alt rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-medium text-text">{t('banks.simplefinConfig')}</h3>
            {sfConnections.length === 0 && (
              <p className="text-xs text-text-tertiary">{t('banks.simplefinConfigHint')}</p>
            )}
            <SimplefinConfigForm
              onSetupComplete={(result) => {
                setSfSetupResult(result);
                setShowSimplefin(true);
              }}
            />
          </div>
        </div>
      )}

      <ConnectBankModal isOpen={showConnect} onClose={() => setShowConnect(false)} />
      <SimplefinConnectModal
        isOpen={showSimplefin}
        onClose={() => {
          setShowSimplefin(false);
          setSfSetupResult(undefined);
        }}
        initialSetupResult={sfSetupResult}
      />
    </div>
  );
}
