import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { t as translate } from '../../i18n';
import { ArrowLeftRight, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react';
import type { ExchangeRate } from '../../api/exchangeRates';
import { IS_DEMO } from '../../demo/isDemo';
import { useCanSave } from '../../hooks/useConnection';
import {
  useExchangeRates,
  useRefreshExchangeRates,
  useSaveExchangeRate,
} from '../../hooks/useExchangeRates';
import { useFormReset } from '../../hooks/useFormReset';
import { formatRate, groupRatesByMonth, parseRateInput } from '../../utils/exchangeRates';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';

const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600';

const NO_RATES: ExchangeRate[] = [];

const todayIso = () => format(new Date(), 'yyyy-MM-dd');
// Called while rendering, so they follow the App Language
const dayLabel = (date: string) => format(parseISO(date), translate('settings:rates.dayPattern'));
const monthLabel = (month: string) =>
  format(parseISO(`${month}-01`), translate('settings:rates.monthPattern'));

/**
 * Settings → Exchange rates: pesos per dollar, one rate per date. Shows today's rate, when
 * rates were last fetched and every rate by month; Refresh asks FlyBudget's server to fetch
 * the latest, and any date's rate can be entered or corrected by hand.
 */
export function ExchangeRates() {
  const { t } = useTranslation('settings');
  const { data, isLoading, isError } = useExchangeRates();
  const refresh = useRefreshExchangeRates();
  const canSave = useCanSave();
  // The date being entered or corrected ('' = the user picks one)
  const [editDate, setEditDate] = useState<string | null>(null);

  const rates = data?.rates ?? NO_RATES;
  const months = groupRatesByMonth(rates);
  const current = data?.current ?? null;

  const refreshButton = !IS_DEMO && (
    <Button
      variant="secondary"
      size="sm"
      disabled={!canSave || refresh.isPending}
      onClick={() => refresh.mutate()}
    >
      {refresh.isPending ? (
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : (
        <RefreshCw size={13} aria-hidden />
      )}
      {refresh.isPending ? t('rates.refreshing') : t('rates.refresh')}
    </Button>
  );
  const enterButton = (
    <Button variant="secondary" size="sm" onClick={() => setEditDate('')}>
      <Plus size={13} aria-hidden /> {t('rates.enter')}
    </Button>
  );

  return (
    <div className="max-w-xl space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-text">{t('rates.title')}</h2>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">{t('rates.description')}</p>

        {isLoading ? (
          <p className="mt-4 text-sm text-text-tertiary">{t('loading')}</p>
        ) : isError ? (
          <p role="alert" className="mt-4 text-sm text-negative">
            {t('rates.loadError')}
          </p>
        ) : (
          <div className="mt-4 p-4 rounded-lg border border-border-light bg-surface-alt">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-text-tertiary">{t('rates.today')}</p>
                {current ? (
                  <>
                    <p className="text-2xl font-semibold text-text tabular-nums mt-0.5">
                      $ {formatRate(current.rate)}
                      <span className="text-sm font-normal text-text-secondary">
                        {' '}
                        {t('rates.perDollar')}
                      </span>
                    </p>
                    {current.date !== todayIso() && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {t('rates.latest', { day: dayLabel(current.date) })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-secondary mt-1">{t('rates.noRate')}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {refreshButton}
                {enterButton}
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              {data?.lastFetchedAt
                ? t('rates.lastFetched', {
                    when: formatDistanceToNow(parseISO(data.lastFetchedAt), { addSuffix: true }),
                  })
                : t('rates.neverFetched')}{' '}
              {IS_DEMO ? t('rates.fetchPolicyDemo') : t('rates.fetchPolicy')}
            </p>
            {refresh.isError && (
              <p role="alert" className="text-xs text-negative mt-2">
                {refresh.error.message}
              </p>
            )}
            <SavingPausedHint className="mt-2" />
          </div>
        )}
      </section>

      {data && (
        <section>
          <h2 className="text-sm font-semibold text-text">{t('rates.byMonth')}</h2>
          {months.length === 0 ? (
            <EmptyState
              compact
              icon={<ArrowLeftRight size={18} />}
              title={t('rates.emptyTitle')}
              description={IS_DEMO ? t('rates.emptyDemo') : t('rates.empty')}
              actions={
                <>
                  {refreshButton}
                  {enterButton}
                </>
              }
            />
          ) : (
            <div className="mt-3 space-y-2">
              {months.map(({ month, rates: inMonth }, i) => (
                <details
                  key={month}
                  open={i === 0}
                  aria-label={t('rates.monthRates', { month: monthLabel(month) })}
                  className="group rounded-lg border border-border-light"
                >
                  <summary className="flex items-center justify-between gap-3 px-4 py-2.5 max-md:min-h-11 cursor-pointer text-sm font-medium text-text hover:bg-surface-alt rounded-lg">
                    {monthLabel(month)}
                    <span className="text-xs font-normal text-text-tertiary">
                      {t('rates.rateCount', { count: inMonth.length })}
                    </span>
                  </summary>
                  <ul className="border-t border-border-light divide-y divide-border-light">
                    {inMonth.map((r) => (
                      <li key={r.date} className="flex items-center gap-3 pl-4 pr-2 py-1 text-sm">
                        <span className="text-text-secondary flex-1 min-w-0">
                          {dayLabel(r.date)}
                          {r.manual && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-caution-subtle text-caution">
                              {t('rates.manual')}
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-text">{formatRate(r.rate)}</span>
                        <button
                          type="button"
                          aria-label={t('rates.editDay', { day: dayLabel(r.date) })}
                          onClick={() => setEditDate(r.date)}
                          className="p-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-surface-alt transition-colors cursor-pointer"
                        >
                          <Pencil size={13} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      <EditRateModal date={editDate} rates={rates} onClose={() => setEditDate(null)} />
    </div>
  );
}

/** Enter or correct one date's rate. `date` is null when closed, '' to let the user pick. */
function EditRateModal({
  date,
  rates,
  onClose,
}: {
  date: string | null;
  rates: ExchangeRate[];
  onClose: () => void;
}) {
  const { t } = useTranslation('settings');
  const save = useSaveExchangeRate();
  const canSave = useCanSave();
  const dateId = useId();
  const rateId = useId();
  const [day, setDay] = useState('');
  const [text, setText] = useState('');

  // Filled once per opening: the list refetches in the background and must not wipe the form
  useFormReset(date === null ? null : `rate:${date}`, () => {
    const stored = rates.find((r) => r.date === date);
    setDay(date || todayIso());
    setText(stored ? formatRate(stored.rate) : '');
    save.reset();
  });

  const existing = rates.find((r) => r.date === day);
  const rate = parseRateInput(text);
  const dayOk = /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= todayIso();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rate === null || !dayOk || !canSave) return;
    try {
      await save.mutateAsync({ date: day, rate });
      onClose();
    } catch {
      // Shown below
    }
  }

  return (
    <Modal
      isOpen={date !== null}
      onClose={onClose}
      title={date ? t('rates.correctTitle') : t('rates.enter')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={dateId} className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('rates.date')}
          </label>
          <input
            id={dateId}
            type="date"
            required
            max={todayIso()}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={rateId} className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('rates.pesosPerDollar')}
          </label>
          <input
            id={rateId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="40.35"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
          <p className="text-xs text-text-tertiary mt-1.5">
            {existing
              ? t('rates.replaces', { rate: formatRate(existing.rate) })
              : t('rates.keptByHand')}
          </p>
        </div>
        {save.isError && (
          <p role="alert" className="text-xs text-negative">
            {save.error.message}
          </p>
        )}
        <SavingPausedHint />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('ui.cancel', { ns: 'common' })}
          </Button>
          <Button type="submit" disabled={rate === null || !dayOk || !canSave || save.isPending}>
            {save.isPending ? t('saving') : t('rates.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
