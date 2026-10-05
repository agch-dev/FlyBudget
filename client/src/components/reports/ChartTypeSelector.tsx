import { useTranslation } from 'react-i18next';
import { BarChart3, LineChart, AreaChart, PieChart, Table2, Layers } from 'lucide-react';
import type { ChartType, ReportMode } from '../../types';

// Labels are in the catalog (`reports:builder.chartType`). A chart is in both modes or in one
const CHART_TYPES: { id: ChartType; icon: typeof BarChart3; modes: ReportMode[] }[] = [
  { id: 'bar', icon: BarChart3, modes: ['total', 'time'] },
  { id: 'stacked-bar', icon: Layers, modes: ['time'] },
  { id: 'line', icon: LineChart, modes: ['total', 'time'] },
  { id: 'area', icon: AreaChart, modes: ['total', 'time'] },
  { id: 'donut', icon: PieChart, modes: ['total'] },
  { id: 'table', icon: Table2, modes: ['total', 'time'] },
];

interface Props {
  value: ChartType;
  mode: ReportMode;
  onChange: (type: ChartType) => void;
}

export default function ChartTypeSelector({ value, mode, onChange }: Props) {
  const { t } = useTranslation('reports');
  return (
    <div className="flex flex-wrap gap-1">
      {CHART_TYPES.map((type) => {
        const disabled = !type.modes.includes(mode);
        const active = type.id === value;
        const label = t(`builder.chartType.${type.id}`);
        return (
          <button
            key={type.id}
            disabled={disabled}
            onClick={() => onChange(type.id)}
            title={
              disabled
                ? t('builder.onlyInMode', {
                    chart: label,
                    mode: t(`builder.mode.${type.modes[0]}`),
                  })
                : label
            }
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
              active
                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                : disabled
                  ? 'text-text-disabled cursor-not-allowed'
                  : 'text-text-secondary hover:bg-hover border border-transparent'
            }`}
          >
            <type.icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
