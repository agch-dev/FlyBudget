import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { NAME_KINDS, shownName, storedName, suppliedNames, type NameKind } from './defaultNames.js';

// The app's list of supplied names (ADR 0002): what a Default Category is called in each
// App Language, and which spelling is stored.

const arbKind = fc.constantFrom<NameKind>(...NAME_KINDS);
const arbEntry = arbKind.chain((kind) =>
  fc.constantFrom(...suppliedNames(kind)).map((entry) => ({ kind, entry })),
);

describe('the supplied names', () => {
  it('reads the reviewed examples in Spanish and stores them in English', () => {
    expect(shownName('category', 'Groceries', 'es')).toBe('Supermercado');
    expect(shownName('category', 'Uncategorized', 'es')).toBe('Sin clasificar');
    expect(shownName('category', 'Gas (Natural)', 'es')).toBe('Gas (hogar)');
    expect(shownName('category', 'Gas', 'es')).toBe('Nafta');
    expect(shownName('category', 'Books & Supplies', 'es')).toBe('Libros y materiales');
    expect(shownName('group', 'Food & Dining', 'es')).toBe('Comida y restaurantes');
    expect(shownName('dashboard', 'Overview', 'es')).toBe('Vista general');
    expect(shownName('category', 'Groceries', 'en')).toBe('Groceries');
    expect(storedName('category', 'Supermercado')).toBe('Groceries');
    expect(storedName('category', '  Supermercado ')).toBe('Groceries');
    expect(storedName('dashboard', 'Vista general')).toBe('Overview');
  });

  it('has 17 groups, 76 categories and one dashboard', () => {
    expect(suppliedNames('group')).toHaveLength(17);
    expect(suppliedNames('category')).toHaveLength(76);
    expect(suppliedNames('dashboard')).toHaveLength(1);
  });

  it('gives every entry a name in both languages', () => {
    for (const kind of NAME_KINDS) {
      for (const entry of suppliedNames(kind)) {
        expect(entry.en.trim()).toBe(entry.en);
        expect(entry.es.trim()).toBe(entry.es);
        expect(entry.en).not.toBe('');
        expect(entry.es).not.toBe('');
      }
    }
  });

  it('never repeats a name within a language, in one list', () => {
    for (const kind of NAME_KINDS) {
      const entries = suppliedNames(kind);
      expect(new Set(entries.map((e) => e.en)).size).toBe(entries.length);
      expect(new Set(entries.map((e) => e.es)).size).toBe(entries.length);
    }
  });

  it("never uses another entry's English name as a Spanish name, in one list", () => {
    for (const kind of NAME_KINDS) {
      const entries = suppliedNames(kind);
      for (const entry of entries) {
        const clash = entries.find((other) => other !== entry && other.en === entry.es);
        expect(clash, `${kind}: "${entry.es}"`).toBeUndefined();
      }
    }
  });

  it('keeps the lists apart: a name of one kind is not a name of another', () => {
    expect(shownName('group', 'Groceries', 'es')).toBe('Groceries');
    expect(shownName('category', 'Overview', 'es')).toBe('Overview');
    expect(storedName('category', 'Vivienda')).toBe('Vivienda');
    // "Gifts" is a category, "Regalos" its Spanish name; neither is a group
    expect(storedName('group', 'Regalos')).toBe('Regalos');
  });

  it('matches exactly: another case or an extra word is the user’s own name', () => {
    expect(shownName('category', 'groceries', 'es')).toBe('groceries');
    expect(storedName('category', 'supermercado')).toBe('supermercado');
    expect(storedName('category', 'Supermercado 2')).toBe('Supermercado 2');
  });
});

describe('storing then showing (property-based)', () => {
  it('a supplied name typed in either language reads back in both', () => {
    fc.assert(
      fc.property(arbEntry, fc.constantFrom('en', 'es'), ({ kind, entry }, typedIn) => {
        const stored = storedName(kind, entry[typedIn as 'en' | 'es']);
        expect(stored).toBe(entry.en);
        expect(shownName(kind, stored, 'en')).toBe(entry.en);
        expect(shownName(kind, stored, 'es')).toBe(entry.es);
      }),
    );
  });

  it('a name that is not on the list is stored and shown as typed', () => {
    fc.assert(
      fc.property(arbKind, fc.string(), fc.constantFrom('en', 'es'), (kind, name, language) => {
        const onList = suppliedNames(kind).some(
          (e) => e.en === name.trim() || e.es === name.trim(),
        );
        fc.pre(!onList);
        expect(storedName(kind, name)).toBe(name.trim());
        expect(shownName(kind, name, language as 'en' | 'es')).toBe(name);
      }),
    );
  });

  it('storing is idempotent', () => {
    fc.assert(
      fc.property(arbKind, fc.string(), (kind, name) => {
        const stored = storedName(kind, name);
        expect(storedName(kind, stored)).toBe(stored);
      }),
    );
  });
});
