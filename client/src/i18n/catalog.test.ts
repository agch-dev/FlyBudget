import { describe, expect, it } from 'vitest';
import { CATALOGS, NAMESPACES, catalogKeys, type Namespace } from './catalog';

/**
 * Namespaces whose Spanish is not written yet (they show in English meanwhile). Take a
 * namespace off this list when you translate it: from then on a key missing from either
 * language fails this test. The list is empty once the whole app is translated.
 */
const STILL_TO_TRANSLATE: Namespace[] = [
  'transactions',
  'import',
  'budget',
  'reports',
  'settings',
];

const text = (catalog: object, key: string): string =>
  key.split('.').reduce((node, part) => (node as Record<string, object>)[part], catalog) as never;

/** The `{{names}}` and `<tags>` a sentence has, which its translation must have too */
const slots = (sentence: string) => (sentence.match(/\{\{\s*\w+\s*\}\}|<\/?\w+>/g) ?? []).sort();

describe.each(NAMESPACES)('the %s catalog', (ns) => {
  const english = catalogKeys(CATALOGS.en[ns]);
  const spanish = catalogKeys(CATALOGS.es[ns]);

  it('has no Spanish key that English lacks', () => {
    expect(spanish.filter((key) => !english.includes(key))).toEqual([]);
  });

  if (STILL_TO_TRANSLATE.includes(ns)) {
    it('comes off the still-to-translate list once Spanish has every key', () => {
      const complete = english.length > 0 && english.every((key) => spanish.includes(key));
      expect(complete, `remove '${ns}' from STILL_TO_TRANSLATE`).toBe(false);
    });
  } else {
    it('has every English key in Spanish', () => {
      expect(english.filter((key) => !spanish.includes(key))).toEqual([]);
    });
  }

  it('keeps the same placeholders and tags in both languages', () => {
    const different = spanish
      .filter((key) => english.includes(key))
      .filter(
        (key) =>
          slots(text(CATALOGS.en[ns], key)).join() !== slots(text(CATALOGS.es[ns], key)).join(),
      );
    expect(different).toEqual([]);
  });

  it('writes counts with both plural forms (_one and _other)', () => {
    for (const keys of [english, spanish]) {
      const one = keys.filter((k) => k.endsWith('_one')).map((k) => k.replace(/_one$/, ''));
      const other = keys.filter((k) => k.endsWith('_other')).map((k) => k.replace(/_other$/, ''));
      expect(one).toEqual(other);
    }
  });
});

describe('catalogKeys', () => {
  it('lists nested keys as dotted paths', () => {
    expect(catalogKeys({ b: { d: 'x', c: 'y' }, a: 'z' })).toEqual(['a', 'b.c', 'b.d']);
  });
});
