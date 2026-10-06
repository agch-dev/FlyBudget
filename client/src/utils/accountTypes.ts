import { t } from '../i18n';
import {
  ACCOUNT_TYPES,
  type AccountType,
  type AccountTypeGroup,
  type AccountTypeInfo,
} from '../types';

const BY_TYPE = new Map(ACCOUNT_TYPES.map((info) => [info.value, info]));

/** Unknown types (e.g. from a newer version's backup) are treated as other assets */
export function accountTypeInfo(type: string): AccountTypeInfo {
  return BY_TYPE.get(type as AccountType) ?? BY_TYPE.get('other_asset')!;
}

export function isLiabilityType(type: string): boolean {
  return accountTypeInfo(type).liability;
}

// The names below are in the App Language: a component that shows them calls
// `useTranslation()` so it re-renders when the language changes.

/** The type's name ("Checking"); a type this version doesn't know is shown as stored */
export function accountTypeLabel(type: string): string {
  const known = BY_TYPE.get(type as AccountType);
  return known ? t(`accounts:accountType.${known.value}`) : type;
}

/** The example shown under the type picker ("Everyday bank account") */
export function accountTypeHint(type: AccountType): string {
  return t(`accounts:accountTypeHint.${type}`);
}

/** The name of a group of account types ("Investments") */
export function accountTypeGroupLabel(group: AccountTypeGroup): string {
  return t(`accounts:accountTypeGroup.${group}`);
}
