import { CURRENCY_CODES } from './currencies';

// Reading which currency some text names ("USD", "US$", "€", "Pesos", "Dólares"), for a file's
// currency column and its headers. Text several currencies share ("$", "pesos", "kr") is
// settled only by the currencies around the import, never by a country written into the code.

/**
 * The words of some text as they're compared: lowercase, without accents or dots, split at
 * spaces, dashes and brackets
 */
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, '')
    .split(/[\s\-–—_()/,]+/)
    .filter(Boolean);
}

/** A word, and what it could be without a plural ending: dollars, pesos, dólares, reales */
const singulars = (word: string) => [
  word,
  ...(word.endsWith('s') ? [word.slice(0, -1)] : []),
  ...(word.endsWith('es') ? [word.slice(0, -2)] : []),
];

/** Every way of reading these words with or without plural endings, joined */
function keys(parts: string[]): string[] {
  if (parts.length > 6) return []; // no currency's name is that long
  return parts.reduce<string[]>(
    (acc, word) => acc.flatMap((head) => singulars(word).map((w) => head + w)),
    [''],
  );
}

/** Spellings banks use that Intl doesn't give */
const EXTRA_SYMBOLS: Record<string, string> = { u$s: 'USD', u$d: 'USD' };

/** The shortest word of a currency's name that is read on its own ("Peso", not "US") */
const MIN_WORD_LENGTH = 3;

const intlSymbol = (locale: string, currency: string, display: 'symbol' | 'narrowSymbol') => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: display })
      .formatToParts(1)
      .find((p) => p.type === 'currency')?.value;
  } catch {
    return undefined;
  }
};

const intlName = (locale: string, currency: string) => {
  try {
    return new Intl.DisplayNames(locale, { type: 'currency' }).of(currency);
  } catch {
    return undefined;
  }
};

type Index = Map<string, Set<string>>;

/** Text → the currencies it may name: as a symbol or whole name, and as one word of a name */
type Indexes = { whole: Index; words: Index };

const indexes = new Map<string, Indexes>();

/** The indexes for these languages (built once per set) */
function indexFor(locales: readonly string[]): Indexes {
  const id = locales.join(',');
  let found = indexes.get(id);
  if (found) return found;
  found = { whole: new Map(), words: new Map() };
  const addTo = (index: Index, key: string, code: string) => {
    if (!key) return;
    const codes = index.get(key) ?? new Set();
    codes.add(code);
    index.set(key, codes);
  };
  const add = (key: string, code: string) => addTo(found!.whole, key, code);
  for (const code of CURRENCY_CODES) {
    for (const locale of locales) {
      for (const display of ['symbol', 'narrowSymbol'] as const) {
        const symbol = intlSymbol(locale, code, display);
        if (symbol) add(words(symbol).join(''), code);
        // A dollar written with its country, as CA$ is: US$, AU$, NZ$
        if (symbol === '$') add(`${code.slice(0, 2).toLowerCase()}$`, code);
      }
      const name = intlName(locale, code);
      if (!name || name === code) continue;
      const parts = words(name);
      add(parts.join(''), code);
      // A word of the name alone: "Peso" is every peso, "Euro" the euro
      for (const part of parts) {
        if (part.length >= MIN_WORD_LENGTH) addTo(found.words, part, code);
      }
    }
  }
  for (const [symbol, code] of Object.entries(EXTRA_SYMBOLS)) add(symbol, code);
  indexes.set(id, found);
  return found;
}

const deviceLocales = (): string[] => {
  const device = typeof navigator === 'undefined' ? undefined : navigator.language;
  return device && device !== 'en' ? ['en', device] : ['en'];
};

/**
 * Every currency some text could name: one for "UYU" or "US Dollars", several for "$" or
 * "pesos", none for anything else. Names are read in English and `locales` (by default the
 * device's language); case, accents, dots, spaces and plurals don't matter. `nameWords: false`
 * reads only codes, symbols and whole names, not one word of a name ("Peso", "Central").
 */
export function currencyCandidates(
  text: string,
  locales: readonly string[] = deviceLocales(),
  { nameWords = true }: { nameWords?: boolean } = {},
): string[] {
  const parts = words(text);
  if (!parts.length) return [];
  const joined = parts.join('').toUpperCase();
  if (CURRENCY_CODES.includes(joined)) return [joined];
  const { whole, words: byWord } = indexFor(locales);
  const found = new Set<string>();
  for (const key of keys(parts)) {
    for (const code of whole.get(key) ?? []) found.add(code);
    if (nameWords) for (const code of byWord.get(key) ?? []) found.add(code);
  }
  return [...found].sort();
}

/**
 * The currency some text names, or null when it names none or could be several. `context`
 * (the currencies of the account being imported into and of the accounts in its Account
 * Section) settles text several currencies share, but only when exactly one of them is there.
 */
export function readCurrency(
  text: string,
  context: readonly string[],
  locales?: readonly string[],
): string | null {
  const candidates = currencyCandidates(text, locales);
  if (candidates.length === 1) return candidates[0];
  const around = candidates.filter((c) => context.includes(c));
  return around.length === 1 ? around[0] : null;
}

/** What two spellings of one currency value have in common ("Pesos" and "PESOS.") */
export const currencyTextKey = (text: string) => words(text).join(' ');
