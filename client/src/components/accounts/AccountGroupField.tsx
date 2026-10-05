import { useId } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useAccounts } from '../../hooks/useAccounts';
import { accountGroupNames } from '../../utils/accountGroups';

interface Props {
  /** The group's name as typed; empty = no group */
  value: string;
  onChange: (name: string) => void;
}

/**
 * The Account Group of an account: pick one of the groups in use, type a new name to start
 * one, or leave it empty. Groups have no screen of their own; a group is gone when its last
 * account leaves it.
 */
export function AccountGroupField({ value, onChange }: Props) {
  const { t } = useTranslation('accounts');
  const { data: accounts } = useAccounts();
  const id = useId();
  const names = accountGroupNames(accounts ?? []);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
        <Trans
          t={t}
          i18nKey="form.group"
          components={{ hint: <span className="font-normal text-text-tertiary" /> }}
        />
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={`${id}-groups`}
        maxLength={200}
        autoComplete="off"
        placeholder={names.length ? t('form.groupPlaceholder') : t('form.groupPlaceholderFirst')}
        className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface text-text placeholder-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <datalist id={`${id}-groups`} aria-label={t('form.groupsInUse')}>
        {names.map((name) => (
          // The name as text too: a value alone leaves the option without a label
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </datalist>
      <p className="mt-1 text-xs text-text-tertiary">{t('form.groupHint')}</p>
    </div>
  );
}
