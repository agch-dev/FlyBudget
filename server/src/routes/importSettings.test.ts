import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';
import {
  IMPORT_COLUMN_ROLES,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_HEADER_LENGTH,
  readImportSettings,
  type ImportSettings,
} from '../utils/importSettings.js';

// Each account remembers how its bank's files are read, on the server, so a phone or another
// browser opens the next import with the same choices

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/accounts', accountsRouter);
  app.use('/api/export', exportRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

const newAccount = async (name = 'Santander') =>
  (await send('POST', '/accounts', { name, type: 'checking' })).body.id as string;

const settingsOf = async (id: string) =>
  (await send('GET', `/accounts/${id}/import-settings`)).body.settings as ImportSettings | null;

const settings: fc.Arbitrary<ImportSettings> = fc.integer({ min: 0, max: 12 }).chain((n) =>
  fc.record(
    {
      dateOrder: fc.constantFrom('day-first' as const, 'month-first' as const),
      decimal: fc.constantFrom('comma' as const, 'point' as const),
      columns: fc.record({
        headers: fc.array(fc.string({ maxLength: 60 }), { minLength: n, maxLength: n }),
        roles: fc.array(fc.constantFrom(...IMPORT_COLUMN_ROLES), { minLength: n, maxLength: n }),
      }),
      chargesPositive: fc.boolean(),
      otherAccountId: fc.option(fc.string({ minLength: 1, maxLength: 64 })),
    },
    { requiredKeys: ['dateOrder', 'decimal'] },
  ),
);

const good: ImportSettings = {
  dateOrder: 'day-first',
  decimal: 'comma',
  columns: {
    headers: ['Fecha', 'Concepto', 'Débito', 'Crédito'],
    roles: ['date', 'payee', 'outflow', 'inflow'],
  },
  chargesPositive: false,
  otherAccountId: null,
};

describe('account import settings', () => {
  it('starts with none', async () => {
    const id = await newAccount();
    expect(await send('GET', `/accounts/${id}/import-settings`)).toEqual({
      status: 200,
      body: { settings: null },
    });
  });

  it('gives back whatever was saved (property-based)', async () => {
    const id = await newAccount();
    await fc.assert(
      fc.asyncProperty(settings, async (s) => {
        const put = await send('PUT', `/accounts/${id}/import-settings`, s);
        expect(put).toEqual({ status: 200, body: { settings: s } });
        expect(await settingsOf(id)).toEqual(s);
      }),
      { numRuns: 40 },
    );
  });

  it("keeps each account's settings apart", async () => {
    const a = await newAccount('A');
    const b = await newAccount('B');
    await send('PUT', `/accounts/${a}/import-settings`, good);
    expect(await settingsOf(b)).toBeNull();
  });

  it('refuses settings it does not understand, and keeps the old ones', async () => {
    const id = await newAccount();
    await send('PUT', `/accounts/${id}/import-settings`, good);
    for (const bad of [
      {},
      { ...good, dateOrder: 'year-first' },
      { ...good, decimal: ',' },
      { ...good, chargesPositive: 'yes' },
      { ...good, otherAccountId: '' },
      { ...good, otherAccountId: 'x'.repeat(65) },
      { ...good, columns: { headers: ['Saldo'], roles: ['balance'] } },
      { ...good, columns: { headers: ['Fecha', 'Monto'], roles: ['date'] } },
      {
        ...good,
        columns: { headers: ['x'.repeat(MAX_IMPORT_HEADER_LENGTH + 1)], roles: ['skip'] },
      },
      {
        ...good,
        columns: {
          headers: Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, i) => `c${i}`),
          roles: Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, () => 'skip'),
        },
      },
    ]) {
      expect((await send('PUT', `/accounts/${id}/import-settings`, bad)).status).toBe(400);
    }
    expect(await settingsOf(id)).toEqual(good);
  });

  it('reads stored text that no longer fits as none, never an error (property-based)', async () => {
    const id = await newAccount();
    const stored = fc.oneof(
      fc.string(),
      fc.json(),
      fc.constantFrom(
        '{"dateOrder":"day-first"',
        '{"delimiter":";","encoding":"auto"}',
        'null',
        '[]',
      ),
    );
    await fc.assert(
      fc.asyncProperty(stored, async (text) => {
        db.update(accounts).set({ importSettings: text }).where(eq(accounts.id, id)).run();
        const res = await send('GET', `/accounts/${id}/import-settings`);
        expect(res.status).toBe(200);
        expect(res.body.settings).toEqual(readImportSettings(text));
      }),
      { numRuns: 60 },
    );
  });

  it('answers 404 for an account that does not exist', async () => {
    expect((await send('GET', '/accounts/nope/import-settings')).status).toBe(404);
    expect((await send('PUT', '/accounts/nope/import-settings', good)).status).toBe(404);
  });

  it('stays out of the account list', async () => {
    const id = await newAccount();
    await send('PUT', `/accounts/${id}/import-settings`, good);
    const list = (await send('GET', '/accounts')).body as Record<string, unknown>[];
    expect(list.find((a) => a.id === id)).not.toHaveProperty('importSettings');
    const renamed = await send('PUT', `/accounts/${id}`, { name: 'Renamed' });
    expect(renamed.body).not.toHaveProperty('importSettings');
  });

  it('comes through a backup and restore', async () => {
    const id = await newAccount();
    await send('PUT', `/accounts/${id}/import-settings`, good);
    const { body: backup } = await send('GET', '/export/backup');
    expect(backup.accounts.find((a: { id: string }) => a.id === id).importSettings).toEqual(
      JSON.stringify(good),
    );
    await send('PUT', `/accounts/${id}/import-settings`, { ...good, decimal: 'point' });
    expect((await send('POST', '/export/restore', backup)).status).toBe(200);
    expect(await settingsOf(id)).toEqual(good);
  });

  it('restores an older backup that has no import settings', async () => {
    const res = await send('POST', '/export/restore', {
      format: 'flybudget-backup',
      version: 2,
      accounts: [{ id: 'old', name: 'Old', type: 'checking', startingBalance: 5 }],
    });
    expect(res.status).toBe(200);
    expect(await settingsOf('old')).toBeNull();
  });
});
