// How the server learns this device's App Language (server/src/utils/language.ts reads it).
// It uses it to name what the app supplies (Default Categories, the "Overview" dashboard) and
// to write files; a request that names none gets English.
import { currentLanguage } from '../i18n';

const LANGUAGE_HEADER = 'X-FlyBudget-Language';
const LANGUAGE_QUERY = 'lang';

/** The header every API request carries */
export const languageHeaders = (): Record<string, string> => ({
  [LANGUAGE_HEADER]: currentLanguage(),
});

/** A file download's address with the language in it: a plain navigation can't set a header */
export function withLanguage(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${LANGUAGE_QUERY}=${currentLanguage()}`;
}
