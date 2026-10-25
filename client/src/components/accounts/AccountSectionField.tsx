import { useId } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { usePreferencesStore } from '../../store/preferencesStore';
import { ACCOUNT_SECTION_MAX_LENGTH, sectionNames } from '../../utils/accountSections';

interface Props {
  /** The section's name as typed; empty = none */
  value: string;
  onChange: (name: string) => void;
}

/**
 * An account's Account Section: pick one of the sections in use, type a new name to start
 * one, or leave it empty. Sections have no screen of their own; one is gone when its last
 * account leaves it.
 */
export function AccountSectionField({ value, onChange }: Props) {
  const { data: accounts } = useAccounts();
  const sections = usePreferencesStore((s) => s.accountSections);
  const id = useId();
  const names = sectionNames(accounts ?? [], sections);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">
        Section <span className="font-normal text-text-tertiary">(optional)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={`${id}-sections`}
        maxLength={ACCOUNT_SECTION_MAX_LENGTH}
        autoComplete="off"
        placeholder={names.length ? 'Choose a section or type a new one' : 'e.g. Visa card'}
        aria-describedby={`${id}-hint`}
        className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface text-text placeholder-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <datalist id={`${id}-sections`}>
        {names.map((name) => (
          // The name as text too: a value alone leaves the option without a label
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </datalist>
      <p id={`${id}-hint`} className="mt-1 text-xs text-text-tertiary">
        Accounts with the same section are listed together. Saved on this device only.
      </p>
    </div>
  );
}
