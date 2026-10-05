import { useId, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
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
const dayLabel = (date: string) => format(parseISO(date), 'EEE d MMM yyyy');
const monthLabel = (month: string) => format(parseISO(`${month}-01`), 'MMMM yyyy');

/**
 * Settings → Exchange rates: pesos per dollar, one rate per date. Shows today's rate, when
 * rates were last fetched and every rate by month; Refresh asks FlyBudget's server to fetch
 * the latest, and any date's rate can be entered or corrected by hand.
 */
export function ExchangeRates() {
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
      {refresh.isPending ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
  const enterButton = (
    <Button variant="secondary" size="sm" onClick={() => setEditDate('')}>
      <Plus size={13} aria-hidden /> Enter a rate
    </Button>
  );

  return (
    <div className="max-w-xl space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-text">Exchange rates</h2>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
          Pesos per dollar: the interbank rate, one per day. Weekends and holidays use the rate of
          the business day before.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-text-tertiary">Loading…</p>
        ) : isError ? (
          <p role="alert" className="mt-4 text-sm text-negative">
            Couldn't load the exchange rates.
          </p>
        ) : (
          <div className="mt-4 p-4 rounded-lg border border-border-light bg-surface-alt">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-text-tertiary">Today's rate</p>
                {current ? (
                  <>
                    <p className="text-2xl font-semibold text-text tabular-nums mt-0.5">
                      $ {formatRate(current.rate)}
                      <span className="text-sm font-normal text-text-secondary"> per US$ 1</span>
                    </p>
                    {current.date !== todayIso() && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        The rate of {dayLabel(current.date)}, the latest there is
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-secondary mt-1">No rate yet</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {refreshButton}
                {enterButton}
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              {data?.lastFetchedAt
                ? `Last fetched ${formatDistanceToNow(parseISO(data.lastFetchedAt), { addSuffix: true })}`
                : 'Never fetched'}
              {IS_DEMO
                ? '. The demo never fetches rates; in the app, FlyBudget fetches them about once a day.'
                : '. FlyBudget fetches new rates about once a day, when it starts.'}
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
          <h2 className="text-sm font-semibold text-text">Rates by month</h2>
          {months.length === 0 ? (
            <EmptyState
              compact
              icon={<ArrowLeftRight size={18} />}
              title="No exchange rates yet"
              description={
                IS_DEMO
                  ? 'Rates for converting between pesos and dollars go here. Enter one by hand to try it.'
                  : 'Rates for converting between pesos and dollars go here. Refresh to fetch them, or enter one by hand.'
              }
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
                  className="group rounded-lg border border-border-light"
                >
                  <summary className="flex items-center justify-between gap-3 px-4 py-2.5 max-md:min-h-11 cursor-pointer text-sm font-medium text-text hover:bg-surface-alt rounded-lg">
                    {monthLabel(month)}
                    <span className="text-xs font-normal text-text-tertiary">
                      {inMonth.length} {inMonth.length === 1 ? 'rate' : 'rates'}
                    </span>
                  </summary>
                  <ul className="border-t border-border-light divide-y divide-border-light">
                    {inMonth.map((r) => (
                      <li key={r.date} className="flex items-center gap-3 pl-4 pr-2 py-1 text-sm">
                        <span className="text-text-secondary flex-1 min-w-0">
                          {dayLabel(r.date)}
                          {r.manual && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-caution-subtle text-caution">
                              Entered by hand
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-text">{formatRate(r.rate)}</span>
                        <button
                          type="button"
                          aria-label={`Edit the rate of ${dayLabel(r.date)}`}
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
      title={date ? 'Correct a rate' : 'Enter a rate'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={dateId} className="block text-sm font-medium text-text-secondary mb-1.5">
            Date
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
            Pesos per dollar
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
              ? `Replaces ${formatRate(existing.rate)}. A rate entered by hand is kept when rates are fetched.`
              : 'A rate entered by hand is kept when rates are fetched.'}
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
            Cancel
          </Button>
          <Button type="submit" disabled={rate === null || !dayOk || !canSave || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save rate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
