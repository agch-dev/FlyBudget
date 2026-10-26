import { isCurrencyCode } from './currencies';
import { currencyCandidates, currencyTextKey, readCurrency } from './currencyText';
import {
  columnKeys,
  normalizeHeader,
  readImportAmount,
  type ColumnRole,
  type ImportSettings,
} from './csv';
import { sectionOf, type AccountSections } from './accountSections';
import type { AccountType } from '../types';

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
 * currency header ("Moneda", "Currency") or values that are all codes, symbols or whole
 * currency names (a word like "New" or "Pesos" alone needs the header). One with every cell
 * blank isn't one.
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
    return (
      distinct.length <= 20 &&
      distinct.every((v) => currencyCandidates(v, locales, { nameWords: false }).length)
    );
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

/**
 * Words that may stand beside a currency in the header of an amount column ("Importe US$",
 * "Amount (EUR)"), compared after `currencyTextKey`. Never "Saldo" or "Balance": a balance
 * column isn't one of transactions.
 */
const AMOUNT_WORDS = new Set(
  [
    'amount',
    'amt',
    'importe',
    'imp', // Imp. US$
    'monto',
    'valor',
    'betrag', // German
    'bedrag', // Dutch
    'montant', // French
    'importo', // Italian
    'belopp', // Swedish
    'beløb', // Danish
    'beløp', // Norwegian
    'kwota', // Polish
  ].map(currencyTextKey),
);

/**
 * The currencies an amount column's header names: a currency word plus, at most, an amount
 * word ("Pesos", "Dólares", "Importe US$", "Amount (EUR)"). Several for a word currencies share
 * ("Pesos"), none for any other header.
 */
export function headerCurrencies(header: string, locales?: readonly string[]): string[] {
  if (CURRENCY_HEADERS.has(normalizeHeader(header))) return []; // a currency column's
  const parts = currencyTextKey(header).split(' ').filter(Boolean);
  const readings = [
    parts,
    ...parts.flatMap((part, i) =>
      AMOUNT_WORDS.has(part) && parts.length > 1 ? [parts.filter((_, j) => j !== i)] : [],
    ),
  ];
  for (const words of readings) {
    const found = currencyCandidates(words.join(' '), locales);
    if (found.length) return found;
  }
  return [];
}

/** Whether every cell of a column with anything in it is an amount, and one has */
function holdsAmounts(rows: string[][], column: number): boolean {
  const values = rows.map((r) => r[column]?.trim() ?? '').filter(Boolean);
  return (
    values.length > 0 &&
    values.every(
      (v) => readImportAmount(v, 'dot') !== null || readImportAmount(v, 'comma') !== null,
    )
  );
}

/**
 * The roles with the file's currencies marked: columns of amounts named after a currency
 * (`Pesos`, `Dólares`) become `amount`, unless the saved settings say what they are; when there
 * are none, the currency column is marked `currency` (`markCurrencyColumn`). One amount column
 * per currency wins over a currency column.
 */
export function markCurrencyColumns(
  headers: string[],
  rows: string[][],
  roles: ColumnRole[],
  saved: Pick<ImportSettings, 'columns' | 'currencyColumn' | 'columnCurrencies'> | null,
  locales?: readonly string[],
): ColumnRole[] {
  const keys = columnKeys(headers);
  const named = (i: number) =>
    Object.hasOwn(saved?.columnCurrencies ?? {}, keys[i]) ||
    headerCurrencies(headers[i], locales).length > 0;
  const marked = roles.map((role, i) =>
    role === 'skip' &&
    !Object.hasOwn(saved?.columns ?? {}, keys[i]) &&
    named(i) &&
    holdsAmounts(rows, i)
      ? 'amount'
      : role,
  );
  return marked.some((role, i) => role === 'amount' && named(i))
    ? marked.map((role) => (role === 'currency' ? 'skip' : role))
    : markCurrencyColumn(headers, rows, roles, saved?.currencyColumn, locales);
}

/**
 * The currency of each amount column (by index), null where it isn't known: what the user
 * chose now, else what was saved for that column (by key), else what its header says, settled
 * by `context` when it could be several. Null for a file whose amount columns name no
 * currency: then it's read as one currency.
 */
export function amountColumnCurrencies(
  headers: string[],
  roles: ColumnRole[],
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
): Record<number, string | null> | null {
  const keys = columnKeys(headers);
  const found: Record<number, string | null> = {};
  let named = false;
  roles.forEach((role, i) => {
    if (role !== 'amount') return;
    const key = keys[i];
    if (Object.hasOwn(chosen, key) || (Object.hasOwn(saved, key) && isCurrencyCode(saved[key]))) {
      named = true;
      found[i] = Object.hasOwn(chosen, key) ? chosen[key] : saved[key];
      return;
    }
    const candidates = headerCurrencies(headers[i], locales);
    if (candidates.length) named = true;
    const around = candidates.filter((c) => context.includes(c));
    found[i] = candidates.length === 1 ? candidates[0] : around.length === 1 ? around[0] : null;
  });
  return named ? found : null;
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
  type: AccountType;
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
