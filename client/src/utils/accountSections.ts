// Account Sections (GLOSSARY.md): a name the user gives some accounts so they're listed
// together. Saved on the device (`accountSections` preference: account id → name), never in the
// budget, so everything here is derived from that map and the list of accounts.

/** Account id → its section's name, as saved in the preferences */
export type AccountSections = Record<string, string>;

/** One row of an account list: a section with its accounts, or an account in none */
export type SectionListEntry<A> =
  | {
      kind: 'section';
      /** The same for every spelling of the name (a React key) */
      key: string;
      name: string;
      accounts: A[];
    }
  | { kind: 'account'; account: A };

/** Names that differ only in case are one section */
const sectionKey = (name: string) => name.toLowerCase();

/** The section an account is in, or null (an entry that isn't text counts as none) */
export function sectionOf(sections: AccountSections, accountId: string): string | null {
  const name = Object.hasOwn(sections, accountId) ? sections[accountId] : undefined;
  return typeof name === 'string' && name ? name : null;
}

/**
 * A list of accounts as it is shown: each section once, where its first account is, holding
 * its accounts in their order; accounts in no section stay where they are. Call it with one
 * Budget List's (or Account Type Group's) accounts; a section is spelled as its first account
 * in `allAccounts` (every account, in order) spells it, so all its headings agree.
 */
export function listBySection<A extends { id: string }>(
  accounts: readonly A[],
  sections: AccountSections,
  allAccounts: readonly { id: string }[] = accounts,
): SectionListEntry<A>[] {
  const spellings = new Map<string, string>();
  for (const { id } of allAccounts) {
    const name = sectionOf(sections, id);
    if (name && !spellings.has(sectionKey(name))) spellings.set(sectionKey(name), name);
  }
  const entries: SectionListEntry<A>[] = [];
  const found = new Map<string, A[]>();
  for (const account of accounts) {
    const name = sectionOf(sections, account.id);
    if (!name) {
      entries.push({ kind: 'account', account });
      continue;
    }
    const key = sectionKey(name);
    const members = found.get(key);
    if (members) {
      members.push(account);
    } else {
      const first = [account];
      found.set(key, first);
      entries.push({ kind: 'section', key, name: spellings.get(key) ?? name, accounts: first });
    }
  }
  return entries;
}

export const ACCOUNT_SECTION_MAX_LENGTH = 100;

/** The sections after naming an account's: trimmed, cut to 100 characters, empty = none */
export function withSection(
  sections: AccountSections,
  accountId: string,
  typed: string,
): AccountSections {
  const name = typed.trim().slice(0, ACCOUNT_SECTION_MAX_LENGTH).trim();
  // Built from entries: an id like "__proto__" must stay a plain key
  const others = Object.entries(sections).filter(([id]) => id !== accountId);
  return Object.fromEntries(name ? [...others, [accountId, name]] : others);
}

/** The sections of these accounts, in alphabetical order: what an account's dialog offers */
export function sectionNames(
  accounts: readonly { id: string }[],
  sections: AccountSections,
): string[] {
  return listBySection(accounts, sections)
    .flatMap((e) => (e.kind === 'section' ? [e.name] : []))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Whether a section is closed in one Budget List (`collapsedAccountSections`). Names left from
 * sections that no longer exist are simply never matched.
 */
export function isSectionCollapsed(collapsed: readonly string[], name: string): boolean {
  return Array.isArray(collapsed) && collapsed.some((c) => sectionKey(c) === sectionKey(name));
}

/** A Budget List's closed sections after clicking `name`'s heading */
export function toggleSectionCollapsed(collapsed: readonly string[], name: string): string[] {
  const list = Array.isArray(collapsed) ? collapsed : [];
  return isSectionCollapsed(list, name)
    ? list.filter((c) => sectionKey(c) !== sectionKey(name))
    : [...list, name];
}
