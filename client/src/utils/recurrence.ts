import { addWeeks, addMonths, parseISO, format, isBefore, isAfter, min as minDate, lastDayOfMonth } from 'date-fns';

export type Frequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'quarterly' | 'semiannually' | 'yearly';

export interface RecurringDefinition {
  startDate: string;
  endDate: string | null;
  frequency: Frequency;
}

function clampDay(year: number, month: number, day: number): Date {
  const last = lastDayOfMonth(new Date(year, month, 1));
  const clamped = Math.min(day, last.getDate());
  return new Date(year, month, clamped);
}

function stepMonthly(start: Date, months: number, rangeStart: Date, rangeEnd: Date, endDate: Date | null): string[] {
  const results: string[] = [];
  const day = start.getDate();
  let current = start;

  while (!isAfter(current, rangeEnd) && (!endDate || !isAfter(current, endDate))) {
    if (!isBefore(current, rangeStart)) {
      results.push(format(current, 'yyyy-MM-dd'));
    }
    const next = addMonths(current, months);
    current = clampDay(next.getFullYear(), next.getMonth(), day);
  }
  return results;
}

export function computeOccurrences(def: RecurringDefinition, rangeStart: string, rangeEnd: string): string[] {
  const start = parseISO(def.startDate);
  const rStart = parseISO(rangeStart);
  const rEnd = parseISO(rangeEnd);
  const end = def.endDate ? parseISO(def.endDate) : null;

  const effectiveEnd = end ? minDate([rEnd, end]) : rEnd;

  if (isAfter(start, effectiveEnd)) return [];

  switch (def.frequency) {
    case 'weekly':
    case 'biweekly': {
      const step = def.frequency === 'weekly' ? 1 : 2;
      const results: string[] = [];
      let current = start;
      if (isBefore(current, rStart)) {
        const diffMs = rStart.getTime() - current.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        const skipWeeks = Math.floor(diffWeeks / step) * step;
        if (skipWeeks > 0) current = addWeeks(current, skipWeeks);
      }
      while (!isAfter(current, effectiveEnd)) {
        if (!isBefore(current, rStart)) {
          results.push(format(current, 'yyyy-MM-dd'));
        }
        current = addWeeks(current, step);
      }
      return results;
    }

    case 'semimonthly': {
      const results: string[] = [];
      const day1 = start.getDate();
      const day2 = day1 <= 15 ? 15 : Math.min(day1 + 15, 28);
      let year = start.getFullYear();
      let month = start.getMonth();
      if (isBefore(start, rStart)) {
        const monthsDiff = (rStart.getFullYear() - year) * 12 + (rStart.getMonth() - month);
        if (monthsDiff > 1) {
          month += monthsDiff - 1;
          year += Math.floor(month / 12);
          month = month % 12;
        }
      }
      const MAX_ITERATIONS = 5000;
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const d1 = clampDay(year, month, day1);
        const d2 = clampDay(year, month, day2);
        const dates = day1 <= day2 ? [d1, d2] : [d2, d1];
        let allPast = true;
        for (const d of dates) {
          if (isAfter(d, effectiveEnd)) return results;
          if (isBefore(d, start)) continue;
          if (!isBefore(d, rStart)) {
            results.push(format(d, 'yyyy-MM-dd'));
          }
          if (!isAfter(d, effectiveEnd)) allPast = false;
        }
        if (allPast && isAfter(d1, effectiveEnd)) break;
        month++;
        if (month > 11) { month = 0; year++; }
      }
      return results;
    }

    case 'monthly':
      return stepMonthly(start, 1, rStart, rEnd, end);
    case 'quarterly':
      return stepMonthly(start, 3, rStart, rEnd, end);
    case 'semiannually':
      return stepMonthly(start, 6, rStart, rEnd, end);
    case 'yearly':
      return stepMonthly(start, 12, rStart, rEnd, end);
  }
}
