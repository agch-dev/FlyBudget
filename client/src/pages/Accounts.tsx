import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Landmark,
  Link2,
} from 'lucide-react';
import { useAccounts, useBalancesAgo } from '../hooks/useAccounts';
import { AddAccountModal } from '../components/accounts/AddAccountModal';
import { AssetLiabilitySummary } from '../components/accounts/AssetLiabilitySummary';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useOpenFromLink } from '../hooks/useOpenFromLink';
import { docsUrl } from '../utils/project';
import { formatCurrency } from '../utils/currency';
import { totalAndChange } from '../utils/balanceConversion';
import NetWorthMini from '../components/dashboard/NetWorthMini';
import { ACCOUNT_TYPE_GROUPS, type Account, type AccountTypeGroup } from '../types';
import { AccountIcon } from '../components/accounts/AccountIcon';
import { accountTypeGroupLabel, accountTypeInfo, accountTypeLabel } from '../utils/accountTypes';
import { groupTotal, listAccountsByGroup } from '../utils/accountGroups';
import { format, subMonths } from 'date-fns';
import { useBalanceRates } from '../hooks/useExchangeRates';
import { useViewingCurrency } from '../hooks/useViewingCurrency';

function groupAccountsByType(accounts: Account[]) {
  const groups = new Map<AccountTypeGroup, Account[]>();
  for (const a of accounts) {
    const group = accountTypeInfo(a.type).group;
    const list = groups.get(group) ?? [];
    list.push(a);
    groups.set(group, list);
  }
  return ACCOUNT_TYPE_GROUPS.filter((group) => groups.has(group)).map((group) => ({
    group,
    accounts: groups.get(group)!,
  }));
}

interface AccountGroupProps {
  group: AccountTypeGroup;
  accounts: Account[];
  balancesAgo: Record<string, number>;
}

/** One account inside a card: icon, name, type and its own balance; opens the account */
function AccountLine({ account }: { account: Account }) {
  // The type's name follows the App Language
  useTranslation('accounts');
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/accounts/${account.id}`)}
      className="flex items-center justify-between px-5 py-4 hover:bg-hover cursor-pointer group transition-colors last:rounded-b-lg"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <AccountIcon name={account.name} type={account.type} logo={account.logo} size="md" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-text truncate block">{account.name}</span>
            <span className="text-xs text-text-tertiary mt-0.5 block">
              {accountTypeLabel(account.type)}
            </span>
          </div>
        </div>
      </div>
      <span className="text-sm font-medium tabular-nums text-text">
        {formatCurrency(account.balance, account.currency)}
      </span>
    </div>
  );
}

/**
 * An Account Group as a card: its name, its combined balance in the viewing currency at
 * today's rate, and its accounts with their own balances. The group itself opens nothing;
 * each account does.
 */
function AccountGroupCard({ name, accounts }: { name: string; accounts: Account[] }) {
  const { t } = useTranslation('accounts');
  const { rates, today } = useBalanceRates();
  const { currency, total, complete } = groupTotal(accounts, useViewingCurrency(), today, rates);
  return (
    <Card padding="none">
      <section aria-label={t('page.groupCard', { name })}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h2 className="text-base font-semibold text-text truncate">{name}</h2>
            <span className="text-xs text-text-tertiary shrink-0">
              {complete ? t('page.group') : t('page.groupIncomplete')}
            </span>
          </div>
          <span
            className={`text-base font-semibold tabular-nums ${total < 0 ? 'text-negative' : 'text-text'}`}
          >
            {formatCurrency(total, currency)}
          </span>
        </div>
        <div className="divide-y divide-border-light">
          {accounts.map((account) => (
            <AccountLine key={account.id} account={account} />
          ))}
        </div>
      </section>
    </Card>
  );
}

function AccountTypeSection({ group, accounts, balancesAgo }: AccountGroupProps) {
  const { t } = useTranslation('accounts');
  const [collapsed, setCollapsed] = useState(false);
  // In the viewing currency, like net worth: today's balances at today's rate, the month-ago
  // ones at the rate of that day. Each account below keeps its own balance.
  const viewing = useViewingCurrency();
  const { rates, today } = useBalanceRates();
  const { total, before, change } = totalAndChange(
    accounts,
    balancesAgo,
    viewing,
    { today, ago: format(subMonths(new Date(), 1), 'yyyy-MM-dd') },
    rates,
  );
  const changePct = before !== 0 ? (change / Math.abs(before)) * 100 : 0;

  return (
    <Card padding="none">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-hover transition-colors ${
          collapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-border'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-text-tertiary">
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="text-base font-semibold text-text">{accountTypeGroupLabel(group)}</span>
          {change !== 0 && (
            <span
              className={`flex items-center gap-1 text-xs tabular-nums ${change >= 0 ? 'text-positive' : 'text-negative'}`}
            >
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change >= 0 ? '+' : ''}
              {formatCurrency(change, viewing)} ({Math.abs(changePct).toFixed(1)}%)
            </span>
          )}
          <span className="text-xs text-text-tertiary">{t('page.pastMonth')}</span>
        </div>
        <span
          className={`text-base font-semibold tabular-nums ${total < 0 ? 'text-negative' : 'text-text'}`}
          data-testid="account-type-total"
        >
          {formatCurrency(total, viewing)}
        </span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border-light">
          {accounts.map((account) => (
            <AccountLine key={account.id} account={account} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AccountsPage() {
  const { t } = useTranslation('accounts');
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: balancesAgo = {} } = useBalancesAgo();
  const [addOpen, setAddOpen] = useState(false);
  useOpenFromLink('add', () => setAddOpen(true));
  // Account Groups get a card each; the accounts with no group stay in the cards by type
  const { groups, byType } = useMemo(() => {
    const entries = listAccountsByGroup(accounts);
    return {
      groups: entries.filter((e) => e.kind === 'group'),
      byType: groupAccountsByType(
        entries.flatMap((e) => (e.kind === 'account' ? [e.account] : [])),
      ),
    };
  }, [accounts]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="h-5 w-32 bg-surface-alt rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-alt rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">{t('page.title')}</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {t('page.add')}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <EmptyState
            icon={<Landmark size={26} />}
            title={t('page.emptyTitle')}
            description={t('page.emptyDescription')}
            learnMoreHref={docsUrl('accounts')}
            actions={
              <>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus size={14} /> {t('page.addFirst')}
                </Button>
                <ButtonLink variant="secondary" to="/settings?tab=connections">
                  <Link2 size={14} /> {t('page.connectBank')}
                </ButtonLink>
              </>
            }
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <NetWorthMini />
              </Card>
              <Card>
                <AssetLiabilitySummary accounts={accounts} />
              </Card>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            {groups.map((g) => (
              <AccountGroupCard key={`group:${g.name}`} name={g.name} accounts={g.accounts} />
            ))}
            {byType.map((g) => (
              <AccountTypeSection
                key={g.group}
                group={g.group}
                accounts={g.accounts}
                balancesAgo={balancesAgo}
              />
            ))}
          </div>
        </div>
      )}

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
