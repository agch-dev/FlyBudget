import type { Language } from './language';
import enAccounts from './en/accounts';
import enAuth from './en/auth';
import enBudget from './en/budget';
import enCashFlow from './en/cashFlow';
import enCommon from './en/common';
import enConnection from './en/connection';
import enGoals from './en/goals';
import enImport from './en/import';
import enPayees from './en/payees';
import enRecurring from './en/recurring';
import enReports from './en/reports';
import enRules from './en/rules';
import enSettings from './en/settings';
import enTransactions from './en/transactions';
import esAccounts from './es/accounts';
import esAuth from './es/auth';
import esBudget from './es/budget';
import esCashFlow from './es/cashFlow';
import esCommon from './es/common';
import esConnection from './es/connection';
import esGoals from './es/goals';
import esImport from './es/import';
import esPayees from './es/payees';
import esRecurring from './es/recurring';
import esReports from './es/reports';
import esRules from './es/rules';
import esSettings from './es/settings';
import esTransactions from './es/transactions';

// The catalogs: every piece of the app's own text, by language and namespace (one namespace
// per area of the app). English is the source: its keys are the ones code can use.

/**
 * The shape of a translation of an English namespace: the same keys, any text. Every key is
 * optional (a missing one shows in English), but one English doesn't have fails the type
 * check. `catalog.test.ts` is what fails when a key is missing.
 */
export type Translation<T> = {
  [K in keyof T]?: T[K] extends string ? string : Translation<T[K]>;
};

export const en = {
  common: enCommon,
  auth: enAuth,
  connection: enConnection,
  accounts: enAccounts,
  transactions: enTransactions,
  payees: enPayees,
  import: enImport,
  budget: enBudget,
  reports: enReports,
  cashFlow: enCashFlow,
  recurring: enRecurring,
  rules: enRules,
  goals: enGoals,
  settings: enSettings,
};

export type Namespace = keyof typeof en;

const es: { [N in Namespace]: Translation<(typeof en)[N]> } = {
  common: esCommon,
  auth: esAuth,
  connection: esConnection,
  accounts: esAccounts,
  transactions: esTransactions,
  payees: esPayees,
  import: esImport,
  budget: esBudget,
  reports: esReports,
  cashFlow: esCashFlow,
  recurring: esRecurring,
  rules: esRules,
  goals: esGoals,
  settings: esSettings,
};

export const CATALOGS: Record<Language, Record<Namespace, object>> = { en, es };

export const NAMESPACES = Object.keys(en) as Namespace[];

/** The namespace a key belongs to when it names none (`t('nav.accounts')`) */
export const DEFAULT_NAMESPACE = 'common' satisfies Namespace;

/** Every key of a namespace, as dotted paths (`banner.waiting_one`), sorted. */
export function catalogKeys(catalog: object, prefix = ''): string[] {
  return Object.entries(catalog)
    .flatMap(([key, value]) =>
      typeof value === 'string' ? [prefix + key] : catalogKeys(value, `${prefix}${key}.`),
    )
    .sort();
}
