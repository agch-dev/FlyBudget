import { currentLanguage, t } from '../i18n';
import { en } from '../i18n/catalog';

// The server's error text is English and stays English. The few errors a user realistically
// hits are translated here, recognized by route and status (the server has no error codes),
// and by the sentence itself where a route refuses for several reasons with one status.
// Everything else is shown as the server sent it.

export interface ServerRefusal {
  /** The request's method, upper case */
  method: string;
  /** The path below /api, with its query string if any: `/accounts/abc` */
  path: string;
  status: number;
  /** The server's English message */
  message: string;
}

interface TranslatedError {
  method?: string;
  /** Matched against the path without its query string */
  path: RegExp;
  status: number;
  /**
   * The sentence in the current language. A route that refuses with one of several sentences
   * picks by the server's message, and answers null for one it doesn't know.
   */
  text: (message: string) => string | null;
}

/** The locks on an account's currency (`CURRENCY_LOCK_MESSAGE` on the server) */
const CURRENCY_LOCKS = ['transactions', 'recurring', 'goal'] as const;

function currencyLocked(message: string): string | null {
  const lock = CURRENCY_LOCKS.find(
    (l) => t(`accounts:errors.currencyLocked.${l}`, { lng: 'en' }) === message,
  );
  return lock ? t(`accounts:errors.currencyLocked.${lock}`) : null;
}

/** "New password must be 8-256 characters" (POST /auth/change-password) */
function passwordLength(message: string): string | null {
  const match = /^New password must be (\d+)-(\d+) characters$/.exec(message);
  return match ? t('auth:errors.passwordLength', { min: match[1], max: match[2] }) : null;
}

const TRANSACTION = /^\/transactions\/[^/]+$/;
const LINK_TRANSFER = /^\/transactions\/[^/]+\/link-transfer$/;
const UNLINK_TRANSFER = /^\/transactions\/[^/]+\/unlink-transfer$/;
const NEW_TRANSFER = /^\/transactions\/transfer$/;

type TransactionError = keyof (typeof en)['transactions']['errors'];

/**
 * The refusals of a transactions route, recognized by their sentence: the English text of
 * each key is the server's own (`serverErrors.test.ts` looks for each in the server's code).
 */
const transactionRefusal =
  (...keys: TransactionError[]) =>
  (message: string): string | null => {
    const key = keys.find((k) => en.transactions.errors[k] === message);
    return key ? t(`transactions:errors.${key}`) : null;
  };

/**
 * The first match wins. To translate another error, add a line: its route, its status, and
 * a catalog key whose English is the server's own sentence.
 */
const TRANSLATED: TranslatedError[] = [
  {
    method: 'POST',
    path: /^\/auth\/login$/,
    status: 401,
    text: () => t('auth:errors.incorrectPassword'),
  },
  {
    method: 'POST',
    path: /^\/auth\/setup$/,
    status: 403,
    text: () => t('auth:errors.incorrectSetupCode'),
  },
  {
    method: 'POST',
    path: /^\/auth\/change-password$/,
    status: 401,
    text: () => t('auth:errors.incorrectCurrentPassword'),
  },
  {
    method: 'POST',
    path: /^\/auth\/change-password$/,
    status: 400,
    text: passwordLength,
  },
  // The limit on failed attempts (login, setup, password changes)
  { path: /^\/auth\//, status: 429, text: () => t('auth:errors.tooManyAttempts') },
  // The limits on bank requests (bankRateLimit) and on refreshing exchange rates
  { path: /^\/(plaid|simplefin)\//, status: 429, text: () => t('settings:errors.bankRateLimit') },
  {
    method: 'POST',
    path: /^\/exchange-rates\/refresh$/,
    status: 429,
    text: () => t('settings:errors.ratesRefreshLimit'),
  },
  // Changing the currency of an account something depends on
  { method: 'PUT', path: /^\/accounts\/[^/]+$/, status: 409, text: currencyLocked },
  // Linking two transactions as a transfer (server: services/transferLink.ts), and unlinking
  {
    method: 'POST',
    path: LINK_TRANSFER,
    status: 400,
    text: transactionRefusal(
      'splitCannotLink',
      'alreadyTransfer',
      'differentAccounts',
      'outflowAndInflow',
      'sameAmount',
    ),
  },
  { method: 'POST', path: UNLINK_TRANSFER, status: 400, text: transactionRefusal('notTransfer') },
  // A new transfer
  {
    method: 'POST',
    path: NEW_TRANSFER,
    status: 400,
    text: transactionRefusal('arrivingAmountNeeded', 'sameAmountBothSides'),
  },
  // Editing a transaction (server: PUT /transactions/:id)
  {
    method: 'PUT',
    path: TRANSACTION,
    status: 400,
    text: transactionRefusal(
      'otherCurrencyAccount',
      'transferSideLeaving',
      'transferSideArriving',
      'transferStays',
      'editParts',
      'editWholeSplit',
    ),
  },
  {
    method: 'POST',
    path: /^\/transactions$/,
    status: 400,
    text: transactionRefusal('splitsMustAddUp'),
  },
  // A reconciled transaction can't be changed, whatever the request
  { path: /^\/transactions\//, status: 403, text: transactionRefusal('reconciled') },
];

/**
 * What to show for an error the server answered with: its own message in English, and in
 * another language the translation when it is one of the errors listed above.
 */
export function serverErrorMessage(refusal: ServerRefusal): string {
  if (currentLanguage() === 'en') return refusal.message;
  const path = refusal.path.split('?')[0];
  const known = TRANSLATED.find(
    (e) =>
      e.status === refusal.status &&
      (!e.method || e.method === refusal.method) &&
      e.path.test(path),
  );
  return known?.text(refusal.message) ?? refusal.message;
}
