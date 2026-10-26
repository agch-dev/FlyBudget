import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CURRENCY_CODES } from './currencies';
import { currencyCandidates, readCurrency } from './currencyText';

// The currency a cell or header names: ISO codes, symbols and names, however they're written.
// Words several currencies share ("pesos", "$") are settled only by the currencies around the
// import (its account's and its Account Section's).

const EN = ['en'];

const englishName = (code: string) =>
  new Intl.DisplayNames('en', { type: 'currency' }).of(code) ?? code;

const symbolOf = (code: string, display: 'symbol' | 'narrowSymbol') =>
  new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: display })
    .formatToParts(1)
    .find((p) => p.type === 'currency')!.value;

const code = fc.constantFrom(...CURRENCY_CODES);
const context = fc.uniqueArray(code, { maxLength: 4 });

/** The same text as someone might type it: any case, dots and extra spaces */
const retyped = (text: string) =>
  fc
    .tuple(
      fc.array(fc.boolean(), { minLength: text.length, maxLength: text.length }),
      fc.constantFrom('', ' ', '  '),
      fc.boolean(),
    )
    .map(([upper, pad, dot]) => {
      const cased = [...text].map((ch, i) => (upper[i] ? ch.toUpperCase() : ch.toLowerCase()));
      return `${pad}${cased.join('')}${dot ? '.' : ''}${pad}`;
    });

describe('readCurrency (property-based)', () => {
  it('reads every ISO code as that currency, whatever the context', () => {
    fc.assert(
      fc.property(
        code.chain((c) => fc.tuple(fc.constant(c), retyped(c))),
        context,
        ([c, text], ctx) => {
          expect(readCurrency(text, ctx, EN)).toBe(c);
        },
      ),
    );
  });

  it("reads every currency's English name as that currency, singular or plural", () => {
    fc.assert(
      fc.property(
        code.chain((c) =>
          fc.tuple(
            fc.constant(c),
            fc.constantFrom(englishName(c), `${englishName(c)}s`).chain(retyped),
          ),
        ),
        context,
        ([c, text], ctx) => {
          expect(readCurrency(text, ctx, EN)).toBe(c);
        },
      ),
    );
  });

  it("reads every currency's symbol as it when the context has that currency", () => {
    fc.assert(
      fc.property(
        code.chain((c) =>
          fc.tuple(
            fc.constant(c),
            fc.constantFrom(symbolOf(c, 'symbol'), symbolOf(c, 'narrowSymbol')),
          ),
        ),
        ([c, symbol]) => {
          expect(currencyCandidates(symbol, EN)).toContain(c);
          expect(readCurrency(symbol, [c], EN)).toBe(c);
        },
      ),
    );
  });

  it('uses the context only to settle text that could be several currencies', () => {
    const text = fc.oneof(
      code,
      code.map(englishName),
      code.map((c) => symbolOf(c, 'narrowSymbol')),
      fc.constantFrom('pesos', 'Dollars', '$', 'kr', 'franc', 'peso', 'Euro', 'Moneda', ''),
      fc.string({ maxLength: 8 }),
    );
    fc.assert(
      fc.property(text, context, (t, ctx) => {
        const candidates = currencyCandidates(t, EN);
        const read = readCurrency(t, ctx, EN);
        if (candidates.length === 1) expect(read).toBe(candidates[0]);
        else if (read !== null) {
          expect(candidates).toContain(read);
          expect(ctx).toContain(read);
          // Exactly one of the readings is around the import
          expect(candidates.filter((c) => ctx.includes(c))).toEqual([read]);
        }
        // Without context, a word several currencies share is never guessed
        if (candidates.length !== 1) expect(readCurrency(t, [], EN)).toBeNull();
      }),
    );
  });
});

describe('readCurrency', () => {
  it('settles "pesos" by the currencies around the import, and never guesses', () => {
    expect(readCurrency('Pesos', ['UYU', 'USD'], EN)).toBe('UYU');
    expect(readCurrency('PESOS', ['MXN'], EN)).toBe('MXN');
    expect(readCurrency('pesos', [], EN)).toBeNull();
    expect(readCurrency('pesos', ['UYU', 'ARS'], EN)).toBeNull();
    expect(readCurrency('pesos', ['EUR'], EN)).toBeNull();
  });

  it('reads names in the device language, accents or not', () => {
    const ES = ['en', 'es'];
    expect(readCurrency('Dólares', ['UYU', 'USD'], ES)).toBe('USD');
    expect(readCurrency('DOLARES', ['UYU', 'USD'], ES)).toBe('USD');
    expect(readCurrency('dólar estadounidense', [], ES)).toBe('USD');
    expect(readCurrency('Pesos uruguayos', [], ES)).toBe('UYU');
    // Not a word of English: only read when the device speaks Spanish
    expect(currencyCandidates('Dolares', EN)).toEqual([]);
  });

  it('reads the symbols banks write', () => {
    expect(readCurrency('€', [], EN)).toBe('EUR');
    expect(readCurrency('US$', [], EN)).toBe('USD');
    expect(readCurrency('U$S', [], EN)).toBe('USD');
    expect(readCurrency('CA$', [], EN)).toBe('CAD');
    expect(readCurrency('kr.', ['DKK', 'EUR'], EN)).toBe('DKK');
    // Both are written $ at home: the file has to say which
    expect(readCurrency('$', ['UYU', 'USD'], EN)).toBeNull();
    expect(readCurrency('$', ['UYU', 'EUR'], EN)).toBe('UYU');
  });

  it("doesn't read text that names no currency", () => {
    expect(currencyCandidates('', EN)).toEqual([]);
    expect(currencyCandidates('Supermarket', EN)).toEqual([]);
    expect(currencyCandidates('12.50', EN)).toEqual([]);
  });
});
