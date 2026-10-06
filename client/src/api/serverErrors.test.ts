import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import i18n, { setLanguage } from '../i18n';
import { REFUSAL_KEYS, refusalMessage } from './serverErrors';
// The server's one list of codes, with the params each is sent with
import { REFUSALS } from '../../../server/src/utils/refusals';

const codes = Object.keys(REFUSAL_KEYS) as (keyof typeof REFUSAL_KEYS)[];

/** The `{{placeholders}}` of a sentence, sorted */
const placeholders = (sentence: string) =>
  [...sentence.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('the codes the app translates', () => {
  it("are exactly the server's list", () => {
    expect([...codes].sort()).toEqual(Object.keys(REFUSALS).sort());
  });

  it.each(codes)(
    '%s has a sentence in both languages, with the params the server sends',
    (code) => {
      const [namespace, key] = REFUSAL_KEYS[code].split(':');
      for (const lng of ['en', 'es']) {
        const sentence: unknown = i18n.getResource(lng, namespace, key);
        expect(typeof sentence, lng).toBe('string');
        expect(placeholders(sentence as string), lng).toEqual([...REFUSALS[code]].sort());
      }
    },
  );

  it('never use one sentence for two codes', () => {
    const keys = Object.values(REFUSAL_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('refusalMessage', () => {
  it("shows the server's own text in English, coded or not", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.option(fc.oneof(fc.constantFrom(...codes), fc.string()), { nil: undefined }),
        (error, code) => {
          expect(refusalMessage({ error, code })).toBe(error);
        },
      ),
    );
  });

  it('in English, says what it is told to when the server sent no sentence', () => {
    expect(refusalMessage({}, 'Some of the values entered are invalid')).toBe(
      'Some of the values entered are invalid',
    );
    expect(refusalMessage({})).toBe('The action could not be completed');
  });

  it('says a coded refusal in Spanish', () => {
    setLanguage('es');
    expect(refusalMessage({ error: 'Incorrect password', code: 'incorrect_password' })).toBe(
      'Contraseña incorrecta',
    );
    expect(
      refusalMessage({
        error: 'Cannot modify a reconciled transaction',
        code: 'transaction_reconciled',
      }),
    ).toBe('No se puede modificar una transacción conciliada');
    expect(
      refusalMessage({
        error: "An account's currency can't change once it has transactions",
        code: 'currency_locked_transactions',
      }),
    ).toBe('La moneda de una cuenta no se puede cambiar una vez que tiene transacciones');
  });

  it('goes by the code, not by the sentence: a reworded message still translates', () => {
    setLanguage('es');
    expect(refusalMessage({ error: 'Wrong password, sorry', code: 'incorrect_password' })).toBe(
      'Contraseña incorrecta',
    );
  });

  it("puts the server's values in the Spanish sentence", () => {
    setLanguage('es');
    expect(
      refusalMessage({
        error: 'New password must be 8-256 characters',
        code: 'password_length',
        params: { min: 8, max: 256 },
      }),
    ).toBe('La contraseña nueva tiene que tener entre 8 y 256 caracteres');
    expect(
      refusalMessage({
        error: 'Row 3 of "accounts" has an invalid "currency"',
        code: 'backup_row_invalid',
        params: { row: 3, table: 'accounts' },
      }),
    ).toBe('La fila 3 de "accounts" no es válida');
  });

  it('in Spanish, says one generic sentence for a refusal without a code it knows', () => {
    setLanguage('es');
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        fc.option(
          fc.string().filter((code) => !Object.hasOwn(REFUSAL_KEYS, code)),
          { nil: undefined },
        ),
        (error, code) => {
          expect(refusalMessage({ error, code }, 'Not Found')).toBe(
            'No se pudo completar la acción',
          );
        },
      ),
    );
    // Names every object has are not codes
    expect(refusalMessage({ error: 'x', code: 'toString' })).toBe('No se pudo completar la acción');
  });
});
