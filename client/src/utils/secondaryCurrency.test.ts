import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays, format, parseISO } from 'date-fns';
import {
  SECONDARY_RATE_MAX_AGE_DAYS,
  figureDay,
  secondaryCurrencyOptions,
  secondaryFigure,
  secondaryLookup,
} from './secondaryCurrency';

const code = fc.constantFrom('USD', 'EUR', 'UYU', 'JPY', 'GBP', 'BRL');
const day = fc
  .date({ min: new Date(2000, 0, 1), max: new Date(2090, 11, 31), noInvalidDate: true })
  .map((d) => format(d, 'yyyy-MM-dd'));
const cents = fc.integer({ min: -1e12, max: 1e12 });
const shift = (iso: string, days: number) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');

describe('the Secondary Currency figure (property-based)', () => {
  it('shows nothing without a Secondary Currency, when it is the budget’s, or when not offered', () => {
    fc.assert(
      fc.property(
        code,
        fc.option(code),
        fc.array(code),
        cents,
        day,
        (budget, secondary, offered, amount, d) => {
          const expectNone = !secondary || secondary === budget || !offered.includes(secondary);
          const input = { secondary, budget, offered, amount, day: d };
          const figure = secondaryFigure({
            ...input,
            conversion: { amount: Math.abs(amount), rate: '1', date: d },
          });
          expect(figure.kind === 'none').toBe(expectNone);
          if (expectNone) expect(secondaryLookup(input)).toBeNull();
        },
      ),
    );
  });

  it('shows a rate at most 4 days old, keeping the sign; hides older ones and no rate at all', () => {
    fc.assert(
      fc.property(
        cents.filter((c) => c !== 0),
        fc.integer({ min: 0, max: 1e12 }),
        day,
        fc.integer({ min: 0, max: 40 }),
        (amount, converted, d, age) => {
          const base = { secondary: 'USD', budget: 'UYU', offered: ['USD'], amount, day: d };
          const lookup = secondaryLookup(base);
          expect(lookup).toEqual({ from: 'UYU', to: 'USD', amount: Math.abs(amount) });

          const rateDate = shift(d, -age);
          const figure = secondaryFigure({
            ...base,
            conversion: { amount: converted, rate: '0.025', date: rateDate },
          });
          if (age > SECONDARY_RATE_MAX_AGE_DAYS) {
            expect(figure).toEqual({ kind: 'hidden', currency: 'USD' });
          } else {
            expect(figure.kind).toBe('shown');
            if (figure.kind !== 'shown') return;
            expect(Math.abs(figure.amount)).toBe(converted);
            if (converted !== 0) expect(Math.sign(figure.amount)).toBe(Math.sign(amount));
            expect(Object.is(figure.amount, -0)).toBe(false);
            expect(figure.rateDate).toBe(rateDate);
          }

          expect(
            secondaryFigure({ ...base, conversion: { amount: null, rate: null, date: null } }),
          ).toEqual({ kind: 'hidden', currency: 'USD' });
          expect(secondaryFigure({ ...base, conversion: undefined }).kind).toBe('pending');
        },
      ),
    );
  });

  it('shows zero without looking anything up', () => {
    fc.assert(
      fc.property(day, (d) => {
        const input = { secondary: 'EUR', budget: 'USD', offered: ['EUR'], amount: 0, day: d };
        expect(secondaryLookup(input)).toBeNull();
        expect(secondaryFigure({ ...input, conversion: undefined })).toEqual({
          kind: 'shown',
          currency: 'EUR',
          amount: 0,
          rate: null,
          rateDate: null,
        });
      }),
    );
  });
});

describe('secondaryCurrencyOptions', () => {
  it('offers account and typed-in rate currencies once each, sorted, never the budget’s', () => {
    fc.assert(
      fc.property(
        fc.option(code),
        fc.array(code),
        fc.array(fc.record({ base: code, quote: code })),
        (budget, accounts, rates) => {
          const options = secondaryCurrencyOptions(budget, accounts, rates);
          expect(options).toEqual([...new Set(options)].sort());
          if (budget) expect(options).not.toContain(budget);
          for (const c of [...accounts, ...rates.flatMap((r) => [r.base, r.quote])]) {
            if (c !== budget) expect(options).toContain(c);
          }
        },
      ),
    );
  });
});

describe('figureDay', () => {
  it('is a day point itself, or a month’s last day, never after today', () => {
    fc.assert(
      fc.property(day, day, (point, today) => {
        const result = figureDay(point, today);
        expect(result).toBe(point < today ? point : today);
        expect(figureDay(point.slice(0, 7), today) <= today).toBe(true);
      }),
    );
    expect(figureDay('2026-03', '2026-10-25')).toBe('2026-03-31');
    expect(figureDay('2026-10', '2026-10-25')).toBe('2026-10-25');
  });
});
