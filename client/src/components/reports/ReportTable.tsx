import { useTranslation } from 'react-i18next';
import { useViewingMoney } from '../../hooks/useViewingCurrency';
import { monthLabel } from './ChartHelpers';
import { groupName } from '../../utils/reportText';
import type { CustomReportData } from '../../types';

interface Props {
  data: CustomReportData;
}

export default function ReportTable({ data }: Props) {
  const { t } = useTranslation('reports');
  const money = useViewingMoney();
  if (data.mode === 'total') {
    return (
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-text-secondary">{t('name')}</th>
              <th className="text-right py-2 px-3 font-semibold text-text-secondary">
                {t('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row, i) => (
              <tr key={i} className="border-b border-border-light hover:bg-hover">
                <td className="py-2 px-3 text-text-secondary">{groupName(row.name)}</td>
                <td
                  className={`py-2 px-3 text-right tabular-nums font-medium ${row.value < 0 ? 'text-negative' : 'text-text'}`}
                >
                  {money.format(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="py-2 px-3 font-semibold text-text">{t('total')}</td>
              <td className="py-2 px-3 text-right tabular-nums font-semibold text-text">
                {money.format(data.data.reduce((s, r) => s + r.value, 0))}
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
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-semibold text-text-secondary sticky left-0 bg-surface">
              {t('month')}
            </th>
            {data.groups.map((g) => (
              <th
                key={g}
                className="text-right py-2 px-3 font-semibold text-text-secondary whitespace-nowrap"
              >
                {groupName(g)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map((row, i) => (
            <tr key={i} className="border-b border-border-light hover:bg-hover">
              <td className="py-2 px-3 text-text-secondary sticky left-0 bg-surface">
                {monthLabel(row.month as string)}
              </td>
              {data.groups.map((g) => {
                const val = (row[g] as number) || 0;
                return (
                  <td
                    key={g}
                    className={`py-2 px-3 text-right tabular-nums ${val < 0 ? 'text-negative' : 'text-text-secondary'}`}
                  >
                    {val !== 0 ? money.format(val) : '—'}
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
