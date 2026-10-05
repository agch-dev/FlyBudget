import { currentLanguage, t } from '../i18n';

// The server's error text is English and stays English. The few errors a user realistically
// hits are translated here, recognized by route and status (the server has no error codes).
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
  /** The sentence in the current language */
  text: () => string;
}

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
  return known ? known.text() : refusal.message;
}
