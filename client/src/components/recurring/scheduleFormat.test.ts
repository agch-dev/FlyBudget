import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  amountNeedsConfirming,
  describeDiscovered,
  describeUpcomingLength,
  dueText,
  formatScheduleAmount,
  frequencyLabel,
  statusLabel,
} from './scheduleFormat';
import { setLanguage } from '../../i18n';
import type { DiscoveredSchedule, RecurrenceRule } from '../../types';
import { formatCurrency } from '../../utils/currency';

const arbAmount = fc.integer({ min: -1_000_000_00, max: 1_000_000_00 });
const arbAmountType = fc.constantFrom('exact', 'approximate', 'variable');

describe("a recurring item's amount", () => {
  it("is written in its account's currency", () => {
    expect(formatScheduleAmount(-15_99, 'exact', 'USD')).toBe('US$15.99');
    expect(formatScheduleAmount(-15_99, 'exact', 'UYU')).toBe('$15.99');
    expect(formatScheduleAmount(1_200_00, 'approximate', 'USD')).toBe('~+US$1,200');
    expect(formatScheduleAmount(-2_500_00, 'variable', 'UYU')).toBe('~$2,500');
  });

  it('counts as pesos when no currency is known', () => {
    fc.assert(
      fc.property(arbAmount, arbAmountType, (amount, type) => {
        expect(formatScheduleAmount(amount, type)).toBe(formatScheduleAmount(amount, type, 'UYU'));
      }),
    );
  });

  it('differs between currencies only by the sign: dollars read US$ where pesos read $', () => {
    fc.assert(
      fc.property(arbAmount, arbAmountType, (amount, type) => {
        const pesos = formatScheduleAmount(amount, type, 'UYU');
        const dollars = formatScheduleAmount(amount, type, 'USD');
        expect(dollars).toBe(pesos.replace('$', 'US$'));
        expect(dollars).toContain(formatCurrency(Math.abs(amount), 'USD'));
      }),
    );
  });
});

describe('moving a recurring item to another account', () => {
  const arbCurrency = fc.constantFrom('UYU' as const, 'USD' as const, undefined);

  it('asks to confirm the amount when the account is in the other currency', () => {
    expect(amountNeedsConfirming({ currency: 'USD' }, 'UYU')).toBe(true);
    expect(amountNeedsConfirming({ currency: 'UYU' }, 'USD')).toBe(true);
    // No account, or an item from before currencies existed, counts as pesos
    expect(amountNeedsConfirming({ currency: 'USD' }, undefined)).toBe(true);
    expect(amountNeedsConfirming({}, 'USD')).toBe(true);
    expect(amountNeedsConfirming({}, undefined)).toBe(false);
  });

  it('asks exactly when the same number would mean a different sum of money', () => {
    fc.assert(
      fc.property(arbCurrency, arbCurrency, (was, now) => {
        expect(amountNeedsConfirming({ currency: was }, now)).toBe(
          (was ?? 'UYU') !== (now ?? 'UYU'),
        );
      }),
    );
  });

  it('never asks about a new item: its amount was typed in the currency shown', () => {
    fc.assert(
      fc.property(arbCurrency, (now) => {
        expect(amountNeedsConfirming(null, now)).toBe(false);
        expect(amountNeedsConfirming(undefined, now)).toBe(false);
      }),
    );
  });
});

const found = (recurrenceRule: RecurrenceRule, exactDate = true) =>
  ({ recurrenceRule, exactDate, recurrenceType: recurrenceRule.type }) as DiscoveredSchedule;

describe('the words for a recurring item', () => {
  it('names frequencies, statuses and upcoming lengths in English', () => {
    expect(frequencyLabel('biweekly')).toBe('Every 2 Weeks');
    expect(frequencyLabel('once')).toBe('One Time');
    expect(statusLabel('waiting')).toBe('Missed');
    expect(statusLabel('scheduled')).toBe('Scheduled');
    expect(describeUpcomingLength('7')).toBe('1 week');
    expect(describeUpcomingLength('currentMonth')).toBe('End of the current month');
    expect(describeUpcomingLength('3-month')).toBe('3 months');
    expect(describeUpcomingLength('1-year')).toBe('1 year');
  });

  it('names them in Spanish', () => {
    setLanguage('es');
    expect(frequencyLabel('biweekly')).toBe('Cada 2 semanas');
    expect(frequencyLabel('monthly')).toBe('Mensual');
    expect(statusLabel('waiting')).toBe('Atrasado');
    expect(statusLabel('paid')).toBe('Pagado');
    expect(describeUpcomingLength('7')).toBe('1 semana');
    expect(describeUpcomingLength('currentMonth')).toBe('Fin del mes actual');
    expect(describeUpcomingLength('3-month')).toBe('3 meses');
    expect(describeUpcomingLength('1-year')).toBe('1 año');
  });

  it('says how far a pending date is', () => {
    expect(dueText('waiting', -1)).toBe('1 day overdue');
    expect(dueText('waiting', -4)).toBe('4 days overdue');
    expect(dueText('due', 0)).toBe('Today');
    expect(dueText('upcoming', 1)).toBe('Tomorrow');
    expect(dueText('upcoming', 9)).toBe('in 9 days');
    expect(dueText('paid', -3)).toBeNull();
    setLanguage('es');
    expect(dueText('waiting', -1)).toBe('1 día de atraso');
    expect(dueText('waiting', -4)).toBe('4 días de atraso');
    expect(dueText('due', 0)).toBe('Hoy');
    expect(dueText('upcoming', 1)).toBe('Mañana');
    expect(dueText('upcoming', 9)).toBe('en 9 días');
  });

  it('describes when a recurring item that was found repeats', () => {
    const monthly = (anchorDay: number) => found({ type: 'monthly', interval: 1, anchorDay });
    expect(describeDiscovered(found({ type: 'weekly', interval: 1, anchorDay: 1 }))).toBe(
      'Every week on Monday',
    );
    expect(describeDiscovered(found({ type: 'biweekly', anchorDay: 5 }, false))).toBe(
      'Every 2 weeks on Friday (approx.)',
    );
    expect(describeDiscovered(monthly(1))).toBe('Every month on the 1st');
    expect(describeDiscovered(monthly(2))).toBe('Every month on the 2nd');
    expect(describeDiscovered(monthly(3))).toBe('Every month on the 3rd');
    expect(describeDiscovered(monthly(5))).toBe('Every month on the 5th');
    expect(describeDiscovered(monthly(11))).toBe('Every month on the 11th');
    expect(describeDiscovered(monthly(22))).toBe('Every month on the 22nd');
    expect(describeDiscovered(monthly(31))).toBe('Every month on the last day');

    setLanguage('es');
    expect(describeDiscovered(found({ type: 'weekly', interval: 1, anchorDay: 1 }))).toBe(
      'Cada semana, el lunes',
    );
    expect(describeDiscovered(found({ type: 'biweekly', anchorDay: 6 }, false))).toBe(
      'Cada 2 semanas, el sábado (aprox.)',
    );
    expect(describeDiscovered(monthly(1))).toBe('Cada mes, el día 1');
    expect(describeDiscovered(monthly(22))).toBe('Cada mes, el día 22');
    expect(describeDiscovered(monthly(31))).toBe('Cada mes, el último día');
  });
});
