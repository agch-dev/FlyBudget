import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FIRST_RATE_DATE,
  FETCH_INTERVAL_MS,
  backfillRange,
  parseRatesResponse,
  rateLookup,
  refreshRange,
  type RatePoint,
} from './exchangeRates.js';

const isoDay = fc
  .integer({ min: 0, max: 4000 })
  .map((n) => new Date(Date.UTC(2020, 0, 1 + n)).toISOString().slice(0, 10));

/** Rates on distinct dates, in no particular order */
const rateTable = fc
  .uniqueArray(isoDay, { maxLength: 40 })
  .chain((dates) =>
    fc.tuple(
      ...dates.map((date) =>
        fc.double({ min: 1, max: 100, noNaN: true }).map((rate): RatePoint => ({ date, rate })),
      ),
    ),
  );

describe('rateLookup', () => {
  it('returns the rate stored for a date that has one', () => {
    fc.assert(
      fc.property(rateTable, fc.nat(), (rates, pick) => {
        fc.pre(rates.length > 0);
        const stored = rates[pick % rates.length];
        expect(rateLookup(rates)(stored.date)).toEqual(stored);
      }),
    );
  });

  it('carries the closest earlier rate forward to a date without one', () => {
    fc.assert(
      fc.property(rateTable, isoDay, (rates, date) => {
        const found = rateLookup(rates)(date);
        const earlier = rates.filter((r) => r.date <= date);
        if (earlier.length === 0) {
          expect(found).toBeNull();
          return;
        }
        expect(found).not.toBeNull();
        expect(found!.date <= date).toBe(true);
        // Nothing stored sits between the rate used and the date asked for
        expect(earlier.every((r) => r.date <= found!.date)).toBe(true);
        expect(rates).toContainEqual(found);
      }),
    );
  });

  it('has no rate for a date before the first stored one', () => {
    fc.assert(
      fc.property(rateTable, isoDay, (rates, date) => {
        fc.pre(rates.every((r) => r.date > date));
        expect(rateLookup(rates)(date)).toBeNull();
      }),
    );
  });

  it('uses Friday for the weekend', () => {
    const at = rateLookup([
      { date: '2026-10-05', rate: 40.5 },
      { date: '2026-10-02', rate: 40.342 },
      { date: '2026-10-01', rate: 40.463 },
    ]);
    expect(at('2026-10-03')).toEqual({ date: '2026-10-02', rate: 40.342 });
    expect(at('2026-10-04')).toEqual({ date: '2026-10-02', rate: 40.342 });
    expect(at('2026-10-05')).toEqual({ date: '2026-10-05', rate: 40.5 });
    expect(at('2026-09-30')).toBeNull();
  });
});

describe('parseRatesResponse', () => {
  it('reads the source format', () => {
    expect(
      parseRatesResponse({
        chart_data: [
          { date: '2026-09-25', rate: '40.39' },
          { date: '2026-09-28', rate: '40.273' },
        ],
        current_rate: '40.4',
        range: 'custom',
      }),
    ).toEqual([
      { date: '2026-09-25', rate: 40.39 },
      { date: '2026-09-28', rate: 40.273 },
    ]);
  });

  it('accepts no rows (a range with no business days)', () => {
    expect(parseRatesResponse({ chart_data: [] })).toEqual([]);
  });

  it.each([
    ['not an object', 'oops'],
    ['null', null],
    ['no chart_data', { rates: [] }],
    ['chart_data not a list', { chart_data: {} }],
    ['an impossible date', { chart_data: [{ date: '2026-13-45', rate: '40' }] }],
    ['a date with a time', { chart_data: [{ date: '2026-01-05T00:00:00Z', rate: '40' }] }],
    ['a rate that is not a number', { chart_data: [{ date: '2026-01-05', rate: 'abc' }] }],
    ['an empty rate', { chart_data: [{ date: '2026-01-05', rate: '' }] }],
    ['a zero rate', { chart_data: [{ date: '2026-01-05', rate: '0' }] }],
    ['a negative rate', { chart_data: [{ date: '2026-01-05', rate: '-40' }] }],
    ['an infinite rate', { chart_data: [{ date: '2026-01-05', rate: 'Infinity' }] }],
    ['an absurd rate', { chart_data: [{ date: '2026-01-05', rate: '1e9' }] }],
    ['a missing rate', { chart_data: [{ date: '2026-01-05' }] }],
    ['one bad row among good ones', { chart_data: [{ date: '2026-01-05', rate: '40' }, {}] }],
  ])('rejects %s', (_name, body) => {
    expect(() => parseRatesResponse(body)).toThrow();
  });

  it('never returns a row that is not a real date with a positive rate', () => {
    fc.assert(
      fc.property(fc.anything(), (body) => {
        let rows: RatePoint[];
        try {
          rows = parseRatesResponse(body);
        } catch {
          return;
        }
        for (const row of rows) {
          expect(new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(row.date);
          expect(row.rate > 0 && Number.isFinite(row.rate)).toBe(true);
        }
      }),
    );
  });
});

describe('refreshRange', () => {
  const now = Date.parse('2026-10-04T15:00:00Z');
  const today = '2026-10-04';
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

  it('starts from a fixed early date when nothing was ever fetched', () => {
    expect(refreshRange({ newestFetched: null, now, today })).toEqual({
      start: FIRST_RATE_DATE,
      end: today,
    });
  });

  it('fetches from the last fetched date (inclusive) through today after 24 hours', () => {
    expect(
      refreshRange({ newestFetched: { date: '2026-10-02', fetchedAt: hoursAgo(25) }, now, today }),
    ).toEqual({ start: '2026-10-02', end: today });
  });

  it('does not fetch within 24 hours of the last fetch', () => {
    expect(
      refreshRange({ newestFetched: { date: '2026-10-02', fetchedAt: hoursAgo(23) }, now, today }),
    ).toBeNull();
  });

  it('waits exactly the interval, whatever the dates (property-based)', () => {
    fc.assert(
      fc.property(isoDay, fc.integer({ min: 0, max: 10 * FETCH_INTERVAL_MS }), (date, age) => {
        const range = refreshRange({
          newestFetched: { date, fetchedAt: new Date(now - age).toISOString() },
          now,
          today,
        });
        if (age <= FETCH_INTERVAL_MS) expect(range).toBeNull();
        else expect(range).toEqual({ start: date < today ? date : today, end: today });
      }),
    );
  });

  it('ignores the 24 hours when forced (the Refresh button)', () => {
    expect(
      refreshRange({
        newestFetched: { date: '2026-10-02', fetchedAt: hoursAgo(1) },
        now,
        today,
        force: true,
      }),
    ).toEqual({ start: '2026-10-02', end: today });
  });

  it('fetches when the stored time is unreadable', () => {
    expect(
      refreshRange({ newestFetched: { date: '2026-10-02', fetchedAt: 'garbage' }, now, today }),
    ).toEqual({ start: '2026-10-02', end: today });
  });
});

describe('backfillRange', () => {
  const today = '2026-10-04';

  it('fetches from the date up to the earliest fetched rate', () => {
    expect(backfillRange({ from: '2023-05-10', earliestFetched: '2024-01-02', today })).toEqual({
      start: '2023-05-10',
      end: '2024-01-02',
    });
  });

  it('fetches through today when nothing is stored', () => {
    expect(backfillRange({ from: '2023-05-10', earliestFetched: null, today })).toEqual({
      start: '2023-05-10',
      end: today,
    });
  });

  it('does nothing for a date the stored rates already cover', () => {
    expect(backfillRange({ from: '2024-06-01', earliestFetched: '2024-01-02', today })).toBeNull();
    expect(backfillRange({ from: '2024-01-02', earliestFetched: '2024-01-02', today })).toBeNull();
  });

  it('does nothing for a date already asked for', () => {
    expect(
      backfillRange({
        from: '2023-05-10',
        earliestFetched: '2024-01-02',
        alreadyAskedFrom: '2023-01-01',
        today,
      }),
    ).toBeNull();
  });

  it('does nothing for a future date', () => {
    expect(backfillRange({ from: '2027-01-01', earliestFetched: null, today })).toBeNull();
  });
});
