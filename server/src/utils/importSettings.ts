import { z } from 'zod';

// How an account's bank files are read, remembered from its last import so every device
// opens the next one with the same choices. The shape is `ImportMemory` in
// client/src/utils/csv.ts (keep the two in sync: client/src/utils/importMemory.test.ts
// checks that what the dialog saves fits this schema, and that the column roles match).

/** What a column of an imported file holds (`ColumnRole` on the client) */
export const IMPORT_COLUMN_ROLES = [
  'date',
  'payee',
  'amount',
  'inflow',
  'outflow',
  'amountUYU',
  'amountUSD',
  'currency',
  'notes',
  'skip',
] as const;

/** Columns remembered from one file, and the longest header kept */
export const MAX_IMPORT_COLUMNS = 200;
export const MAX_IMPORT_HEADER_LENGTH = 500;

export const importSettingsSchema = z.object({
  dateOrder: z.enum(['day-first', 'month-first']),
  decimal: z.enum(['comma', 'point']),
  /** The file's header line and the role chosen for each column (one role per header) */
  columns: z
    .object({
      headers: z.array(z.string().max(MAX_IMPORT_HEADER_LENGTH)).max(MAX_IMPORT_COLUMNS),
      roles: z.array(z.enum(IMPORT_COLUMN_ROLES)).max(MAX_IMPORT_COLUMNS),
    })
    .refine((c) => c.headers.length === c.roles.length, 'One role per header')
    .optional(),
  /** The file writes purchases as positive amounts */
  chargesPositive: z.boolean().optional(),
  /** Where rows of the other currency went: an account id, or null for "not imported" */
  otherAccountId: z.string().min(1).max(64).nullable().optional(),
});

export type ImportSettings = z.infer<typeof importSettingsSchema>;

/** Stored settings, or null if there are none or they don't fit the current shape */
export function readImportSettings(stored: string | null): ImportSettings | null {
  if (!stored) return null;
  try {
    const parsed = importSettingsSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
