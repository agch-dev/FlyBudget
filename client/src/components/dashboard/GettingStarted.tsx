import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Check, ChevronRight, X } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudget } from '../../hooks/useBudget';
import { useSchedules } from '../../hooks/useSchedules';
import { useRules } from '../../hooks/useRules';
import { usePreferencesStore } from '../../store/preferencesStore';
import { docsUrl } from '../../utils/project';
import { AddAccountModal } from '../accounts/AddAccountModal';
import { ExternalLink } from '../ui/ExternalLink';
import { Card } from '../ui/Card';

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  action: { label: string; to?: string; onClick?: () => void };
}

/**
 * The first things to do in a new budget, ticked off as they're done. Shown on the
 * dashboard until every step is done or the user hides it.
 */
export default function GettingStarted({ currentMonth }: { currentMonth: string }) {
  const { t } = useTranslation('reports');
  const hidden = usePreferencesStore((s) => s.gettingStartedHidden);
  const setHidden = usePreferencesStore((s) => s.setGettingStartedHidden);
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const accounts = useAccounts();
  const transactions = useTransactions({ limit: 1 });
  const budget = useBudget(currentMonth);
  const schedules = useSchedules();
  const rules = useRules();

  const loading = [accounts, transactions, budget, schedules, rules].some((q) => q.isLoading);
  if (hidden || loading) return null;

  const firstAccount = accounts.data?.find((a) => !a.closedAt);
  const steps: Step[] = [
    {
      id: 'account',
      title: t('gettingStarted.account.title'),
      description: t('gettingStarted.account.description'),
      done: (accounts.data?.length ?? 0) > 0,
      action: { label: t('gettingStarted.account.action'), onClick: () => setAddAccountOpen(true) },
    },
    {
      id: 'transactions',
      title: t('gettingStarted.transactions.title'),
      description: t('gettingStarted.transactions.description'),
      done: (transactions.data?.length ?? 0) > 0,
      action: firstAccount
        ? { label: t('gettingStarted.transactions.action'), to: `/accounts/${firstAccount.id}` }
        : { label: t('gettingStarted.transactions.connect'), to: '/settings?tab=connections' },
    },
    {
      id: 'recurring',
      title: t('gettingStarted.recurring.title'),
      description: t('gettingStarted.recurring.description'),
      done: (schedules.data?.length ?? 0) > 0,
      action: { label: t('gettingStarted.recurring.action'), to: '/recurring' },
    },
    {
      id: 'budget',
      title: t('gettingStarted.budget.title'),
      description: t('gettingStarted.budget.description'),
      done: (budget.data ?? []).some((g) => g.categories.some((c) => c.budgeted !== 0)),
      action: { label: t('gettingStarted.budget.action'), to: '/budget' },
    },
    {
      id: 'rules',
      title: t('gettingStarted.rules.title'),
      description: t('gettingStarted.rules.description'),
      done: (rules.data?.length ?? 0) > 0,
      action: { label: t('gettingStarted.rules.action'), to: '/rules' },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextStep = steps.find((s) => !s.done);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-base font-semibold text-text">{t('gettingStarted.title')}</h2>
          <p className="text-sm text-text-tertiary mt-0.5">
            {t('gettingStarted.progress', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button
          onClick={() => setHidden(true)}
          aria-label={t('gettingStarted.hide')}
          title={t('gettingStarted.hide')}
          className="p-1.5 -mr-1.5 max-md:min-w-11 max-md:min-h-11 flex items-center justify-center rounded-md text-text-tertiary hover:bg-hover hover:text-text"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="mx-5 mt-3 h-1.5 rounded-full bg-surface-alt overflow-hidden"
        role="progressbar"
        aria-label={t('gettingStarted.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-full bg-brand-600 rounded-full transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-3 divide-y divide-border-light">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-3 px-5 py-3 ${isNext ? 'bg-brand-50' : ''}`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step.done
                    ? 'bg-positive text-white'
                    : isNext
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-alt text-text-tertiary'
                }`}
              >
                {step.done ? <Check size={14} aria-label={t('gettingStarted.done')} /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${step.done ? 'text-text-tertiary line-through' : 'text-text'}`}
                >
                  {step.title}
                </p>
                {!step.done && (
                  <p className="text-xs text-text-tertiary mt-0.5">{step.description}</p>
                )}
              </div>
              {!step.done && <StepAction step={step} primary={isNext} />}
            </li>
          );
        })}
      </ol>

      <div className="px-5 py-3 border-t border-border-light text-xs text-text-tertiary">
        <Trans
          t={t}
          i18nKey="gettingStarted.guide"
          components={{
            guide: (
              <ExternalLink
                href={docsUrl('getting-started')}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                {null}
              </ExternalLink>
            ),
          }}
        />
      </div>

      <AddAccountModal isOpen={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
    </Card>
  );
}

function StepAction({ step, primary }: { step: Step; primary: boolean }) {
  const className = `shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-md:min-h-11 ${
    primary ? 'bg-brand-600 text-white hover:bg-brand-700' : 'text-brand-600 hover:bg-brand-50'
  }`;
  const content = (
    <>
      {step.action.label} <ChevronRight size={13} aria-hidden />
    </>
  );
  if (step.action.to) {
    return (
      <Link to={step.action.to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={step.action.onClick} className={className}>
      {content}
    </button>
  );
}
