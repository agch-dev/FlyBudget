import { z } from 'zod';
import { isCurrencyCode } from './currencies.js';

// How an account's bank writes its CSV files, remembered from the last import (keep in sync
// with `ImportSettings` in client/src/utils/csv.ts)

export const CSV_ENCODINGS = [
  'auto',
  'utf-8',
  'utf-16le',
  'utf-16be',
  'windows-1252',
  'windows-1250',
  'iso-8859-2',
] as const;

const COLUMN_ROLES = [
  'date',
  'payee',
  'amount',
  'inflow',
  'outflow',
  'direction',
  'notes',
  'skip',
] as const;

/**
 * An object read as [key, value] pairs and rebuilt with Object.fromEntries, which keeps any key
 * as written: a record schema assigns keys one by one, and assigning a key named "__proto__"
 * changes the object's prototype instead
 */
const entries = <V extends z.ZodType>(key: z.ZodString, value: V, max: number, what: string) =>
  z
    .preprocess(
      (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : v),
      z.array(z.tuple([key, value])).max(max, `Too many ${what}`),
    )
    .transform((pairs): Record<string, z.infer<V>> => Object.fromEntries(pairs));

const currencyCode = z.string().refine(isCurrencyCode, 'Not a currency');

/**
 * Upstream's settings (dtymoszenko/FlyBudget), unchanged: a backup taken here must still read on
 * plain upstream, which forgets all of an account's CSV settings over one column role it
 * doesn't know. Never add roles to `columns`; give a column a new meaning in a key of its own.
 */
const upstreamImportSettingsSchema = z.object({
  delimiter: z.enum([',', ';', '\t']),
  encoding: z.enum(CSV_ENCODINGS),
  /** Rows above the header (account details some banks put first) */
  skipRows: z.number().int().min(0).max(1000),
  /**
   * Column header → what it holds. Read as [header, role] pairs and rebuilt with
   * Object.fromEntries, which keeps any header as written: a record schema assigns keys one by
   * one, and assigning a header named "__proto__" changes the object's prototype instead.
   */
  columns: z
    .preprocess(
      (value) =>
        value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : value,
      z.array(z.tuple([z.string().max(200), z.enum(COLUMN_ROLES)])).max(200, 'Too many columns'),
    )
    .transform((pairs): Record<string, (typeof COLUMN_ROLES)[number]> => Object.fromEntries(pairs)),
  dateFormat: z.enum(['mdy', 'dmy', 'ymd']).nullable(),
  numberFormat: z.enum(['dot', 'comma']).nullable(),
  /** What the direction column says for money going out, if not a word FlyBudget knows */
  outWord: z.string().trim().max(50).nullable(),
});

/**
 * Upstream's settings plus this branch's own keys, all optional: upstream drops them when it
 * reads or re-saves the settings, so a missing key means "not known, guess or ask". Add each
 * new key's values to `EXTRA_KEYS` in routes/importSettingsRoundTrip.test.ts.
 */
export const importSettingsSchema = upstreamImportSettingsSchema.extend({
  /** The column (its key in `columns`, where it's `skip`) saying each row's currency */
  currencyColumn: z.string().max(200).optional(),
  /** What that column's values mean: the value as written → ISO code */
  currencyNames: entries(z.string().max(100), currencyCode, 200, 'currencies').optional(),
  /** Amount columns that each hold one currency (`Pesos`, `Dólares`): column key → ISO code */
  columnCurrencies: entries(z.string().max(200), currencyCode, 200, 'columns').optional(),
});

export type ImportSettings = z.infer<typeof importSettingsSchema>;

/**
 * The account number (IBAN, or the bank's own id) the last bank statement imported into this
 * account was for, so a statement for another account can be noticed. Stored with the CSV
 * settings, in the same column, but saved on its own.
 */
export const statementAccountSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().min(1).max(100));

function parseStored(stored: string | null): Record<string, unknown> | null {
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Stored settings, or null if there are none or they don't fit the current shape */
export function readImportSettings(stored: string | null): ImportSettings | null {
  const parsed = importSettingsSchema.safeParse(parseStored(stored));
  return parsed.success ? parsed.data : null;
}

/** The stored statement account, or null if there is none or it doesn't fit */
export function readStatementAccount(stored: string | null): string | null {
  const parsed = statementAccountSchema.safeParse(parseStored(stored)?.statementAccount);
  return parsed.success ? parsed.data : null;
}

/** What to store: new CSV settings and/or statement account, keeping the other one */
export function storeImportSettings(
  stored: string | null,
  change: { settings?: ImportSettings; statementAccount?: string },
): string {
  const settings = change.settings ?? readImportSettings(stored);
  const statementAccount = change.statementAccount ?? readStatementAccount(stored);
  return JSON.stringify({ ...settings, ...(statementAccount ? { statementAccount } : {}) });
}
