import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { setLanguage } from '../i18n';
import { en } from '../i18n/catalog';
import { serverErrorMessage } from './serverErrors';
// The server's own code, as text: where the sentences this file translates are written
import transactionRoutes from '../../../server/src/routes/transactions.ts?raw';
import transferLink from '../../../server/src/services/transferLink.ts?raw';
import transferLinkService from '../../../server/src/services/transferLinkService.ts?raw';

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

  it('translates the refusals of transfers, by their sentence', () => {
    setLanguage('es');
    const link = (status: number, message: string) =>
      refusal('POST', '/transactions/t1/link-transfer', status, message);
    expect(
      link(
        400,
        'These accounts have the same currency, so both transactions must be for the same amount',
      ),
    ).toBe(
      'Estas cuentas tienen la misma moneda, así que las dos transacciones tienen que ser por el mismo monto',
    );
    expect(link(400, 'This transaction is already a transfer: unlink it first')).toBe(
      'Esta transacción ya es una transferencia: desvinculala primero',
    );
    expect(link(403, 'Cannot modify a reconciled transaction')).toBe(
      'No se puede modificar una transacción conciliada',
    );
    expect(
      refusal(
        'POST',
        '/transactions/t1/unlink-transfer',
        400,
        'This transaction is not a transfer',
      ),
    ).toBe('Esta transacción no es una transferencia');
    expect(
      refusal(
        'POST',
        '/transactions/transfer',
        400,
        'These accounts have different currencies: enter the amount arriving too',
      ),
    ).toBe('Estas cuentas tienen monedas distintas: ingresá también el monto que llega');
    expect(
      refusal(
        'PUT',
        '/transactions/t1',
        400,
        'A transaction cannot move to an account of another currency: its amount would change meaning. Delete it and add it in the other account instead',
      ),
    ).toBe(
      'Una transacción no se puede mover a una cuenta de otra moneda: su monto pasaría a significar otra cosa. Eliminala y agregala en la otra cuenta',
    );
    // A refusal of the same route and status that is not translated
    expect(link(400, 'Something the server started saying later')).toBe(
      'Something the server started saying later',
    );
  });

  it('knows the transaction refusals by the sentences the server really sends', () => {
    const server = [transactionRoutes, transferLink, transferLinkService].join('\n');
    for (const message of Object.values(en.transactions.errors)) {
      const written = [`'${message}'`, `"${message}"`].some((literal) => server.includes(literal));
      expect(written, `the server no longer says: ${message}`).toBe(true);
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
