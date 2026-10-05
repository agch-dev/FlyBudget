import { describe, expect, it } from 'vitest';
import { Response } from 'undici';
import { fetchRatesFromSource, ratesDisabledSource } from './exchangeRateSource.js';

// Never the real source (a personal API): `fetchImpl` stands in for the network.

const range = { start: '2026-09-25', end: '2026-10-04' };

function stub(response: () => Response) {
  const calls: { url: string; timeoutMs?: number }[] = [];
  const fetchImpl = async (
    url: string | URL,
    _init?: unknown,
    options?: { timeoutMs?: number },
  ) => {
    calls.push({ url: String(url), timeoutMs: options?.timeoutMs });
    return response();
  };
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('fetchRatesFromSource', () => {
  it('asks the source once for the range and returns its rates', async () => {
    const { calls, fetchImpl } = stub(() =>
      json({
        chart_data: [
          { date: '2026-09-25', rate: '40.39' },
          { date: '2026-10-02', rate: '40.342' },
        ],
        current_rate: '40.4',
      }),
    );
    expect(await fetchRatesFromSource(range, fetchImpl)).toEqual([
      { date: '2026-09-25', rate: 40.39 },
      { date: '2026-10-02', rate: 40.342 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://datosuruguay.com/dolar.json?range=custom&start_date=2026-09-25&end_date=2026-10-04',
    );
    expect(calls[0].timeoutMs).toBeLessThanOrEqual(30_000);
  });

  it.each([
    ['an error status', () => json({ chart_data: [] }, 500)],
    ['a page that is not JSON', () => new Response('<html>down for maintenance</html>')],
    ['JSON of another shape', () => json({ error: 'nope' })],
    ['a malformed row', () => json({ chart_data: [{ date: '2026-09-25', rate: 'n/a' }] })],
    ['an oversized answer', () => new Response('['.repeat(3 * 1024 * 1024))],
  ])('rejects %s', async (_name, response) => {
    const { fetchImpl } = stub(response);
    await expect(fetchRatesFromSource(range, fetchImpl)).rejects.toThrow();
  });

  it('refuses a range that is not two real dates, without asking', async () => {
    const { calls, fetchImpl } = stub(() => json({ chart_data: [] }));
    await expect(
      fetchRatesFromSource({ start: '2026-09-25&x=1', end: '2026-10-04' }, fetchImpl),
    ).rejects.toThrow();
    await expect(
      fetchRatesFromSource({ start: '2026-10-05', end: '2026-10-04' }, fetchImpl),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});

describe('ratesDisabledSource', () => {
  it('always fails', async () => {
    await expect(ratesDisabledSource(range)).rejects.toThrow();
  });
});
