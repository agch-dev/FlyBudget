// Refusals a user can cause from the UI and do something about carry a stable code, so the
// client can say them in the App Language: `{ error, code, params? }`. `error` stays the
// English sentence; `params` are the values the sentence needs.
//
// This is the one list of codes. Each names the params it is sent with. The client maps
// every code to a catalog key (`client/src/api/serverErrors.ts`), and its test fails when the
// two lists differ. Nothing secret goes in params: no paths, tokens, URLs or hashes.
//
// No imports here: the client's test reads this file, and the demo's worker bundles it.

export const REFUSALS = {
  // Sign-in
  incorrect_password: [],
  incorrect_current_password: [],
  incorrect_setup_code: [],
  password_length: ['min', 'max'],
  password_already_set: [],
  too_many_attempts: [],
  // Rate limits
  bank_rate_limit: [],
  rates_refresh_limit: [],
  // Accounts
  currency_locked_transactions: [],
  currency_locked_recurring: [],
  currency_locked_goal: [],
  // Transactions
  transaction_reconciled: [],
  split_edit_parts: [],
  split_amount_fixed: [],
  split_total_mismatch: [],
  transfer_no_category: [],
  account_other_currency: [],
  // Transfers
  not_a_transfer: [],
  transfer_needs_arriving_amount: [],
  transfer_same_amount: [],
  transfer_side_leaving: [],
  transfer_side_arriving: [],
  link_split: [],
  link_already_transfer: [],
  link_different_accounts: [],
  link_outflow_and_inflow: [],
  link_same_amount: [],
  // Backup
  not_a_backup: [],
  backup_newer_version: [],
  backup_inconsistent: [],
  backup_row_invalid: ['row', 'table'],
  // Import
  import_too_many_rows: ['max'],
  // Banks
  simplefin_invalid_token: [],
  simplefin_token_used: [],
  simplefin_invalid_url: [],
  simplefin_subscription_required: [],
  simplefin_access_denied: [],
  simplefin_bad_response: [],
  simplefin_unreachable: [],
  bank_address_refused: [],
  plaid_not_configured: [],
  plaid_link_failed: [],
  plaid_revoke_failed: [],
  sync_failed: [],
  // Exchange rates
  rates_refresh_failed: [],
  rates_fetching_off: [],
  rate_date_in_future: [],
  // Rules
  rule_regex_invalid: [],
  rule_regex_too_long: ['max'],
  // Other
  last_dashboard: [],
  pick_another_category: [],
  recurring_other_currency: [],
  recurring_transfer_other_currency: [],
  recurring_no_account: [],
  recurring_nothing_pending: [],
} as const satisfies Record<string, readonly string[]>;

export type RefusalCode = keyof typeof REFUSALS;

export const REFUSAL_CODES = Object.keys(REFUSALS) as RefusalCode[];

/** The values a code's sentence needs, by name */
export type RefusalParams<C extends RefusalCode> = {
  [K in (typeof REFUSALS)[C][number]]: string | number;
};

/** What a coded refusal answers with */
export interface Refusal<C extends RefusalCode = RefusalCode> {
  /** The sentence in English, as the server has always sent it */
  error: string;
  code: C;
  params?: Record<string, string | number>;
}

type ParamsArg<C extends RefusalCode> = (typeof REFUSALS)[C]['length'] extends 0
  ? []
  : [params: RefusalParams<C>];

/** The body of a coded refusal: `res.status(400).json(refusal('last_dashboard', '…'))` */
export function refusal<C extends RefusalCode>(
  code: C,
  error: string,
  ...[params]: ParamsArg<C>
): Refusal<C> {
  return params ? { error, code, params } : { error, code };
}

/**
 * For a schema check whose failure is a coded refusal:
 * `.refine(isValidRegex, coded(refusal('rule_regex_invalid', '…')))`. `validationRefusal`
 * finds it when the body doesn't parse.
 */
export const coded = (r: Refusal) => ({ message: r.error, params: { refusal: r } });

interface Issue {
  code?: string;
  params?: Record<string, unknown>;
}

/** The first coded refusal among a failed parse's issues, if any (see `coded`) */
export function validationRefusal(issues: readonly Issue[]): Refusal | undefined {
  for (const issue of issues) {
    const found = issue.params?.refusal as Refusal | undefined;
    if (found && typeof found.code === 'string' && found.code in REFUSALS) return found;
  }
  return undefined;
}

/** An error thrown for a reason the user can act on: the route answers with its refusal */
export class RefusalError extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.error);
  }
}
