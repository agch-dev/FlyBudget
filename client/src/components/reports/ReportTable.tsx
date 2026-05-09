import { formatCurrency } from '../../utils/currency';
import { monthLabel } from './ChartHelpers';
import type { CustomReportData } from '../../types';

interface Props {
  data: CustomReportData;
}

export default function ReportTable({ data }: Props) {
  if (data.mode === 'total') {
    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">Name</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-700">{row.name}</td>
                <td className={`py-2 px-3 text-right tabular-nums font-medium ${row.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td className="py-2 px-3 font-semibold text-gray-900">Total</td>
              <td className="py-2 px-3 text-right tabular-nums font-bold text-gray-900">
                {formatCurrency(data.data.reduce((s, r) => s + r.value, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700 sticky left-0 bg-white">Month</th>
            {data.groups.map(g => (
              <th key={g} className="text-right py-2 px-3 font-semibold text-gray-700 whitespace-nowrap">{g}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-700 sticky left-0 bg-white">{monthLabel(row.month as string)}</td>
              {data.groups.map(g => {
                const val = (row[g] as number) || 0;
                return (
                  <td key={g} className={`py-2 px-3 text-right tabular-nums ${val < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {val !== 0 ? formatCurrency(val) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
