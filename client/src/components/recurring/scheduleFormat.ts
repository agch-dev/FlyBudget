import { formatCurrency } from '../../utils/currency';
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { t } from '../../i18n';
import {
  HOME_CURRENCY,
  RECURRENCE_TYPES,
  type AmountType,
  type Currency,
  type DiscoveredSchedule,
  type OccurrenceDisplayStatus,
  type RecurrenceType,
  type ScheduleOccurrence,
} from '../../types';
import type { RecurringBadgeStatus } from './StatusBadge';

export { RECURRENCE_TYPES };

/** How often an item repeats: "Monthly", "Cada 2 semanas" */
export const frequencyLabel = (type: RecurrenceType): string => t(`recurring:frequency.${type}`);

/** The words on a status badge */
export const statusLabel = (status: RecurringBadgeStatus): string =>
  t(`recurring:status.${status}`);

/**
 * How far a pending date is from today ("3 days overdue", "Tomorrow", "in 9 days"); null for
 * an item that is no longer pending. `daysUntil` is negative for a date that has passed.
 */
export function dueText(status: OccurrenceDisplayStatus, daysUntil: number): string | null {
  if (status === 'waiting') return t('recurring:due.overdue', { count: Math.abs(daysUntil) });
  if (status !== 'upcoming' && status !== 'due') return null;
  if (daysUntil === 0) return t('recurring:due.today');
  if (daysUntil === 1) return t('recurring:due.tomorrow');
  return t('recurring:due.inDays', { count: daysUntil });
}

/** A weekday's name in the App Language, 0 = Sunday */
const weekdayName = (day: number) => format(new Date(2023, 0, 1 + day), 'EEEE');

/** When a recurring item that was found repeats, like Actual's getRecurringDescription. */
export function describeDiscovered(item: DiscoveredSchedule): string {
  const r = item.recurrenceRule;
  const exact = item.exactDate;
  if (r.type === 'weekly' || r.type === 'biweekly') {
    const weekday = weekdayName(r.anchorDay);
    if (r.type === 'weekly')
      return t(exact ? 'recurring:discover.weekly' : 'recurring:discover.weeklyApprox', {
        weekday,
      });
    return t(exact ? 'recurring:discover.biweekly' : 'recurring:discover.biweeklyApprox', {
      weekday,
    });
  }
  if (r.type === 'monthly') {
    if (r.anchorDay >= 31)
      return t(
        exact ? 'recurring:discover.monthlyLastDay' : 'recurring:discover.monthlyLastDayApprox',
      );
    return t(exact ? 'recurring:discover.monthly' : 'recurring:discover.monthlyApprox', {
      count: r.anchorDay,
      ordinal: true,
    });
  }
  return frequencyLabel(item.recurrenceType);
}

/**
 * Actual-style amount: `~` prefix when not exact, `+` prefix for income. Pass the recurring
 * item's currency (its account's): the amount is a native amount in it.
 */
export function formatScheduleAmount(
  amount: number,
  amountType: AmountType,
  currency?: Currency,
): string {
  const approx = amountType !== 'exact' ? '~' : '';
  const sign = amount > 0 ? '+' : '';
  return `${approx}${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

/**
 * Whether saving a recurring item should first ask the user to confirm its amount: an
 * existing item whose account is now in the other currency, so the same number means a
 * different sum of money (US$ 100 would become $ 100). `formCurrency` is the chosen
 * account's; no account, like an item from before currencies existed, counts as pesos.
 */
export function amountNeedsConfirming(
  editItem: { currency?: Currency } | null | undefined,
  formCurrency: Currency | undefined,
): boolean {
  if (!editItem) return false;
  return (editItem.currency ?? HOME_CURRENCY) !== (formCurrency ?? HOME_CURRENCY);
}

// ─── Upcoming length (port of Actual Budget's getUpcomingDays) ───────────────

export const DEFAULT_UPCOMING_LENGTH = '7';

export const UPCOMING_PRESETS = ['1', '7', '14', 'oneMonth', 'currentMonth'] as const;
type UpcomingPreset = (typeof UPCOMING_PRESETS)[number];

const isUpcomingPreset = (v: string): v is UpcomingPreset =>
  (UPCOMING_PRESETS as readonly string[]).includes(v);

export const isCustomUpcomingLength = (v: string) => !isUpcomingPreset(v);

export const UPCOMING_UNITS = ['day', 'week', 'month', 'year'] as const;
type UpcomingUnit = (typeof UPCOMING_UNITS)[number];

/** Number of days after today that still count as "upcoming". */
export function getUpcomingDays(
  length: string = DEFAULT_UPCOMING_LENGTH,
  today = new Date(),
): number {
  switch (length) {
    case 'currentMonth':
      return differenceInCalendarDays(endOfMonth(today), today);
    case 'oneMonth':
      return differenceInCalendarDays(addMonths(startOfMonth(today), 1), startOfMonth(today));
    default: {
      if (length.includes('-')) {
        const [num, unit] = length.split('-');
        const value = Math.max(1, parseInt(num, 10) || 1);
        switch (unit) {
          case 'day':
            return value;
          case 'week':
            return value * 7;
          case 'month':
            return differenceInCalendarDays(addMonths(today, value), today);
          case 'year':
            return differenceInCalendarDays(addYears(today, value), today);
        }
      }
      return parseInt(length, 10) || 7;
    }
  }
}

export function describeUpcomingLength(length: string): string {
  if (isUpcomingPreset(length)) return t(`recurring:upcoming.preset.${length}`);
  const [num, unit] = length.split('-');
  const count = Math.max(1, parseInt(num, 10) || 1);
  const known = UPCOMING_UNITS.find((u): u is UpcomingUnit => u === unit) ?? 'day';
  return t(`recurring:upcoming.length.${known}`, { count });
}

/**
 * Badge status for an occurrence, following Actual's getStatus(): pending dates
 * beyond the upcoming window show as "Scheduled" instead of "Upcoming".
 */
export function occurrenceBadgeStatus(
  occ: ScheduleOccurrence,
  upcomingDays: number,
): RecurringBadgeStatus {
  if (
    occ.displayStatus === 'upcoming' &&
    differenceInCalendarDays(parseISO(occ.expectedDate), new Date()) > upcomingDays
  )
    return 'scheduled';
  return occ.displayStatus;
}
