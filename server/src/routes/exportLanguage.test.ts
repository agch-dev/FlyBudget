import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { exchangeRates } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { exportRouter } from './export.js';
import { transactionsRouter } from './transactions.js';

// The CSV files the server builds follow the App Language of the device that asks. A download
// is a plain navigation, so the language is in its address (`lang`); none, or one the app
// doesn't have, is English.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const account = await post('/accounts', { name: 'Caja', type: 'checking', currency: 'USD' });
  const paid = await post('/transactions', {
    accountId: account.id,
    date: '2026-05-10',
    amount: -123_456,
    payeeName: 'Tienda Inglesa',
    notes: '=SUM(A1)',
  });
  await fetch(`${base}/accounts/${account.id}/reconcile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionIds: [paid.id] }),
  });
  await post('/transactions', { accountId: account.id, date: '2026-05-11', amount: 5_000 });

  db.insert(exchangeRates)
    .values([
      { date: '2026-10-01', rate: 40, fetchedAt: '2026-10-02T12:00:00.000Z', isManual: 0 },
      { date: '2026-10-02', rate: 40.125, fetchedAt: '2026-10-02T12:00:00.000Z', isManual: 1 },
    ])
    .run();
});
afterAll(() => server.close());

const download = async (path: string, lang?: string) => {
  const res = await fetch(`${base}/export/${path}${lang ? `?lang=${lang}` : ''}`);
  return {
    status: res.status,
    type: res.headers.get('content-type'),
    name: res.headers.get('content-disposition'),
    lines: (await res.text()).split('\n'),
  };
};

/** The addresses that get English: `lang=en`, no language, and a language the app lacks */
const ENGLISH = ['en', undefined, 'fr'];

describe('the transactions CSV', () => {
  it('is in English for lang=en, for no language and for a language the app lacks', async () => {
    for (const lang of ENGLISH) {
      const file = await download('transactions/csv', lang);
      expect(file.status).toBe(200);
      expect(file.name).toBe('attachment; filename="transactions.csv"');
      expect(file.lines).toEqual([
        'Date,Account,Group,Currency,Payee,Category,Notes,Amount,Reconciled',
        "2026-05-10,Caja,,USD,Tienda Inglesa,,'=SUM(A1),-1234.56,Yes",
        '2026-05-11,Caja,,USD,,,,50.00,No',
      ]);
    }
  });

  it('has Spanish headers, words and file name for lang=es, and nothing else changes', async () => {
    const file = await download('transactions/csv', 'es');
    expect(file.type).toContain('text/csv');
    expect(file.name).toBe('attachment; filename="transacciones.csv"');
    expect(file.lines).toEqual([
      'Fecha,Cuenta,Grupo,Moneda,Beneficiario,Categoría,Notas,Monto,Conciliada',
      // The date, the currency code and the amount are written as in English
      "2026-05-10,Caja,,USD,Tienda Inglesa,,'=SUM(A1),-1234.56,Sí",
      '2026-05-11,Caja,,USD,,,,50.00,No',
    ]);
  });
});

describe('the exchange rates CSV', () => {
  it('is in English for lang=en, for no language and for a language the app lacks', async () => {
    for (const lang of ENGLISH) {
      const file = await download('exchange-rates/csv', lang);
      expect(file.status).toBe(200);
      expect(file.name).toBe('attachment; filename="exchange-rates.csv"');
      expect(file.lines).toEqual([
        'Date,Pesos per dollar,Source',
        '2026-10-01,40,Fetched',
        '2026-10-02,40.125,Entered by hand',
      ]);
    }
  });

  it('has Spanish headers, words and file name for lang=es', async () => {
    const file = await download('exchange-rates/csv', 'es');
    expect(file.type).toContain('text/csv');
    expect(file.name).toBe('attachment; filename="tipos-de-cambio.csv"');
    expect(file.lines).toEqual([
      'Fecha,Pesos por dólar,Origen',
      '2026-10-01,40,Obtenido',
      '2026-10-02,40.125,Ingresado a mano',
    ]);
  });
});
