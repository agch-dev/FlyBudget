import { isCurrencyCode } from './currencies';
import { currencyCandidates, currencyTextKey, readCurrency } from './currencyText';
import { columnKeys, normalizeHeader, type ColumnRole } from './csv';
import { sectionOf, type AccountSections } from './accountSections';

// A file whose rows are in more than one currency (card statements list purchases in pesos and
// dollars): an import brings in the account's currency, and the dialog offers to import the
// other currencies' rows into another account afterwards.

/** Headers of a column that says each row's currency, compared after `normalizeHeader` */
const CURRENCY_HEADERS = new Set(
  [
    'currency',
    'ccy',
    'moneda', // Spanish
    'divisa',
    'moeda', // Portuguese
    'währung', // German
    'devise', // French
    'valuta', // Italian, Dutch, Swedish
    'waluta', // Polish
    'měna', // Czech
  ].map(normalizeHeader),
);

/**
 * The column saying each row's currency, or -1: a column not mapped to anything else, with a
 * currency header ("Moneda", "Currency") or values that all name a currency. One with every
 * cell blank isn't one.
 */
export function findCurrencyColumn(
  headers: string[],
  rows: string[][],
  roles: ColumnRole[],
  locales?: readonly string[],
): number {
  return headers.findIndex((header, i) => {
    if (roles[i] !== 'skip') return false;
    const values = rows.map((r) => r[i]?.trim() ?? '').filter(Boolean);
    if (!values.length) return false;
    if (CURRENCY_HEADERS.has(normalizeHeader(header))) return true;
    const distinct = [...new Set(values)];
    return distinct.length <= 20 && distinct.every((v) => currencyCandidates(v, locales).length);
  });
}

/**
 * The roles with the currency column marked `currency` (it's saved as `skip`): the column
 * saved for this account (`saved`, its key) when this file has it, else the one found
 */
export function markCurrencyColumn(
  headers: string[],
  rows: string[][],
  roles: ColumnRole[],
  saved: string | undefined,
  locales?: readonly string[],
): ColumnRole[] {
  if (roles.includes('currency')) return roles;
  const savedIdx = saved === undefined ? -1 : columnKeys(headers).indexOf(saved);
  const idx =
    savedIdx !== -1 && roles[savedIdx] === 'skip'
      ? savedIdx
      : findCurrencyColumn(headers, rows, roles, locales);
  return idx === -1 ? roles : roles.map((role, i) => (i === idx ? 'currency' : role));
}

/** One value of the currency column: as first written, and how many rows have it */
export interface CurrencyValue {
  /** The same for every spelling (`currencyTextKey`) */
  key: string;
  text: string;
  count: number;
}

/** The different values of the currency column, in the order they first appear (no blanks) */
export function currencyValues(rows: string[][], column: number): CurrencyValue[] {
  const found = new Map<string, CurrencyValue>();
  for (const row of rows) {
    const text = row[column]?.trim() ?? '';
    const key = currencyTextKey(text);
    if (!key) continue;
    const value = found.get(key);
    if (value) value.count++;
    else found.set(key, { key, text, count: 1 });
  }
  return [...found.values()];
}

/**
 * The currency each value means (by key), null where it isn't known: what the user chose
 * now, else what they chose for this account's last file (`saved`, as written), else what the
 * text says, settled by `context` when it could be several
 */
export function currencyMapping(
  values: CurrencyValue[],
  {
    context,
    saved = {},
    chosen = {},
    locales,
  }: {
    context: readonly string[];
    saved?: Record<string, string>;
    chosen?: Record<string, string>;
    locales?: readonly string[];
  },
): Record<string, string | null> {
  const savedByKey = new Map(
    Object.entries(saved)
      .filter(([, code]) => isCurrencyCode(code))
      .map(([text, code]) => [currencyTextKey(text), code]),
  );
  return Object.fromEntries(
    values.map(({ key, text }) => [
      key,
      (Object.hasOwn(chosen, key) ? chosen[key] : null) ??
        savedByKey.get(key) ??
        readCurrency(text, context, locales),
    ]),
  );
}

/** What choosing where a currency's rows go needs from an account */
export interface ImportAccount {
  id: string;
  type: string;
  /** Its own or the budget's (null while neither is chosen) */
  currency: string | null;
  closedAt: string | null;
}

const sameSection = (sections: AccountSections, a: string, b: string) => {
  const name = sectionOf(sections, a)?.toLowerCase();
  return !!name && sectionOf(sections, b)?.toLowerCase() === name;
};

/**
 * The currencies around an import, which settle a word several currencies share: the
 * account's own and those of the accounts in its Account Section
 */
export function currencyContext(
  accountId: string,
  accounts: readonly ImportAccount[],
  sections: AccountSections,
): string[] {
  const codes = accounts
    .filter((a) => a.id === accountId || sameSection(sections, accountId, a.id))
    .map((a) => a.currency)
    .filter((c): c is string => !!c);
  return [...new Set(codes)];
}

/**
 * The accounts a currency's rows can be imported into after importing into `accountId`, and
 * the one to suggest: the only open account in that currency of the same type in the same
 * Account Section (the card's other side). Null otherwise, so nothing goes to a guessed account.
 */
export function followUpAccounts<A extends ImportAccount>(
  accountId: string,
  accounts: readonly A[],
  currency: string,
  sections: AccountSections,
): { options: A[]; defaultId: string | null } {
  const into = accounts.find((a) => a.id === accountId);
  const options = accounts.filter(
    (a) => a.id !== accountId && a.currency === currency && !a.closedAt,
  );
  const fits = into
    ? options.filter((a) => a.type === into.type && sameSection(sections, accountId, a.id))
    : [];
  return { options, defaultId: fits.length === 1 ? fits[0].id : null };
}
