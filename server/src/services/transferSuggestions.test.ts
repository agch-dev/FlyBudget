import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { LinkSide } from './transferLink.js';
import { pairKey, suggestTransfers } from './transferSuggestions.js';

const tx = (id: string, accountId: string, amount: number, extra: Partial<LinkSide> = {}) =>
  ({
    id,
    accountId,
    date: '2025-03-10',
    amount,
    currency: 'UYU',
    reconciled: 0,
    isParent: 0,
    parentTransactionId: null,
    transferTransactionId: null,
    ...extra,
  }) satisfies LinkSide;

const day = (n: number) => `2025-03-${String(n).padStart(2, '0')}`;
const noRates = () => null;
const rate = (value: number) => () => value;

/** The suggested pairs as "outflow>inflow" */
const pairs = (...args: Parameters<typeof suggestTransfers>) =>
  suggestTransfers(...args).map((s) => `${s.outflow.id}>${s.inflow.id}`);

describe('same-currency suggestions', () => {
  it('pair an outflow and an inflow of equal opposite amounts in different accounts', () => {
    const found = suggestTransfers(
      [tx('in', 'savings', 5000), tx('out', 'checking', -5000)],
      noRates,
    );
    expect(found).toHaveLength(1);
    expect(found[0].outflow.id).toBe('out');
    expect(found[0].inflow.id).toBe('in');
    expect(found[0].rate).toBeNull();
  });

  it('need the same amount, different accounts and opposite directions', () => {
    expect(pairs([tx('a', 'one', -5000), tx('b', 'two', 5001)], noRates)).toEqual([]);
    expect(pairs([tx('a', 'one', -5000), tx('b', 'one', 5000)], noRates)).toEqual([]);
    expect(pairs([tx('a', 'one', -5000), tx('b', 'two', -5000)], noRates)).toEqual([]);
    expect(pairs([tx('a', 'one', 0), tx('b', 'two', 0)], noRates)).toEqual([]);
  });

  it('are made up to 3 days apart, in either order, and no further', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 28 }),
        (outDay, inDay) => {
          const found = pairs(
            [
              tx('out', 'one', -5000, { date: day(outDay) }),
              tx('in', 'two', 5000, { date: day(inDay) }),
            ],
            noRates,
          );
          expect(found).toEqual(Math.abs(outDay - inDay) <= 3 ? ['out>in'] : []);
        },
      ),
    );
  });

  it('count days across a month end', () => {
    const out = tx('out', 'one', -5000, { date: '2025-02-27' });
    expect(pairs([out, tx('in', 'two', 5000, { date: '2025-03-02' })], noRates)).toEqual([
      'out>in',
    ]);
    expect(pairs([out, tx('in', 'two', 5000, { date: '2025-03-03' })], noRates)).toEqual([]);
  });
});

describe('pesos-to-dollars suggestions', () => {
  const pesosOut = (amount: number, extra: Partial<LinkSide> = {}) =>
    tx('pesos', 'checking', -amount, extra);
  const dollarsIn = (amount: number, extra: Partial<LinkSide> = {}) =>
    tx('dollars', 'usd', amount, { currency: 'USD', ...extra });

  it('pair amounts whose implied rate is close to the exchange rate, and report it', () => {
    // $ 40,500 for US$ 1,000 is 40.5 pesos per dollar against a rate of 40
    const found = suggestTransfers([pesosOut(4_050_000), dollarsIn(100_000)], rate(40));
    expect(found).toHaveLength(1);
    expect(found[0].rate).toBe(40.5);
  });

  it('work in the other direction too: dollars out, pesos in', () => {
    const found = pairs(
      [tx('d', 'usd', -100_000, { currency: 'USD' }), tx('p', 'checking', 4_000_000)],
      rate(40),
    );
    expect(found).toEqual(['d>p']);
  });

  it('accept an implied rate up to 3% from the exchange rate and nothing beyond', () => {
    fc.assert(
      fc.property(
        // Whole dollars and a whole rate, so 3% of the pesos is a whole number of cents
        fc.integer({ min: 1, max: 50_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom(-1, 1),
        (dollars, pesosPerDollar, direction) => {
          const expected = dollars * 100 * pesosPerDollar;
          const edge = expected + direction * dollars * pesosPerDollar * 3;
          const at = (pesos: number) =>
            pairs([pesosOut(pesos), dollarsIn(dollars * 100)], rate(pesosPerDollar));
          expect(at(expected)).toEqual(['pesos>dollars']);
          expect(at(edge)).toEqual(['pesos>dollars']);
          expect(at(edge + direction)).toEqual([]);
        },
      ),
    );
  });

  it('use the rate of the day the money left', () => {
    const rateOn = (date: string) => (date === day(10) ? 40 : 50);
    const found = (outDay: number, inDay: number) =>
      pairs(
        [pesosOut(4_000_000, { date: day(outDay) }), dollarsIn(100_000, { date: day(inDay) })],
        rateOn,
      );
    expect(found(10, 12)).toEqual(['pesos>dollars']);
    expect(found(12, 10)).toEqual([]);
  });

  it('are not made for a day with no exchange rate', () => {
    expect(pairs([pesosOut(4_000_000), dollarsIn(100_000)], noRates)).toEqual([]);
  });

  it('never pair two different currencies by equal amounts alone', () => {
    expect(pairs([pesosOut(100_000), dollarsIn(100_000)], rate(40))).toEqual([]);
  });
});

describe('which transactions are considered', () => {
  it('leaves out transfers, reconciled transactions, split parents and split parts', () => {
    const skipped: Partial<LinkSide>[] = [
      { transferTransactionId: 'x' },
      { reconciled: 1 },
      { isParent: 1 },
      { parentTransactionId: 'parent' },
    ];
    for (const extra of skipped) {
      expect(pairs([tx('a', 'one', -5000, extra), tx('b', 'two', 5000)], noRates)).toEqual([]);
      expect(pairs([tx('a', 'one', -5000), tx('b', 'two', 5000, extra)], noRates)).toEqual([]);
    }
  });

  it('leaves out a dismissed pair, whichever side is named first', () => {
    const list = [tx('a', 'one', -5000), tx('b', 'two', 5000)];
    expect(pairs(list, noRates, new Set([pairKey('a', 'b')]))).toEqual([]);
    expect(pairs(list, noRates, new Set([pairKey('b', 'a')]))).toEqual([]);
    expect(pairs(list, noRates, new Set([pairKey('a', 'other')]))).toEqual(['a>b']);
  });
});

describe('one suggestion per transaction', () => {
  it('keeps the pair with the closest dates', () => {
    const found = pairs(
      [
        tx('out', 'one', -5000, { date: day(10) }),
        tx('far', 'two', 5000, { date: day(8) }),
        tx('near', 'two', 5000, { date: day(11) }),
      ],
      noRates,
    );
    expect(found).toEqual(['out>near']);
  });

  it('keeps the pair with the closest rate when the dates are equally close', () => {
    const found = pairs(
      [
        tx('out', 'checking', -4_000_000),
        tx('off', 'usd', 99_000, { currency: 'USD' }),
        tx('exact', 'usd', 100_000, { currency: 'USD' }),
      ],
      rate(40),
    );
    expect(found).toEqual(['out>exact']);
  });

  it('prefers closer dates to a closer rate', () => {
    const found = pairs(
      [
        tx('out', 'checking', -4_000_000, { date: day(10) }),
        tx('exact', 'usd', 100_000, { currency: 'USD', date: day(12) }),
        tx('off', 'usd', 99_000, { currency: 'USD', date: day(10) }),
      ],
      rate(40),
    );
    expect(found).toEqual(['out>off']);
  });

  it('offers the next best pair once the best one is dismissed', () => {
    const list = [
      tx('out', 'one', -5000, { date: day(10) }),
      tx('far', 'two', 5000, { date: day(8) }),
      tx('near', 'two', 5000, { date: day(11) }),
    ];
    expect(pairs(list, noRates, new Set([pairKey('out', 'near')]))).toEqual(['out>far']);
  });

  it('pairs up two transfers of the same amount instead of dropping one', () => {
    const found = pairs(
      [
        tx('out1', 'one', -5000, { date: day(10) }),
        tx('in1', 'two', 5000, { date: day(10) }),
        tx('out2', 'one', -5000, { date: day(12) }),
        tx('in2', 'two', 5000, { date: day(12) }),
      ],
      noRates,
    );
    expect(found.sort()).toEqual(['out1>in1', 'out2>in2']);
  });

  const anyTransaction = fc.record<LinkSide>({
    id: fc.constant(''),
    accountId: fc.constantFrom('one', 'two', 'usd'),
    date: fc.integer({ min: 1, max: 12 }).map(day),
    amount: fc.constantFrom(-4_000_000, -5000, -100_000, 0, 5000, 100_000, 4_100_000),
    currency: fc.constant(''),
    reconciled: fc.constantFrom(0, 0, 0, 1),
    isParent: fc.constantFrom(0, 0, 0, 1),
    parentTransactionId: fc.constantFrom(null, null, null, 'p'),
    transferTransactionId: fc.constantFrom(null, null, null, 't'),
  });
  const register = fc.array(anyTransaction, { maxLength: 14 }).map((list) =>
    list.map((t, i) => ({
      ...t,
      id: `t${i}`,
      currency: t.accountId === 'usd' ? 'USD' : 'UYU',
    })),
  );

  it('holds for any register: every transaction is in at most one suggestion', () => {
    fc.assert(
      fc.property(register, (list) => {
        const used = suggestTransfers(list, rate(40)).flatMap((s) => [s.outflow.id, s.inflow.id]);
        expect(new Set(used).size).toBe(used.length);
      }),
    );
  });

  it('holds for any register: every suggestion is a possible transfer', () => {
    fc.assert(
      fc.property(register, (list) => {
        for (const { outflow, inflow } of suggestTransfers(list, rate(40))) {
          for (const t of [outflow, inflow]) {
            expect(t.reconciled).toBe(0);
            expect(t.isParent).toBe(0);
            expect(t.parentTransactionId).toBeNull();
            expect(t.transferTransactionId).toBeNull();
          }
          expect(outflow.amount).toBeLessThan(0);
          expect(inflow.amount).toBeGreaterThan(0);
          expect(outflow.accountId).not.toBe(inflow.accountId);
          const days = Math.abs(Number(outflow.date.slice(8)) - Number(inflow.date.slice(8)));
          expect(days).toBeLessThanOrEqual(3);
          if (outflow.currency === inflow.currency) expect(inflow.amount).toBe(-outflow.amount);
        }
      }),
    );
  });

  it('holds for any register: dismissing a suggestion never suggests that pair again', () => {
    fc.assert(
      fc.property(register, (list) => {
        const dismissed = new Set<string>();
        // Dismissing everything offered, round after round, ends with nothing left to offer
        for (let round = 0; round < 60; round++) {
          const found = suggestTransfers(list, rate(40), dismissed);
          if (found.length === 0) return;
          for (const s of found) {
            const key = pairKey(s.outflow.id, s.inflow.id);
            expect(dismissed.has(key)).toBe(false);
            dismissed.add(key);
          }
        }
        throw new Error('suggestions never ran out');
      }),
    );
  });

  it('holds for any register: the order the transactions arrive in does not matter', () => {
    fc.assert(
      fc.property(register, (list) => {
        const forwards = pairs(list, rate(40)).sort();
        const backwards = pairs([...list].reverse(), rate(40)).sort();
        expect(backwards).toEqual(forwards);
      }),
    );
  });
});
