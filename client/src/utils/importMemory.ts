import type { ColumnRole, ImportConventions, ImportMemory } from './csv';

// What the import dialog remembers for an account lives on the server (accounts.import_settings),
// so every device and browser opens the next import with the same choices. Before that it
// lived in this device's `csvImportConventions` preference: those are still read when the
// server has nothing for the account, and the next successful import saves them to the server.
// The preference is no longer written.

/** The most columns, and the longest header, the server keeps (server/src/utils/importSettings.ts) */
export const MAX_REMEMBERED_COLUMNS = 200;
export const MAX_REMEMBERED_HEADER_LENGTH = 500;

/**
 * The choices to open an account's import with: the server's when it has any, else what this
 * device remembered before settings moved to the server, else none (`undefined`: guess from
 * the file). `saved` is undefined when the server couldn't be asked. A remembered account for
 * the other currency's rows that no longer exists is forgotten, so the usual default applies;
 * with no list of accounts yet (`accountIds` undefined) it is kept, since it may well exist.
 */
export function rememberedImport(
  saved: ImportMemory | null | undefined,
  onDevice: ImportMemory | undefined,
  accountIds: ReadonlySet<string> | undefined,
): ImportMemory | undefined {
  const memory = saved ?? onDevice;
  if (!memory) return undefined;
  if (
    accountIds &&
    typeof memory.otherAccountId === 'string' &&
    !accountIds.has(memory.otherAccountId)
  ) {
    const { otherAccountId: _, ...rest } = memory;
    return rest;
  }
  return memory;
}

/** What an import used: every choice, and the card and currency ones only when they applied */
export interface ImportChoices {
  conventions: ImportConventions;
  headers: string[];
  roles: ColumnRole[];
  /** Left out when the file has no signed amount column */
  chargesPositive?: boolean;
  /** Left out when the file had no rows of the other currency */
  otherAccountId?: string | null;
}

/**
 * What to remember after a successful import: the choices it used, keeping the earlier card
 * and currency choices when this file didn't ask for them. A header line too long for the
 * server to keep is not remembered (the rest still is).
 */
export function nextImportMemory(
  previous: ImportMemory | undefined,
  used: ImportChoices,
): ImportMemory {
  const columnsFit =
    used.headers.length === used.roles.length &&
    used.headers.length <= MAX_REMEMBERED_COLUMNS &&
    used.headers.every((h) => h.length <= MAX_REMEMBERED_HEADER_LENGTH);
  const chargesPositive = used.chargesPositive ?? previous?.chargesPositive;
  const otherAccountId =
    used.otherAccountId !== undefined ? used.otherAccountId : previous?.otherAccountId;
  return {
    dateOrder: used.conventions.dateOrder,
    decimal: used.conventions.decimal,
    ...(columnsFit ? { columns: { headers: used.headers, roles: used.roles } } : {}),
    ...(chargesPositive !== undefined ? { chargesPositive } : {}),
    ...(otherAccountId !== undefined ? { otherAccountId } : {}),
  };
}
