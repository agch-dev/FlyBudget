import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ACCOUNT_SECTION_MAX_LENGTH,
  isSectionCollapsed,
  listBySection,
  sectionNames,
  toggleSectionCollapsed,
  withSection,
} from './accountSections';

const ids = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { maxLength: 12 });
const names = fc.constantFrom('Card', 'card', 'CARD', 'Savings', 'Old', 'Ítaú');

/** Accounts in order plus some of them given a section */
const listWithSections = ids.chain((list) =>
  fc
    .array(fc.option(names, { nil: undefined }), { minLength: list.length, maxLength: list.length })
    .map((picked) => {
      const sections: Record<string, string> = {};
      list.forEach((id, i) => {
        if (picked[i] !== undefined) sections[id] = picked[i]!;
      });
      return { accounts: list.map((id) => ({ id })), sections };
    }),
);

const flatten = (entries: ReturnType<typeof listBySection<{ id: string }>>) =>
  entries.flatMap((e) => (e.kind === 'section' ? e.accounts : [e.account]));

describe('listBySection', () => {
  it('lists each section where its first account is, its accounts in their order', () => {
    const accounts = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const entries = listBySection(accounts, { b: 'Card', d: 'card', e: 'Old' });
    expect(entries).toEqual([
      { kind: 'account', account: { id: 'a' } },
      { kind: 'section', key: 'card', name: 'Card', accounts: [{ id: 'b' }, { id: 'd' }] },
      { kind: 'account', account: { id: 'c' } },
      { kind: 'section', key: 'old', name: 'Old', accounts: [{ id: 'e' }] },
    ]);
  });

  it('keeps every account exactly once, and names differing only in case are one section', () => {
    fc.assert(
      fc.property(listWithSections, ({ accounts, sections }) => {
        const entries = listBySection(accounts, sections);
        const listed = flatten(entries);
        // Same accounts, each once
        expect([...listed].sort((x, y) => (x.id < y.id ? -1 : 1))).toEqual(
          [...accounts].sort((x, y) => (x.id < y.id ? -1 : 1)),
        );
        const headings = entries.filter((e) => e.kind === 'section');
        const keys = headings.map((e) => e.name.toLowerCase());
        expect(new Set(keys).size).toBe(keys.length);
        for (const h of headings) {
          // Shown with its first account's spelling, accounts in the list's order
          expect(h.name).toBe(sections[h.accounts[0].id]);
          const order = h.accounts.map((a) => accounts.indexOf(a));
          expect(order).toEqual([...order].sort((x, y) => x - y));
          for (const a of h.accounts)
            expect(sections[a.id].toLowerCase()).toBe(h.name.toLowerCase());
        }
        for (const e of entries)
          if (e.kind === 'account') expect(sections[e.account.id]).toBeUndefined();
      }),
    );
  });

  it('spells a section as its first account in the whole account order does, in every list', () => {
    const all = ['a', 'b', 'c'].map((id) => ({ id }));
    const sections = { a: 'Visa', b: 'Checking', c: 'VISA' };
    // c is in another list or type group than a, so it heads its own copy of the section
    expect(listBySection([all[2]], sections, all)).toEqual([
      { kind: 'section', key: 'visa', name: 'Visa', accounts: [{ id: 'c' }] },
    ]);
  });

  it('ignores entries for accounts that are not in the list, and names that are not text', () => {
    const entries = listBySection([{ id: 'a' }], {
      gone: 'Card',
      a: 42 as unknown as string,
    });
    expect(entries).toEqual([{ kind: 'account', account: { id: 'a' } }]);
  });
});

describe('withSection', () => {
  it('saves the name trimmed and at most 100 characters, and leaves the others alone', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.string()),
        fc.string(),
        fc.string(),
        (before, id, typed) => {
          const after = withSection(before, id, typed);
          if (typed.trim()) {
            const saved = after[id];
            expect(saved.length).toBeGreaterThan(0);
            expect(saved.length).toBeLessThanOrEqual(ACCOUNT_SECTION_MAX_LENGTH);
            expect(saved).toBe(saved.trim());
            expect(typed.trim().startsWith(saved)).toBe(true);
          } else {
            expect(Object.hasOwn(after, id)).toBe(false);
          }
          for (const other of Object.keys(before))
            if (other !== id) expect(after[other]).toBe(before[other]);
          expect(Object.keys(after).every((k) => k === id || Object.hasOwn(before, k))).toBe(true);
        },
      ),
    );
  });

  it('takes an account out of its section when the name is emptied', () => {
    expect(withSection({ a: 'Card', b: 'Card' }, 'a', '   ')).toEqual({ b: 'Card' });
    expect(withSection({}, 'a', '  Card  ')).toEqual({ a: 'Card' });
    expect(withSection({}, 'a', 'x'.repeat(150))).toEqual({ a: 'x'.repeat(100) });
  });
});

describe('sectionNames', () => {
  it('offers the sections of the listed accounts once each, in alphabetical order', () => {
    const accounts = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const sections = { a: 'savings', b: 'Card', c: 'card', e: 'Ítaú', closed: 'Old' };
    expect(sectionNames(accounts, sections)).toEqual(['Card', 'Ítaú', 'savings']);
  });

  it('names exactly the sections the list shows', () => {
    fc.assert(
      fc.property(listWithSections, ({ accounts, sections }) => {
        const shown = listBySection(accounts, sections).flatMap((e) =>
          e.kind === 'section' ? [e.name] : [],
        );
        expect([...sectionNames(accounts, sections)].sort()).toEqual([...shown].sort());
      }),
    );
  });
});

describe('collapsing a section', () => {
  it('closes an open section and opens a closed one, ignoring case', () => {
    expect(toggleSectionCollapsed([], 'Card')).toEqual(['Card']);
    expect(toggleSectionCollapsed(['card', 'Old'], 'Card')).toEqual(['Old']);
    expect(isSectionCollapsed(['card'], 'CARD')).toBe(true);
    expect(isSectionCollapsed(['Old'], 'Card')).toBe(false);
  });

  it('toggling twice gives back the same open/closed state for every section', () => {
    fc.assert(
      fc.property(fc.array(names), names, names, (collapsed, clicked, other) => {
        const twice = toggleSectionCollapsed(toggleSectionCollapsed(collapsed, clicked), clicked);
        expect(isSectionCollapsed(twice, other)).toBe(isSectionCollapsed(collapsed, other));
        const once = toggleSectionCollapsed(collapsed, clicked);
        expect(isSectionCollapsed(once, clicked)).toBe(!isSectionCollapsed(collapsed, clicked));
      }),
    );
  });

  it('copes with a saved value that is not a list', () => {
    expect(isSectionCollapsed(undefined as unknown as string[], 'Card')).toBe(false);
    expect(toggleSectionCollapsed(null as unknown as string[], 'Card')).toEqual(['Card']);
  });
});
