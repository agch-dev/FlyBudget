import { useTranslation } from 'react-i18next';
import { computeDateRange, DATE_PRESETS } from '../../utils/dateRange';
import ChartTypeSelector from './ChartTypeSelector';
import AccountMultiSelect from './AccountMultiSelect';
import CategoryTreePicker from './CategoryTreePicker';
import type {
  CustomReportConfig,
  ReportMode,
  ReportGroupBy,
  BalanceType,
  DatePresetCustom,
} from '../../types';

interface Props {
  config: CustomReportConfig;
  onChange: (config: CustomReportConfig) => void;
}

// Labels are in the catalog: `reports:builder.mode`, `.groupBy` and `.balanceType`
const MODE_OPTIONS: ReportMode[] = ['total', 'time'];

const GROUP_BY_OPTIONS: { id: ReportGroupBy; modes: ReportMode[] }[] = [
  { id: 'category', modes: ['total', 'time'] },
  { id: 'categoryGroup', modes: ['total', 'time'] },
  { id: 'payee', modes: ['total', 'time'] },
  { id: 'account', modes: ['total', 'time'] },
  { id: 'month', modes: ['total'] },
];

const BALANCE_OPTIONS: BalanceType[] = ['expense', 'income', 'net'];

function set<K extends keyof CustomReportConfig>(
  config: CustomReportConfig,
  key: K,
  value: CustomReportConfig[K],
): CustomReportConfig {
  return { ...config, [key]: value };
}

export default function ReportBuilderSidebar({ config, onChange }: Props) {
  const { t } = useTranslation('reports');
  function handleModeChange(mode: ReportMode) {
    let next = set(config, 'mode', mode);
    const validGroups = GROUP_BY_OPTIONS.filter((g) => g.modes.includes(mode));
    if (!validGroups.find((g) => g.id === next.groupBy)) {
      next = set(next, 'groupBy', validGroups[0].id);
    }
    if (mode === 'time' && next.chartType === 'donut') {
      next = set(next, 'chartType', 'bar');
    }
    if (mode === 'total' && next.chartType === 'stacked-bar') {
      next = set(next, 'chartType', 'bar');
    }
    onChange(next);
  }

  function handlePresetChange(preset: DatePresetCustom) {
    if (preset === 'custom') {
      onChange(set(config, 'dateRange', { ...config.dateRange, preset: 'custom' }));
    } else {
      const range = computeDateRange(preset);
      onChange(set(config, 'dateRange', { preset, ...range }));
    }
  }

  // Keeps the range valid: a cleared input is ignored and the other end follows if they cross
  function handleMonthChange(end: 'from' | 'to', value: string) {
    if (!value) return;
    const next = { ...config.dateRange, [end]: value };
    if (next.from > next.to) {
      if (end === 'from') next.to = value;
      else next.from = value;
    }
    onChange(set(config, 'dateRange', next));
  }

  return (
    <div className="w-72 max-md:w-full shrink-0 bg-surface border-r max-md:border-r-0 max-md:border-t border-border overflow-y-auto max-md:overflow-visible p-4 space-y-5">
      <Section label={t('builder.chartTypeSection')}>
        <ChartTypeSelector
          value={config.chartType}
          mode={config.mode}
          onChange={(ct) => onChange(set(config, 'chartType', ct))}
        />
      </Section>

      <Section label={t('builder.modeSection')}>
        <div className="flex gap-1">
          {MODE_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                config.mode === m
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-text-secondary hover:bg-hover border border-transparent'
              }`}
            >
              {t(`builder.mode.${m}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('builder.groupBySection')}>
        <select
          aria-label={t('builder.groupByLabel')}
          value={config.groupBy}
          onChange={(e) => onChange(set(config, 'groupBy', e.target.value as ReportGroupBy))}
          className="w-full rounded-md border border-border text-sm py-1.5 px-2 bg-surface text-text focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-none"
        >
          {GROUP_BY_OPTIONS.filter((g) => g.modes.includes(config.mode)).map((g) => (
            <option key={g.id} value={g.id}>
              {t(`builder.groupBy.${g.id}`)}
            </option>
          ))}
        </select>
      </Section>

      <Section label={t('builder.balanceTypeSection')}>
        <div className="flex gap-1">
          {BALANCE_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => onChange(set(config, 'balanceType', b))}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                config.balanceType === b
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-text-secondary hover:bg-hover border border-transparent'
              }`}
            >
              {t(`builder.balanceType.${b}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('builder.dateRangeSection')}>
        <div className="flex flex-wrap gap-1 mb-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              title={t(`datePreset.long.${p.id}`)}
              onClick={() => handlePresetChange(p.id)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                config.dateRange.preset === p.id
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-text-secondary hover:bg-hover border border-transparent'
              }`}
            >
              {t(`datePreset.short.${p.id}`)}
            </button>
          ))}
        </div>
        {config.dateRange.preset === 'custom' && (
          <div className="flex gap-2">
            <input
              type="month"
              aria-label={t('rangeControl.fromMonth')}
              value={config.dateRange.from}
              onChange={(e) => handleMonthChange('from', e.target.value)}
              className="flex-1 rounded-md border border-border text-xs py-1 px-2 bg-surface text-text focus:border-brand-600 focus:outline-none"
            />
            <input
              type="month"
              aria-label={t('rangeControl.toMonth')}
              value={config.dateRange.to}
              onChange={(e) => handleMonthChange('to', e.target.value)}
              className="flex-1 rounded-md border border-border text-xs py-1 px-2 bg-surface text-text focus:border-brand-600 focus:outline-none"
            />
          </div>
        )}
        <p className="text-[11px] text-text-tertiary mt-1.5">
          {config.dateRange.preset === 'custom' ? t('builder.frozenNote') : t('builder.liveNote')}
        </p>
      </Section>

      <Section label={t('accounts')}>
        <AccountMultiSelect
          selected={config.filters.accountIds}
          onChange={(ids) =>
            onChange(set(config, 'filters', { ...config.filters, accountIds: ids }))
          }
        />
      </Section>

      <Section label={t('categories')}>
        <CategoryTreePicker
          selectedCategoryIds={config.filters.categoryIds}
          selectedGroupIds={config.filters.categoryGroupIds}
          onCategoryChange={(ids) =>
            onChange(set(config, 'filters', { ...config.filters, categoryIds: ids }))
          }
          onGroupChange={(ids) =>
            onChange(set(config, 'filters', { ...config.filters, categoryGroupIds: ids }))
          }
        />
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-tertiary mb-2">{label}</p>
      {children}
    </div>
  );
}
