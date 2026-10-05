import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { format } from 'date-fns';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { exchangeRates } from '../db/schema.js';
import { errorHandler } from '../middleware/security.js';
import { FIRST_RATE_DATE, type DateRange, type RatePoint } from '../services/exchangeRates.js';
import {
  backfillRatesFrom,
  listRates,
  refreshRates,
  resetExchangeRateFetchState,
  saveManualRate,
} from '../services/exchangeRateService.js';
import { createExchangeRatesRouter } from './exchangeRates.js';
import { exportRouter } from './export.js';

// The source is a personal API: these tests never call it. `source` stands in for it and
// records every range it was asked for.
let asked: DateRange[] = [];
let answer: (range: DateRange) => RatePoint[] | Promise<RatePoint[]> = () => [];
const source = async (range: DateRange) => {
  asked.push(range);
  return answer(range);
};

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json()(req, res, next),
  );
  app.use('/api/exchange-rates', createExchangeRatesRouter(source));
  app.use('/api/export', exportRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

beforeEach(() => {
  db.delete(exchangeRates).run();
  resetExchangeRateFetchState();
  asked = [];
  answer = () => [];
});

const send = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

const now = new Date(2026, 9, 4, 12, 0, 0); // Sunday 4 October 2026, local time
const today = '2026-10-04';
const hoursBefore = (h: number) => new Date(now.getTime() - h * 3_600_000);
const realToday = () => format(new Date(), 'yyyy-MM-dd');

const week: RatePoint[] = [
  { date: '2026-09-30', rate: 40.286 },
  { date: '2026-10-01', rate: 40.463 },
  { date: '2026-10-02', rate: 40.342 },
];

describe('fetching on server start (refreshRates)', () => {
  it('fetches from a fixed early date on a first run and stores what came back', async () => {
    answer = () => week;
    const result = await refreshRates(source, { now });
    expect(asked).toEqual([{ start: FIRST_RATE_DATE, end: today }]);
    expect(result).toEqual({ fetched: true, stored: 3 });
    expect(listRates()).toEqual(
      week.map((r) => ({ ...r, fetchedAt: now.toISOString(), manual: false })),
    );
  });

  it('does not ask again within 24 hours', async () => {
    answer = () => week;
    await refreshRates(source, { now: hoursBefore(23) });
    asked = [];
    expect(await refreshRates(source, { now })).toEqual({ fetched: false, stored: 0 });
    expect(asked).toEqual([]);
  });

  it('asks from the last stored date through today once 24 hours have passed', async () => {
    answer = () => week;
    await refreshRates(source, { now: hoursBefore(25) });
    asked = [];
    // That last day was fetched before its rate was final
    answer = () => [{ date: '2026-10-02', rate: 40.4 }];
    await refreshRates(source, { now });
    expect(asked).toEqual([{ start: '2026-10-02', end: today }]);
    expect(listRates().at(-1)).toEqual({
      date: '2026-10-02',
      rate: 40.4,
      fetchedAt: now.toISOString(),
      manual: false,
    });
  });

  it('stores nothing when the source fails, and says so', async () => {
    answer = () => {
      throw new Error('boom');
    };
    await expect(refreshRates(source, { now })).rejects.toThrow();
    expect(listRates()).toEqual([]);
  });

  it('ignores rows outside the range it asked for', async () => {
    answer = () => [...week, { date: '2031-01-01', rate: 99 }, { date: '1999-01-01', rate: 9 }];
    await refreshRates(source, { now });
    expect(listRates().map((r) => r.date)).toEqual(week.map((r) => r.date));
  });

  it('asks once when two refreshes overlap', async () => {
    answer = () => week;
    const [a, b] = await Promise.all([
      refreshRates(source, { now, force: true }),
      refreshRates(source, { now, force: true }),
    ]);
    expect(asked).toHaveLength(1);
    expect(a).toEqual(b);
  });
});

describe('hand-entered rates', () => {
  it('are never overwritten by a fetch', async () => {
    saveManualRate('2026-10-01', 41, hoursBefore(30));
    answer = () => week;
    await refreshRates(source, { now, force: true });
    expect(listRates()).toEqual([
      { date: '2026-09-30', rate: 40.286, fetchedAt: now.toISOString(), manual: false },
      { date: '2026-10-01', rate: 41, fetchedAt: hoursBefore(30).toISOString(), manual: true },
      { date: '2026-10-02', rate: 40.342, fetchedAt: now.toISOString(), manual: false },
    ]);
  });

  it('do not count as a fetch: the next start still asks the source', async () => {
    saveManualRate('2026-10-03', 41, hoursBefore(1));
    await refreshRates(source, { now });
    expect(asked).toEqual([{ start: FIRST_RATE_DATE, end: today }]);
  });

  it('correct a fetched rate, which later fetches then leave alone', async () => {
    answer = () => week;
    await refreshRates(source, { now: hoursBefore(48) });
    saveManualRate('2026-10-02', 40.5, hoursBefore(47));
    asked = [];
    await refreshRates(source, { now });
    // Asks from the last date the source gave, so the 24-hour wait keeps working
    expect(asked).toEqual([{ start: '2026-10-01', end: today }]);
    expect(listRates().find((r) => r.date === '2026-10-02')).toMatchObject({
      rate: 40.5,
      manual: true,
    });
  });
});

describe('backfillRatesFrom', () => {
  beforeEach(async () => {
    answer = () => week;
    await refreshRates(source, { now: hoursBefore(1) });
    asked = [];
  });

  it('fetches from an older date up to the earliest stored rate, ignoring the 24 hours', async () => {
    answer = () => [{ date: '2026-09-15', rate: 39.9 }];
    expect(await backfillRatesFrom('2026-09-14', source, now)).toEqual({
      fetched: true,
      stored: 1,
    });
    expect(asked).toEqual([{ start: '2026-09-14', end: '2026-09-30' }]);
    expect(listRates()[0]).toMatchObject({ date: '2026-09-15', rate: 39.9, manual: false });
  });

  it('asks nothing for a date the rates already cover', async () => {
    expect(await backfillRatesFrom('2026-10-01', source, now)).toEqual({
      fetched: false,
      stored: 0,
    });
    expect(asked).toEqual([]);
  });

  it('does not ask again for dates the source had nothing for', async () => {
    answer = () => [];
    await backfillRatesFrom('2020-01-01', source, now);
    await backfillRatesFrom('2021-06-01', source, now);
    await backfillRatesFrom('2020-01-01', source, now);
    expect(asked).toEqual([{ start: '2020-01-01', end: '2026-09-30' }]);
  });

  it('asks once for imports that arrive together', async () => {
    answer = () => [{ date: '2026-09-15', rate: 39.9 }];
    await Promise.all([
      backfillRatesFrom('2026-09-15', source, now),
      backfillRatesFrom('2026-09-20', source, now),
    ]);
    expect(asked).toEqual([{ start: '2026-09-15', end: '2026-09-30' }]);
  });

  it('fails without storing anything when the source fails', async () => {
    answer = () => {
      throw new Error('boom');
    };
    await expect(backfillRatesFrom('2026-09-01', source, now)).rejects.toThrow();
    expect(listRates()).toHaveLength(3);
  });
});

describe('GET /exchange-rates', () => {
  it('is empty before any rate exists', async () => {
    expect(await send('GET', '/exchange-rates')).toEqual({
      status: 200,
      body: { rates: [], current: null, lastFetchedAt: null },
    });
    expect(asked).toEqual([]);
  });

  it('lists every rate, the rate in effect today and when rates were last fetched', async () => {
    answer = () => week;
    await refreshRates(source, { now: hoursBefore(2) });
    saveManualRate('2026-09-29', 40, hoursBefore(1));
    asked = [];
    const { body } = await send('GET', '/exchange-rates');
    expect(body.rates.map((r: RatePoint) => r.date)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    // Today (whenever the test runs) has no rate of its own: the closest earlier one is used
    expect(body.current).toEqual({ date: '2026-10-02', rate: 40.342 });
    // Typing a rate in is not a fetch
    expect(body.lastFetchedAt).toBe(hoursBefore(2).toISOString());
    // Reading never contacts the source
    expect(asked).toEqual([]);
  });
});

describe('POST /exchange-rates/refresh', () => {
  it('fetches from the last stored date through today, even right after a fetch', async () => {
    answer = () => week;
    await refreshRates(source, { now: new Date() });
    asked = [];
    const { status, body } = await send('POST', '/exchange-rates/refresh');
    expect(status).toBe(200);
    expect(asked).toEqual([{ start: '2026-10-02', end: realToday() }]);
    expect(body.rates).toHaveLength(3);
  });

  it('answers with an error and keeps the stored rates when the source fails', async () => {
    answer = () => week;
    await refreshRates(source, { now });
    answer = () => {
      throw new Error('secret detail');
    };
    const { status, body } = await send('POST', '/exchange-rates/refresh');
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(typeof body.error).toBe('string');
    expect(listRates()).toHaveLength(3);
  });
});

describe('PUT /exchange-rates/:date', () => {
  it('enters a rate for a date that has none', async () => {
    const { status, body } = await send('PUT', '/exchange-rates/2026-10-03', { rate: 40.35 });
    expect(status).toBe(200);
    expect(body).toMatchObject({ date: '2026-10-03', rate: 40.35, manual: true });
    const list = await send('GET', '/exchange-rates');
    expect(list.body.rates).toEqual([body]);
  });

  it('corrects a fetched rate', async () => {
    answer = () => week;
    await refreshRates(source, { now });
    await send('PUT', '/exchange-rates/2026-10-01', { rate: 41.5 });
    expect(listRates().find((r) => r.date === '2026-10-01')).toMatchObject({
      rate: 41.5,
      manual: true,
    });
    expect(listRates()).toHaveLength(3);
  });

  it.each([
    ['an impossible date', '2026-13-45', { rate: 40 }],
    ['a date years ahead', '2099-01-01', { rate: 40 }],
    ['a zero rate', '2026-10-01', { rate: 0 }],
    ['a negative rate', '2026-10-01', { rate: -3 }],
    ['an absurd rate', '2026-10-01', { rate: 1e9 }],
    ['text for a rate', '2026-10-01', { rate: '40' }],
    ['no rate', '2026-10-01', {}],
  ])('refuses %s', async (_name, date, body) => {
    expect((await send('PUT', `/exchange-rates/${date}`, body)).status).toBe(400);
    expect(listRates()).toEqual([]);
  });
});

describe('backup and restore', () => {
  it('include the rates, hand-entered ones too', async () => {
    answer = () => week;
    await refreshRates(source, { now });
    saveManualRate('2026-10-03', 40.35, now);
    const before = listRates();

    const backup = (await send('GET', '/export/backup')).body;
    expect(backup.exchangeRates).toHaveLength(4);

    db.delete(exchangeRates).run();
    saveManualRate('2020-01-01', 1, now);
    expect((await send('POST', '/export/restore', backup)).status).toBe(200);
    expect(listRates()).toEqual(before);
  });

  it('refuse a backup whose rate is not a number', async () => {
    const backup = (await send('GET', '/export/backup')).body;
    backup.exchangeRates = [
      { date: '2026-10-01', rate: 'forty', fetchedAt: now.toISOString(), isManual: 0 },
    ];
    expect((await send('POST', '/export/restore', backup)).status).toBe(400);
  });
});
