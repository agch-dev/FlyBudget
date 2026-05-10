import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import { useOccurrences } from '../../hooks/useRecurringTransactions';
import { formatCurrency } from '../../utils/currency';

export default function UpcomingBills() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysOut = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: occurrences = [], isLoading } = useOccurrences(today, thirtyDaysOut);

  const upcoming = useMemo(
    () => occurrences
      .filter((o) => o.status === 'upcoming' || o.status === 'overdue')
      .slice(0, 7),
    [occurrences],
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Bills</h3>
        <Link to="/recurring" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No upcoming bills.</p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map((occ, i) => {
            const daysUntil = differenceInDays(parseISO(occ.expectedDate), new Date());
            const isOverdue = occ.status === 'overdue';
            return (
              <div key={`${occ.recurringTransactionId}-${occ.expectedDate}-${i}`} className="flex items-center gap-3 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                    {occ.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(occ.expectedDate), 'MMM d')}
                    {isOverdue
                      ? ` · ${Math.abs(daysUntil)}d overdue`
                      : daysUntil === 0 ? ' · Today'
                      : daysUntil === 1 ? ' · Tomorrow'
                      : ` · in ${daysUntil}d`}
                  </p>
                </div>
                <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                  occ.expectedAmount > 0 ? 'text-emerald-600' : 'text-gray-900'
                }`}>
                  {formatCurrency(occ.expectedAmount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
