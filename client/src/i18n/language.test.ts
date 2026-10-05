import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { detectLanguage, isLanguage, LANGUAGES } from './language';

describe('detectLanguage', () => {
  it('is Spanish for any browser language starting with "es"', () => {
    for (const tag of ['es', 'es-UY', 'es-ES', 'es-419', 'ES-uy', 'es_AR']) {
      expect(detectLanguage(tag)).toBe('es');
    }
  });

  it('is English for everything else, including no language at all', () => {
    for (const tag of ['en', 'en-US', 'pt-BR', 'fr', 'eo', 'et-EE', '', undefined, null]) {
      expect(detectLanguage(tag)).toBe('en');
    }
  });

  it('always answers with one of the app languages', () => {
    fc.assert(
      fc.property(fc.string(), (tag) => {
        expect(LANGUAGES.map((l) => l.value)).toContain(detectLanguage(tag));
      }),
    );
  });
});

describe('isLanguage', () => {
  it('accepts only the app languages', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});
