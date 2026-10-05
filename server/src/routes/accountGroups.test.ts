import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';

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

type Listed = { id: string; name: string; groupName: string | null };
const groupOf = async (id: string) => {
  const list = await send('GET', '/accounts');
  return (list.body as Listed[]).find((a) => a.id === id)?.groupName;
};

describe('account groups', () => {
  it('an account has no group unless one is named', async () => {
    const plain = await send('POST', '/accounts', { name: 'Efectivo', type: 'cash' });
    const grouped = await send('POST', '/accounts', {
      name: 'Visa pesos',
      type: 'credit',
      groupName: 'Visa Itaú',
    });
    expect(plain.body.groupName).toBeNull();
    expect(grouped.body.groupName).toBe('Visa Itaú');
    expect(await groupOf(plain.body.id)).toBeNull();
    expect(await groupOf(grouped.body.id)).toBe('Visa Itaú');
  });

  it('an existing account joins, changes and leaves a group', async () => {
    const account = await send('POST', '/accounts', { name: 'Visa dólares', type: 'credit' });
    const id = account.body.id;

    const joined = await send('PUT', `/accounts/${id}`, { groupName: 'Visa Itaú' });
    expect(joined.body.groupName).toBe('Visa Itaú');

    const moved = await send('PUT', `/accounts/${id}`, { groupName: 'Santander' });
    expect(moved.body.groupName).toBe('Santander');

    // An edit that says nothing about the group keeps it
    const renamed = await send('PUT', `/accounts/${id}`, { name: 'Visa USD' });
    expect(renamed.body.groupName).toBe('Santander');

    const left = await send('PUT', `/accounts/${id}`, { groupName: null });
    expect(left.body.groupName).toBeNull();
    expect(await groupOf(id)).toBeNull();
  });

  it('a blank group name means no group, and spaces around a name are dropped', async () => {
    const blank = await send('POST', '/accounts', { name: 'A', type: 'cash', groupName: '   ' });
    const padded = await send('POST', '/accounts', {
      name: 'B',
      type: 'cash',
      groupName: ' BROU ',
    });
    expect(blank.body.groupName).toBeNull();
    expect(padded.body.groupName).toBe('BROU');

    const cleared = await send('PUT', `/accounts/${padded.body.id}`, { groupName: '' });
    expect(cleared.body.groupName).toBeNull();
  });

  it('a name typed in another case joins the group that already exists', async () => {
    const first = await send('POST', '/accounts', {
      name: 'Oca pesos',
      type: 'credit',
      groupName: 'Oca Blue',
    });
    const second = await send('POST', '/accounts', {
      name: 'Oca dólares',
      type: 'credit',
      groupName: 'oca blue',
    });
    const third = await send('POST', '/accounts', { name: 'Oca extra', type: 'credit' });
    const edited = await send('PUT', `/accounts/${third.body.id}`, { groupName: 'OCA BLUE' });
    expect(first.body.groupName).toBe('Oca Blue');
    expect(second.body.groupName).toBe('Oca Blue');
    expect(edited.body.groupName).toBe('Oca Blue');
  });

  it('the only account of a group can change how its name is written', async () => {
    const account = await send('POST', '/accounts', {
      name: 'Solo',
      type: 'cash',
      groupName: 'prex',
    });
    const fixed = await send('PUT', `/accounts/${account.body.id}`, { groupName: 'Prex' });
    expect(fixed.body.groupName).toBe('Prex');
  });

  it('refuses a group name that is not text or is too long', async () => {
    const number = await send('POST', '/accounts', { name: 'X', type: 'cash', groupName: 7 });
    const long = await send('POST', '/accounts', {
      name: 'X',
      type: 'cash',
      groupName: 'x'.repeat(201),
    });
    expect(number.status).toBe(400);
    expect(long.status).toBe(400);
  });

  it('a backup carries groups and restoring it brings them back', async () => {
    const a = await send('POST', '/accounts', {
      name: 'Itaú pesos',
      type: 'checking',
      groupName: 'Cuenta Itaú',
    });
    const b = await send('POST', '/accounts', { name: 'Suelta', type: 'checking' });
    const backup = await send('GET', '/export/backup');

    await send('PUT', `/accounts/${a.body.id}`, { groupName: null });
    await send('PUT', `/accounts/${b.body.id}`, { groupName: 'Otro' });

    const restored = await send('POST', '/export/restore', backup.body);
    expect(restored.status).toBe(200);
    expect(await groupOf(a.body.id)).toBe('Cuenta Itaú');
    expect(await groupOf(b.body.id)).toBeNull();
  });

  it('a backup from before groups restores every account ungrouped', async () => {
    const backup = await send('GET', '/export/backup');
    const older = {
      ...backup.body,
      accounts: (backup.body.accounts as Record<string, unknown>[]).map(
        ({ groupName: _dropped, ...rest }) => rest,
      ),
    };
    const restored = await send('POST', '/export/restore', older);
    expect(restored.status).toBe(200);
    const list = await send('GET', '/accounts');
    expect(list.body.length).toBeGreaterThan(0);
    expect((list.body as Listed[]).every((a) => a.groupName === null)).toBe(true);
  });
});
