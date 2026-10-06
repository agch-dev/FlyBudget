// The language of a request: the App Language of the device that sent it (GLOSSARY.md).
// The server uses it for two things only: naming Default Categories and the "Overview"
// dashboard (services/defaultNames.ts), and writing files. Its error text stays English.

export const LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

/** What a request that names no language, or one the app doesn't have, gets */
export const DEFAULT_LANGUAGE: Language = 'en';

/** The header `apiFetch` sends with every request (client/src/api/client.ts) */
export const LANGUAGE_HEADER = 'X-FlyBudget-Language';
/** The same, for file downloads: plain navigations, which can't set a header */
export const LANGUAGE_QUERY = 'lang';

/** Both Express's request and the demo's (browser/expressShim.ts) have these */
interface LanguageRequest {
  get(name: string): string | undefined;
  query: Record<string, unknown>;
}

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/**
 * The language a request asks for: its header, else its `lang` query parameter, else English.
 * Never refuses: anything missing or unknown is English.
 */
export function requestLanguage(req: LanguageRequest): Language {
  const header = req.get(LANGUAGE_HEADER);
  if (isLanguage(header)) return header;
  const query = req.query[LANGUAGE_QUERY];
  return isLanguage(query) ? query : DEFAULT_LANGUAGE;
}
