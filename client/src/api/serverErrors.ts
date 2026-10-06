import { currentLanguage, t } from '../i18n';
import type { en } from '../i18n/catalog';

// The server's error text is English and stays English. A refusal the user can do something
// about also carries a code (and the values its sentence needs), and the app says those in
// the App Language: `{ error, code, params? }`. The server's list of codes is
// `server/src/utils/refusals.ts`; `serverErrors.test.ts` holds this map to exactly that list.

/** What the server answered a refused request with */
export interface ServerRefusal {
  /** The server's English sentence, when it sent one (a validation failure sends none) */
  error?: string;
  /** The refusal's code, when it has one */
  code?: string;
  /** The values the sentence needs, by name */
  params?: Record<string, string | number>;
}

type Catalog = typeof en;
/** The keys below an object of the catalog, joined with dots */
type Dotted<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Dotted<T[K]>}`;
}[keyof T & string];
type WithErrors = {
  [N in keyof Catalog]: Catalog[N] extends { errors: object } ? N : never;
}[keyof Catalog];
/** A sentence in a namespace's `errors`: a key that isn't in the English catalog fails `tsc` */
type RefusalKey = {
  [N in WithErrors]: `${N}:errors.${Dotted<Catalog[N]['errors']>}`;
}[WithErrors];

/** `t`, for a key checked above and the values the server sent */
const say = t as (key: RefusalKey, values: Record<string, string | number>) => string;

/**
 * Each code's sentence in the catalogs. To add one: the code on the server's list, a line
 * here, and the key in the English and the Spanish catalog (the English is the server's own
 * sentence, with `{{placeholders}}` named like the code's params).
 */
export const REFUSAL_KEYS = {
  // Sign-in
  incorrect_password: 'auth:errors.incorrectPassword',
  incorrect_current_password: 'auth:errors.incorrectCurrentPassword',
  incorrect_setup_code: 'auth:errors.incorrectSetupCode',
  password_length: 'auth:errors.passwordLength',
  password_already_set: 'auth:errors.passwordAlreadySet',
  too_many_attempts: 'auth:errors.tooManyAttempts',
  // Rate limits
  bank_rate_limit: 'settings:errors.bankRateLimit',
  rates_refresh_limit: 'settings:errors.ratesRefreshLimit',
  // Accounts
  currency_locked_transactions: 'accounts:errors.currencyLocked.transactions',
  currency_locked_recurring: 'accounts:errors.currencyLocked.recurring',
  currency_locked_goal: 'accounts:errors.currencyLocked.goal',
  // Transactions
  transaction_reconciled: 'transactions:errors.reconciled',
  split_edit_parts: 'transactions:errors.editParts',
  split_amount_fixed: 'transactions:errors.editWholeSplit',
  split_total_mismatch: 'transactions:errors.splitsMustAddUp',
  transfer_no_category: 'transactions:errors.transferStays',
  account_other_currency: 'transactions:errors.otherCurrencyAccount',
  // Transfers
  not_a_transfer: 'transactions:errors.notTransfer',
  transfer_needs_arriving_amount: 'transactions:errors.arrivingAmountNeeded',
  transfer_same_amount: 'transactions:errors.sameAmountBothSides',
  transfer_side_leaving: 'transactions:errors.transferSideLeaving',
  transfer_side_arriving: 'transactions:errors.transferSideArriving',
  link_split: 'transactions:errors.splitCannotLink',
  link_already_transfer: 'transactions:errors.alreadyTransfer',
  link_different_accounts: 'transactions:errors.differentAccounts',
  link_outflow_and_inflow: 'transactions:errors.outflowAndInflow',
  link_same_amount: 'transactions:errors.sameAmount',
  // Backup
  not_a_backup: 'settings:errors.notABackup',
  backup_newer_version: 'settings:errors.backupNewerVersion',
  backup_inconsistent: 'settings:errors.backupInconsistent',
  backup_row_invalid: 'settings:errors.backupRowInvalid',
  // Import
  import_too_many_rows: 'import:errors.tooManyRows',
  // Banks
  simplefin_invalid_token: 'settings:errors.simplefinInvalidToken',
  simplefin_token_used: 'settings:errors.simplefinTokenUsed',
  simplefin_invalid_url: 'settings:errors.simplefinInvalidUrl',
  simplefin_subscription_required: 'settings:errors.simplefinSubscriptionRequired',
  simplefin_access_denied: 'settings:errors.simplefinAccessDenied',
  simplefin_bad_response: 'settings:errors.simplefinBadResponse',
  simplefin_unreachable: 'settings:errors.simplefinUnreachable',
  bank_address_refused: 'settings:errors.bankAddressRefused',
  plaid_not_configured: 'settings:errors.plaidNotConfigured',
  plaid_link_failed: 'settings:errors.plaidLinkFailed',
  plaid_revoke_failed: 'settings:errors.plaidRevokeFailed',
  sync_failed: 'settings:errors.syncFailed',
  // Exchange rates
  rates_refresh_failed: 'settings:errors.ratesRefreshFailed',
  rates_fetching_off: 'settings:errors.ratesFetchingOff',
  rate_date_in_future: 'settings:errors.rateDateInFuture',
  // Rules
  rule_regex_invalid: 'rules:errors.regexInvalid',
  rule_regex_too_long: 'rules:errors.regexTooLong',
  // Other
  last_dashboard: 'reports:errors.lastDashboard',
  pick_another_category: 'settings:errors.pickAnotherCategory',
  recurring_other_currency: 'recurring:errors.otherCurrency',
  recurring_transfer_other_currency: 'recurring:errors.transferOtherCurrency',
  recurring_no_account: 'recurring:errors.noAccount',
  recurring_nothing_pending: 'recurring:errors.nothingPending',
} as const satisfies Record<string, RefusalKey>;

export type RefusalCode = keyof typeof REFUSAL_KEYS;

const isKnownCode = (code: string | undefined): code is RefusalCode =>
  code !== undefined && Object.hasOwn(REFUSAL_KEYS, code);

/** Whether the app has a sentence of its own for this refusal */
export const isTranslated = (refusal: ServerRefusal) => isKnownCode(refusal.code);

/**
 * What to show for a request the server refused. In English, the server's own sentence as
 * sent, or `fallback` when it sent none. In another language, the catalog's sentence for the
 * refusal's code, and one generic sentence for a refusal without a code the app knows.
 */
export function refusalMessage(refusal: ServerRefusal, fallback?: string): string {
  if (currentLanguage() === 'en') return refusal.error ?? fallback ?? t('errors.actionFailed');
  return isKnownCode(refusal.code)
    ? say(REFUSAL_KEYS[refusal.code], refusal.params ?? {})
    : t('errors.actionFailed');
}
