import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { setLanguage } from '../i18n';
import { serverErrorMessage } from './serverErrors';

const refusal = (method: string, path: string, status: number, message: string) =>
  serverErrorMessage({ method, path, status, message });

describe('serverErrorMessage', () => {
  it("shows the server's own text in English, whatever the error", () => {
    fc.assert(
      fc.property(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
        fc.constantFrom('/auth/login', '/auth/setup', '/accounts/a1', '/transactions'),
        fc.integer({ min: 400, max: 599 }),
        fc.string(),
        (method, path, status, message) => {
          expect(refusal(method, path, status, message)).toBe(message);
        },
      ),
    );
  });

  it('translates the errors of signing in', () => {
    setLanguage('es');
    expect(refusal('POST', '/auth/login', 401, 'Incorrect password')).toBe('Contraseña incorrecta');
    expect(refusal('POST', '/auth/setup', 403, 'Incorrect setup code')).toBe(
      'Código de configuración incorrecto',
    );
    expect(refusal('POST', '/auth/change-password', 401, 'Current password is incorrect')).toBe(
      'La contraseña actual es incorrecta',
    );
    for (const path of ['/auth/login', '/auth/setup', '/auth/change-password']) {
      expect(refusal('POST', path, 429, 'Too many attempts. Wait 15 minutes and try again.')).toBe(
        'Demasiados intentos. Esperá 15 minutos y probá de nuevo.',
      );
    }
  });

  it('leaves every other error in English', () => {
    setLanguage('es');
    // Another refusal of the same route
    expect(refusal('POST', '/auth/setup', 409, 'A password has already been set')).toBe(
      'A password has already been set',
    );
    // The same status on another route
    expect(refusal('GET', '/accounts', 401, 'Login required')).toBe('Login required');
    expect(
      refusal('POST', '/plaid/sync', 429, 'Too many bank requests. Wait a minute and try again.'),
    ).toBe('Too many bank requests. Wait a minute and try again.');
  });
});
