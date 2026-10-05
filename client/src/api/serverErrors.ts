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
  /** The server's sentence, for a route with several refusals of the same status */
  message?: string;
  /** The sentence in the current language */
  text: () => string;
}

const TRANSACTION = /^\/transactions\/[^/]+$/;
const LINK_TRANSFER = /^\/transactions\/[^/]+\/link-transfer$/;
const UNLINK_TRANSFER = /^\/transactions\/[^/]+\/unlink-transfer$/;
const NEW_TRANSFER = /^\/transactions\/transfer$/;

type TransactionError = keyof (typeof en)['transactions']['errors'];

/**
 * A refusal recognized by its sentence, which is the English text of its catalog key (so
 * the two can't drift apart: `serverErrors.test.ts` looks for each in the server's code).
 */
const sentence = (
  method: string,
  path: RegExp,
  status: number,
  key: TransactionError,
): TranslatedError => ({
  method,
  path,
  status,
  message: en.transactions.errors[key],
  text: () => t(`transactions:errors.${key}`),
});

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
  // The limit on failed attempts (login, setup, password changes)
  { path: /^\/auth\//, status: 429, text: () => t('auth:errors.tooManyAttempts') },
  // Linking two transactions as a transfer (server: services/transferLink.ts), and unlinking
  sentence('POST', LINK_TRANSFER, 403, 'reconciled'),
  sentence('POST', LINK_TRANSFER, 400, 'splitCannotLink'),
  sentence('POST', LINK_TRANSFER, 400, 'alreadyTransfer'),
  sentence('POST', LINK_TRANSFER, 400, 'differentAccounts'),
  sentence('POST', LINK_TRANSFER, 400, 'outflowAndInflow'),
  sentence('POST', LINK_TRANSFER, 400, 'sameAmount'),
  sentence('POST', UNLINK_TRANSFER, 403, 'reconciled'),
  sentence('POST', UNLINK_TRANSFER, 400, 'notTransfer'),
  // A new transfer
  sentence('POST', NEW_TRANSFER, 400, 'arrivingAmountNeeded'),
  sentence('POST', NEW_TRANSFER, 400, 'sameAmountBothSides'),
  // Editing a transaction (server: PUT /transactions/:id)
  sentence('PUT', TRANSACTION, 403, 'reconciled'),
  sentence('PUT', TRANSACTION, 400, 'otherCurrencyAccount'),
  sentence('PUT', TRANSACTION, 400, 'transferSideLeaving'),
  sentence('PUT', TRANSACTION, 400, 'transferSideArriving'),
  sentence('PUT', TRANSACTION, 400, 'transferStays'),
  sentence('PUT', TRANSACTION, 400, 'editParts'),
  sentence('PUT', TRANSACTION, 400, 'editWholeSplit'),
  sentence('DELETE', TRANSACTION, 403, 'reconciled'),
  sentence('POST', /^\/transactions$/, 400, 'splitsMustAddUp'),
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
      (e.message === undefined || e.message === refusal.message) &&
      e.path.test(path),
  );
  return known ? known.text() : refusal.message;
}
