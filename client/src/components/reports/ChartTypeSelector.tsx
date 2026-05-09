import { BarChart3, LineChart, AreaChart, PieChart, Table2, Layers } from 'lucide-react';
import type { ChartType, ReportMode } from '../../types';

const CHART_TYPES: { id: ChartType; icon: typeof BarChart3; label: string; modes: ReportMode[] }[] = [
  { id: 'bar', icon: BarChart3, label: 'Bar', modes: ['total', 'time'] },
  { id: 'stacked-bar', icon: Layers, label: 'Stacked', modes: ['time'] },
  { id: 'line', icon: LineChart, label: 'Line', modes: ['total', 'time'] },
  { id: 'area', icon: AreaChart, label: 'Area', modes: ['total', 'time'] },
  { id: 'donut', icon: PieChart, label: 'Donut', modes: ['total'] },
  { id: 'table', icon: Table2, label: 'Table', modes: ['total', 'time'] },
];

interface Props {
  value: ChartType;
  mode: ReportMode;
  onChange: (type: ChartType) => void;
}

export default function ChartTypeSelector({ value, mode, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      {CHART_TYPES.map(t => {
        const disabled = !t.modes.includes(mode);
        const active = t.id === value;
        return (
          <button
            key={t.id}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            title={t.label}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
