import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, format, parseISO,
  addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecurringOccurrence, OccurrenceStatus } from '../../types';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DOT_COLORS: Record<OccurrenceStatus, string> = {
  paid: 'bg-emerald-500',
  paid_different: 'bg-amber-400',
  upcoming: 'bg-blue-400',
  overdue: 'bg-red-400',
};

interface Props {
  month: string;
  onMonthChange: (month: string) => void;
  occurrences: RecurringOccurrence[];
  onDateClick?: (date: string) => void;
}

export default function Calendar({ month, onMonthChange, occurrences, onDateClick }: Props) {
  const monthDate = parseISO(`${month}-01`);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate));
    const end = endOfWeek(endOfMonth(monthDate));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const occByDate = useMemo(() => {
    const map = new Map<string, RecurringOccurrence[]>();
    for (const occ of occurrences) {
      const key = occ.expectedDate;
      const list = map.get(key) || [];
      list.push(occ);
      map.set(key, list);
    }
    return map;
  }, [occurrences]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(format(subMonths(monthDate, 1), 'yyyy-MM'))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-800">{format(monthDate, 'MMMM yyyy')}</span>
        <button
          onClick={() => onMonthChange(format(addMonths(monthDate, 1), 'yyyy-MM'))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="bg-gray-50 py-1.5 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, monthDate);
          const isToday = isSameDay(day, new Date());
          const dayOccs = occByDate.get(dateStr) || [];

          return (
            <div
              key={dateStr}
              onClick={() => dayOccs.length > 0 && onDateClick?.(dateStr)}
              className={`bg-white min-h-[52px] px-1.5 py-1 ${
                dayOccs.length > 0 ? 'cursor-pointer hover:bg-blue-50/50' : ''
              } ${!inMonth ? 'opacity-30' : ''}`}
            >
              <span
                className={`text-xs tabular-nums ${
                  isToday
                    ? 'bg-blue-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center font-medium'
                    : 'text-gray-600'
                }`}
              >
                {format(day, 'd')}
              </span>
              {dayOccs.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                  {dayOccs.slice(0, 4).map((occ, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[occ.status]}`}
                      title={`${occ.title} (${occ.status})`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
