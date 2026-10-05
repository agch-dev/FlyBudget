import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency';
import { balancesTotal } from '../../utils/balanceConversion';
import { useBalanceRates } from '../../hooks/useExchangeRates';
import { useViewingCurrency } from '../../hooks/useViewingCurrency';
import { chartColors } from '../../utils/chartColors';
import { accountTypeGroupLabel, accountTypeInfo } from '../../utils/accountTypes';
import type { Account, AccountTypeGroup, Currency } from '../../types';

/** A group of account types on one side of the balance sheet, named by `accountTypeGroupLabel` */
interface Bucket {
  group: AccountTypeGroup;
  color: string;
}

const ASSET_BUCKETS: Bucket[] = [
  { group: 'investments', color: '#7C3AED' },
  { group: 'cash', color: chartColors.positive },
  { group: 'property', color: '#0891B2' },
  { group: 'other', color: '#78716C' },
];

const LIABILITY_BUCKETS: Bucket[] = [
  { group: 'credit', color: chartColors.negative },
  { group: 'loans', color: '#EA580C' },
  { group: 'other', color: '#9F1239' },
];

interface Props {
  accounts: Account[];
}

/**
 * In the viewing currency: balances in the other one count at today's rate (left out while no
 * rate is stored)
 */
export function AssetLiabilitySummary({ accounts }: Props) {
  const { t } = useTranslation('accounts');
  const viewing = useViewingCurrency();
  const { rates, today } = useBalanceRates();
  const { assets, liabilities } = useMemo(() => {
    // Accounts per group (which also says which groups have any accounts at all), then summed
    const assetAccounts = new Map<AccountTypeGroup, Account[]>();
    const liabilityAccounts = new Map<AccountTypeGroup, Account[]>();
    for (const a of accounts) {
      const info = accountTypeInfo(a.type);
      const side = info.liability ? liabilityAccounts : assetAccounts;
      side.set(info.group, [...(side.get(info.group) ?? []), a]);
    }
    const sums = (side: Map<AccountTypeGroup, Account[]>) =>
      new Map(
        [...side].map(([group, list]) => [group, balancesTotal(list, viewing, today, rates)]),
      );
    return { assets: sums(assetAccounts), liabilities: sums(liabilityAccounts) };
  }, [accounts, rates, today, viewing]);

  return (
    <div>
      <Section
        title={t('summary.assets')}
        buckets={ASSET_BUCKETS}
        sums={assets}
        currency={viewing}
        emptyKey="summary.noAssets"
      />
      <div className="border-t border-border-light my-4" />
      <Section
        title={t('summary.liabilities')}
        buckets={LIABILITY_BUCKETS}
        sums={liabilities}
        currency={viewing}
        emptyKey="summary.noLiabilities"
        owed
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  buckets: Bucket[];
  sums: Map<AccountTypeGroup, number>;
  /** The currency the sums are in */
  currency: Currency;
  /** The sentence shown when there are no accounts on this side at all, with its link */
  emptyKey: 'summary.noAssets' | 'summary.noLiabilities';
  /** Liabilities: balances are negative */
  owed?: boolean;
}

/**
 * One side of the balance sheet. Only groups with accounts are listed: a "$0" row for a
 * group you haven't added would read as "you have none", not "not tracked yet".
 */
function Section({ title, buckets, sums, currency, emptyKey, owed = false }: SectionProps) {
  const { t } = useTranslation('accounts');
  const rows = buckets.filter((b) => sums.has(b.group));
  const total = rows.reduce((s, b) => s + (sums.get(b.group) ?? 0), 0);
  // Bar widths use magnitudes; a bucket on the "wrong" side (overpaid card) gets no width
  const sign = owed ? -1 : 1;
  const barTotal = rows.reduce((s, b) => s + Math.max(sign * (sums.get(b.group) ?? 0), 0), 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text">{title}</span>
        <span className="text-sm font-semibold tabular-nums text-text">
          {formatCurrency(total, currency)}
        </span>
      </div>

      {barTotal > 0 && (
        <div className="h-3 flex rounded-full overflow-hidden mt-2">
          {rows.map((b) => {
            const value = Math.max(sign * (sums.get(b.group) ?? 0), 0);
            if (value === 0) return null;
            return (
              <div
                key={b.group}
                className="h-full"
                style={{ width: `${(value / barTotal) * 100}%`, backgroundColor: b.color }}
              />
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <p className="mt-2 text-sm text-text-tertiary">
          <Trans
            t={t}
            i18nKey={emptyKey}
            components={{
              add: (
                <Link
                  to="/accounts?add=1"
                  className="font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap"
                />
              ),
            }}
          />
        </p>
      )}

      <div className="mt-3 space-y-1.5">
        {rows.map((b) => (
          <div key={b.group} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span className="text-sm text-text-secondary">{accountTypeGroupLabel(b.group)}</span>
            </div>
            <span className="text-sm tabular-nums text-text">
              {formatCurrency(sums.get(b.group) ?? 0, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
