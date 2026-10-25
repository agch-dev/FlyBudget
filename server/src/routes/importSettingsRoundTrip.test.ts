import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { createBackup } from '../services/backupService.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';
import {
  CSV_ENCODINGS,
  importSettingsSchema,
  storeImportSettings,
  type ImportSettings,
} from '../utils/importSettings.js';
import * as upstream from '../utils/upstreamImportSettings.fixture.js';

// A backup must survive this branch → plain upstream → this branch. Upstream restores
// `import_settings` as opaque text, but reads it with its own schema (extra keys dropped, one
// unknown column role and all the CSV settings are forgotten) and rewrites it after every
// import. So this branch's settings are upstream's plus optional top-level keys, never new
// roles, and the backup stays at version 3. Checked here against a pinned copy of upstream.

/** Keys this branch adds to upstream's settings, all optional */
type ExtraKey = Exclude<keyof ImportSettings, keyof upstream.ImportSettings>;

/** A value for each key this branch adds (a new key fails to compile until it's listed here) */
const EXTRA_KEYS: { [K in ExtraKey]-?: fc.Arbitrary<NonNullable<ImportSettings[K]>> } = {};

const UPSTREAM_KEYS = Object.keys(upstream.importSettingsSchema.shape);

type SchemaNode = { _zod: { def: Record<string, unknown> }; options?: string[] };

/** The roles a settings schema allows in `columns` (its only enum) */
function columnRoles(schema: { shape: { columns: unknown } }): string[] {
  const enums: string[][] = [];
  const walk = (node: SchemaNode) => {
    const def = node._zod.def;
    if (def.type === 'enum') enums.push(node.options!);
    for (const child of ['in', 'out', 'element', 'innerType'])
      if (def[child]) walk(def[child] as SchemaNode);
    for (const item of (def.items as SchemaNode[] | undefined) ?? []) walk(item);
  };
  walk(schema.shape.columns as SchemaNode);
  if (enums.length !== 1) throw new Error('Could not find the column roles in the schema');
  return enums[0];
}

const UPSTREAM_ROLES = columnRoles(upstream.importSettingsSchema);
const COLUMN_ROLES = columnRoles(importSettingsSchema);

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
  return { status: res.status, body: await res.json() };
};

/** Settings with the given column roles, as the import dialog saves them */
const coreSettings = (roles: readonly string[]) =>
  fc.record({
    delimiter: fc.constantFrom(',', ';', '\t'),
    encoding: fc.constantFrom(...CSV_ENCODINGS),
    skipRows: fc.integer({ min: 0, max: 1000 }),
    columns: fc.dictionary(fc.string({ maxLength: 200 }), fc.constantFrom(...roles), {
      maxKeys: 20,
    }),
    dateFormat: fc.constantFrom('mdy', 'dmy', 'ymd', null),
    numberFormat: fc.constantFrom('dot', 'comma', null),
    outWord: fc.option(
      fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim() === s && s !== ''),
    ),
  });

/** What upstream saves */
const upstreamSettings = coreSettings(UPSTREAM_ROLES) as fc.Arbitrary<upstream.ImportSettings>;

/** What this branch saves: its own roles, and any of its extra keys */
const branchSettings = fc
  .tuple(coreSettings(COLUMN_ROLES), fc.record(EXTRA_KEYS, { requiredKeys: [] }))
  .map(([core, extras]) => ({ ...core, ...extras }) as ImportSettings);

const iban = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), {
    minLength: 1,
    maxLength: 34,
  })
  .map((chars) => chars.join(''));

/** Upstream's part of some settings */
const upstreamPart = (settings: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(settings).filter(([key]) => UPSTREAM_KEYS.includes(key)));

/** What this branch stores after an import */
const storeBranch = (settings: ImportSettings, account: string | null) =>
  storeImportSettings(null, { settings, ...(account ? { statementAccount: account } : {}) });

/** Replaces every account with ones holding these stored settings, through a restore */
const restoreAccounts = async (stored: (string | null)[]) => {
  const accounts = stored.map((importSettings, i) => ({
    id: `acct-${i}`,
    name: `Account ${i}`,
    type: 'checking',
    importSettings,
  }));
  const res = await send('POST', '/export/restore', { ...createBackup(), accounts });
  expect(res.status).toBe(200);
  return accounts.map((a) => a.id);
};

describe('import settings are a superset of upstream', () => {
  it('only adds optional top-level keys, each with values to test', () => {
    const shape = importSettingsSchema.shape as Record<string, { safeParse(v: unknown): unknown }>;
    const extra = Object.keys(shape).filter((key) => !UPSTREAM_KEYS.includes(key));
    expect(extra.sort()).toEqual(Object.keys(EXTRA_KEYS).sort());
    for (const key of extra) {
      expect(shape[key].safeParse(undefined)).toMatchObject({ success: true });
    }
    expect(Object.keys(shape)).toEqual(expect.arrayContaining(UPSTREAM_KEYS));
  });

  it('keeps upstream column roles and adds none (one unknown role and upstream forgets all)', () => {
    // Upstream's eight roles, so a change to how Zod stores the enum can't make this pass empty
    expect(UPSTREAM_ROLES).toHaveLength(8);
    expect(COLUMN_ROLES).toEqual(UPSTREAM_ROLES);
  });

  it('accepts whatever upstream accepts, and reads it the same', () => {
    // Settings upstream saved, with keys nobody knows and fields broken at random
    const noise = fc
      .dictionary(fc.string({ maxLength: 20 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 })
      .map((d) =>
        Object.fromEntries(
          Object.entries(d).filter(([key]) => !(key in importSettingsSchema.shape)),
        ),
      );
    const input = fc.oneof(
      fc.tuple(upstreamSettings, noise).map(([s, n]) => ({ ...n, ...s })),
      fc
        .tuple(upstreamSettings, fc.constantFrom(...UPSTREAM_KEYS), fc.jsonValue({ maxDepth: 2 }))
        .map(([s, key, value]) => ({ ...s, [key]: value })),
    );
    fc.assert(
      fc.property(input, (value) => {
        const theirs = upstream.importSettingsSchema.safeParse(value);
        const ours = importSettingsSchema.safeParse(value);
        if (theirs.success) {
          expect(ours.success).toBe(true);
          expect(upstreamPart(ours.data!)).toEqual(theirs.data);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('writes settings upstream can read, with the same CSV settings', () => {
    fc.assert(
      fc.property(branchSettings, fc.option(iban), (settings, account) => {
        const stored = storeBranch(settings, account);
        expect(upstream.readImportSettings(stored)).toEqual(upstreamPart(settings));
        expect(upstream.readStatementAccount(stored)).toBe(account);
      }),
      { numRuns: 500 },
    );
  });
});

describe('a backup going through upstream and back', () => {
  it('keeps the backup at version 3 (upstream refuses newer ones)', () => {
    expect(createBackup().version).toBe(3);
  });

  it('restores every key this branch stored, exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(branchSettings, fc.option(iban)), { minLength: 1, maxLength: 4 }),
        async (saved) => {
          const stored = saved.map(([settings, account]) => storeBranch(settings, account));
          const ids = await restoreAccounts(stored);
          const { body } = await send('GET', '/export/backup');
          expect(body.accounts.map((a: { importSettings: string }) => a.importSettings)).toEqual(
            stored,
          );
          for (const [i, [settings, account]] of saved.entries()) {
            expect((await send('GET', `/accounts/${ids[i]}/import-settings`)).body).toEqual({
              settings,
              statementAccount: account,
            });
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('after imports on upstream, keeps the CSV settings and treats the extra keys as unknown', async () => {
    await fc.assert(
      fc.asyncProperty(
        branchSettings,
        fc.option(iban),
        fc.oneof(
          fc.constant({ csv: true } as const),
          iban.map((account) => ({ camt: account })),
        ),
        async (settings, account, upstreamImport) => {
          const stored = storeBranch(settings, account);
          // What upstream stores after a CSV import (the dialog saves the settings it read)
          // or after a CAMT import (only the statement account changes)
          const resaved =
            'csv' in upstreamImport
              ? upstream.storeImportSettings(stored, {
                  settings: upstream.readImportSettings(stored)!,
                })
              : upstream.storeImportSettings(stored, { statementAccount: upstreamImport.camt });

          const [id] = await restoreAccounts([resaved]);
          const { body } = await send('GET', `/accounts/${id}/import-settings`);
          expect(body).toEqual({
            settings: upstreamPart(settings),
            statementAccount: 'camt' in upstreamImport ? upstreamImport.camt : account,
          });
          // Missing, not false or empty: the import dialog guesses or asks again
          for (const key of Object.keys(EXTRA_KEYS)) expect(body.settings).not.toHaveProperty(key);
        },
      ),
      { numRuns: 20 },
    );
  });
});
