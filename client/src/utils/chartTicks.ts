import { parseISO, format } from 'date-fns';
import { t } from '../i18n';

// Date strings on chart axes are either days (yyyy-MM-dd) or months (yyyy-MM)
function parseDate(s: string): Date {
  if (s.length === 10) return parseISO(s);
  return parseISO(`${s}-01`);
}

/**
 * Short x-axis labels for a run of dates: "Mar 5" for days ("5 mar" in Spanish), "Mar" for
 * months, adding the year ("Mar '25") when the range spans more than one year. Which labels are actually drawn
 * is decided by useXAxisLayout.
 */
export function formatDateAxisLabels(values: string[]): string[] {
  if (!values.length) return [];
  const dates = values.map(parseDate);
  const daily = values.some((v) => v.length === 10);
  const crossesYear = dates[0].getFullYear() !== dates[dates.length - 1].getFullYear();
  const pattern = daily
    ? t(crossesYear ? 'datePattern.dayMonthShortYear' : 'datePattern.dayMonth')
    : crossesYear
      ? "MMM ''yy"
      : 'MMM';
  return dates.map((d) => format(d, pattern));
}

/** Tooltip label for a date string: "Mar 5, 2026" or "March 2026". */
export function formatDateLabel(dateStr: unknown): string {
  const s = String(dateStr ?? '');
  if (s.length === 10) return format(parseISO(s), t('datePattern.medium'));
  if (s.length === 7) return format(parseISO(`${s}-01`), 'MMMM yyyy');
  return s;
}
