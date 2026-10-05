import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  centsToInput,
  currencySymbol,
  formatCentsAxis,
  formatCurrency,
  homeCurrencyTotal,
  impliedRate,
  inHomeCurrency,
  listTotal,
  parseCents,
} from './currency';

describe('the rate a transfer between currencies implies', () => {
  it('is pesos per dollar, whichever side is which', () => {
    const pesos = { amount: -4_000_000, currency: 'UYU' as const };
    const dollars = { amount: 100_000, currency: 'USD' as const };
    expect(impliedRate(pesos, dollars)).toBe(40);
    expect(impliedRate(dollars, pesos)).toBe(40);
    expect(impliedRate({ amount: 1_003_125 }, { amount: -25_000, currency: 'USD' })).toBe(40.125);
  });

  it('is nothing until both amounts are typed, or between accounts of one currency', () => {
    expect(
      impliedRate({ amount: 4_000_000, currency: 'UYU' }, { amount: 0, currency: 'USD' }),
    ).toBe(null);
    expect(impliedRate({ amount: 0, currency: 'UYU' }, { amount: 100_000, currency: 'USD' })).toBe(
      null,
    );
    expect(impliedRate({ amount: 500, currency: 'USD' }, { amount: -500, currency: 'USD' })).toBe(
      null,
    );
    expect(impliedRate({ amount: 500 }, { amount: -500, currency: 'UYU' })).toBe(null);
  });
});

// Up to ±$100 billion, far beyond any real balance but still exact in a double
const arbCents = fc.integer({ min: -10_000_000_000_00, max: 10_000_000_000_00 });

// Undo formatCurrency's "-$1,234.56" formatting to get cents back
const unformat = (s: string) => {
  const negative = s.startsWith('-');
  const digits = s.replace(/US\$|[-$,]/g, '');
  const cents = Math.round(parseFloat(digits) * 100);
  return negative ? -cents : cents;
};

describe('amounts in pesos and dollars', () => {
  it('writes pesos with $ and dollars with US$', () => {
    expect(formatCurrency(123_456, 'UYU')).toBe('$1,234.56');
    expect(formatCurrency(123_456, 'USD')).toBe('US$1,234.56');
    expect(formatCurrency(-123_456, 'UYU')).toBe('-$1,234.56');
    expect(formatCurrency(-123_456, 'USD')).toBe('-US$1,234.56');
    expect(formatCurrency(500_000, 'USD')).toBe('US$5,000');
    expect(formatCurrency(0, 'USD')).toBe('US$0');
  });

  it('is in pesos, the home currency, when no currency is given', () => {
    expect(formatCurrency(123_456)).toBe('$1,234.56');
    expect(formatCentsAxis(1_250_000)).toBe('$12.5k');
  });

  it('labels axes in either currency', () => {
    expect(formatCentsAxis(95_000, 'USD')).toBe('US$950');
    expect(formatCentsAxis(1_250_000, 'USD')).toBe('US$12.5k');
    expect(formatCentsAxis(-120_000_000, 'USD')).toBe('-US$1.2M');
  });

  it('names each currency by its sign', () => {
    expect(currencySymbol('UYU')).toBe('$');
    expect(currencySymbol('USD')).toBe('US$');
  });

  it('a dollar amount is the pesos amount with US in front: same digits and separators', () => {
    fc.assert(
      fc.property(arbCents, (cents) => {
        const pesos = formatCurrency(cents, 'UYU');
        const dollars = formatCurrency(cents, 'USD');
        expect(dollars).toBe(pesos.replace('$', 'US$'));
        expect(dollars).toMatch(/^-?US\$\d{1,3}(,\d{3})*(\.\d{2})?$/);
        expect(formatCentsAxis(cents, 'USD')).toBe(
          formatCentsAxis(cents, 'UYU').replace('$', 'US$'),
        );
      }),
    );
  });

  it('reads back to the same cents in either currency', () => {
    fc.assert(
      fc.property(arbCents, fc.constantFrom('UYU' as const, 'USD' as const), (cents, currency) => {
        expect(unformat(formatCurrency(cents, currency))).toBe(cents);
      }),
    );
  });
});

describe('combined totals', () => {
  const arbItem = fc.record({
    currency: fc.constantFrom('UYU' as const, 'USD' as const),
    balance: arbCents,
  });

  it('count pesos accounts only, in their original order', () => {
    const accounts = [
      { name: 'Caja', currency: 'UYU' as const, balance: 150_000_00 },
      { name: 'Caja USD', currency: 'USD' as const, balance: 3_200_00 },
      { name: 'Tarjeta', currency: 'UYU' as const, balance: -20_000_00 },
    ];
    expect(inHomeCurrency(accounts).map((a) => a.name)).toEqual(['Caja', 'Tarjeta']);
    expect(homeCurrencyTotal(accounts, (a) => a.balance)).toBe(130_000_00);
  });

  it('never change when dollar amounts are added, removed or changed', () => {
    fc.assert(
      fc.property(fc.array(arbItem), fc.array(arbCents), (items, dollarBalances) => {
        const dollars = dollarBalances.map((balance) => ({ currency: 'USD' as const, balance }));
        const pesosOnly = items.filter((i) => i.currency === 'UYU');
        const total = homeCurrencyTotal(pesosOnly, (i) => i.balance);
        expect(homeCurrencyTotal([...items, ...dollars], (i) => i.balance)).toBe(total);
        expect(homeCurrencyTotal(dollars, (i) => i.balance)).toBe(0);
      }),
    );
  });

  it('a list in one currency adds up in that currency', () => {
    const dollars = [
      { currency: 'USD' as const, amount: 1_000 },
      { currency: 'USD' as const, amount: 250 },
    ];
    expect(listTotal(dollars, (t) => t.amount)).toEqual({ currency: 'USD', total: 1_250 });
    const pesos = [{ currency: 'UYU' as const, amount: 40_000 }, { amount: 2_000 }];
    expect(listTotal(pesos, (t) => t.amount)).toEqual({ currency: 'UYU', total: 42_000 });
  });

  it('a list that mixes currencies adds up its pesos only', () => {
    const mixed = [
      { currency: 'UYU' as const, amount: 40_000 },
      { currency: 'USD' as const, amount: 1_000 },
      { currency: 'UYU' as const, amount: 500 },
    ];
    expect(listTotal(mixed, (t) => t.amount)).toEqual({ currency: 'UYU', total: 40_500 });
    expect(listTotal([], () => 1)).toEqual({ currency: 'UYU', total: 0 });
  });

  it('treat something with no currency as pesos', () => {
    expect(inHomeCurrency([{ balance: 5 }, { balance: 7, currency: undefined }])).toHaveLength(2);
  });
});

describe('currency helpers (property-based)', () => {
  it('parseCents(centsToInput(c)) gives back the absolute amount', () => {
    fc.assert(
      fc.property(arbCents, (cents) => {
        expect(parseCents(centsToInput(cents))).toBe(Math.abs(cents));
      }),
    );
  });

  it('parses any "dollars.cc" string to exact integer cents', () => {
    fc.assert(
      fc.property(fc.nat({ max: 100_000_000_000 }), fc.nat({ max: 99 }), (dollars, cc) => {
        const s = `${dollars}.${String(cc).padStart(2, '0')}`;
        expect(parseCents(s)).toBe(dollars * 100 + cc);
      }),
    );
  });

  it('always returns a finite integer, never NaN or a fraction of a cent', () => {
    fc.assert(
      fc.property(
        // Arbitrary text plus number-like strings, including exponents such as "1e400"
        fc.oneof(
          fc.string(),
          fc.double().map(String),
          fc.double().map((d) => d.toExponential()),
        ),
        (s) => {
          expect(Number.isSafeInteger(parseCents(s))).toBe(true);
        },
      ),
    );
  });

  it('formatCurrency round-trips to the same cents, with 0 or 2 decimals', () => {
    fc.assert(
      fc.property(arbCents, (cents) => {
        const s = formatCurrency(cents);
        expect(unformat(s)).toBe(cents);
        expect(s).toMatch(/^-?\$\d{1,3}(,\d{3})*(\.\d{2})?$/);
        expect(s.startsWith('-')).toBe(cents < 0);
      }),
    );
  });
});

// Undo formatCentsAxis's "-$1.5M" formatting to get dollars back
const unformatAxis = (s: string) => {
  const m = /^(-?)\$(\d+(?:\.\d)?)([kM]?)$/.exec(s);
  if (!m) throw new Error(`unexpected axis label ${s}`);
  const scale = m[3] === 'M' ? 1_000_000 : m[3] === 'k' ? 1_000 : 1;
  return (m[1] ? -1 : 1) * Number(m[2]) * scale;
};

describe('formatCentsAxis (property-based)', () => {
  it('reads back within rounding of the real amount, with the right sign', () => {
    fc.assert(
      fc.property(arbCents, (cents) => {
        const s = formatCentsAxis(cents);
        const dollars = cents / 100;
        const back = unformatAxis(s);
        // One decimal of k/M is at most 5% off; whole dollars at most $0.50
        expect(Math.abs(back - dollars)).toBeLessThanOrEqual(
          Math.max(0.5, Math.abs(dollars) * 0.05) + 1e-6,
        );
        if (Math.abs(dollars) >= 0.5) expect(s.startsWith('-')).toBe(cents < 0);
      }),
    );
  });

  it('labels whole thousands and millions exactly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), fc.integer({ min: 1, max: 5000 }), (k, m) => {
        expect(formatCentsAxis(k * 1_000_00)).toBe(`$${k}k`);
        expect(formatCentsAxis(m * 1_000_000_00)).toBe(`$${m}M`);
        expect(formatCentsAxis(-k * 1_000_00)).toBe(`-$${k}k`);
      }),
    );
  });

  it('gives each distinct nice tick a distinct label', () => {
    // Axis ticks are multiples of a step like 25k or 50k; labels must never repeat
    const ticks = [0, 35_000, 70_000, 100_000, 135_000, 250_000, 1_000_000, 1_500_000];
    const labels = ticks.map((d) => formatCentsAxis(d * 100));
    expect(new Set(labels).size).toBe(ticks.length);
  });
});
