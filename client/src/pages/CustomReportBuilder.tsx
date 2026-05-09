import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ArrowLeft, Save, Download } from 'lucide-react';
import ReportBuilderSidebar from '../components/reports/ReportBuilderSidebar';
import ReportChartArea from '../components/reports/ReportChartArea';
import SaveReportModal from '../components/reports/SaveReportModal';
import SavedReportsList from '../components/reports/SavedReportsList';
import { useCustomReportData, useSavedReport, useCreateSavedReport, useUpdateSavedReport } from '../hooks/useCustomReports';
import { useDebounce } from '../hooks/useDebounce';
import { downloadCsv } from '../utils/exportCsv';
import type { CustomReportConfig } from '../types';

const now = new Date();
const DEFAULT_CONFIG: CustomReportConfig = {
  chartType: 'bar',
  mode: 'total',
  groupBy: 'category',
  balanceType: 'expense',
  dateRange: { preset: '6m', from: format(subMonths(now, 5), 'yyyy-MM'), to: format(now, 'yyyy-MM') },
  filters: { accountIds: [], categoryIds: [], categoryGroupIds: [] },
};

export default function CustomReportBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [config, setConfig] = useState<CustomReportConfig>(DEFAULT_CONFIG);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState('');

  const { data: savedReport } = useSavedReport(id);
  const createMutation = useCreateSavedReport();
  const updateMutation = useUpdateSavedReport();

  useEffect(() => {
    if (savedReport) {
      setConfig(savedReport.config);
      setReportName(savedReport.name);
    }
  }, [savedReport]);

  const debouncedConfig = useDebounce(config, 300);
  const { data, isLoading } = useCustomReportData(debouncedConfig);

  function handleSave(name: string) {
    if (id && savedReport) {
      updateMutation.mutate({ id, data: { name, config } }, {
        onSuccess: () => setSaveOpen(false),
      });
    } else {
      createMutation.mutate({ name, config }, {
        onSuccess: (saved) => {
          setSaveOpen(false);
          navigate(`/reports/custom/${saved.id}`, { replace: true });
        },
      });
    }
  }

  function handleExport() {
    if (!data) return;
    const filename = `custom-report-${config.dateRange.from}-${config.dateRange.to}.csv`;
    if (data.mode === 'total') {
      downloadCsv(filename, data.data.map(d => ({ name: d.name, amount_cents: d.value })));
    } else {
      downloadCsv(filename, data.data.map(d => {
        const row: Record<string, unknown> = { month: d.month };
        for (const g of data.groups) row[g] = d[g] ?? 0;
        return row;
      }));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">
            {reportName || 'Custom Report'}
          </h1>
          <SavedReportsList activeId={id} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!data}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => setSaveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {id ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ReportBuilderSidebar config={config} onChange={setConfig} />
        <div className="flex-1 p-6 overflow-auto">
          <div className="h-[500px]">
            <ReportChartArea config={config} data={data} isLoading={isLoading} />
          </div>
        </div>
      </div>

      <SaveReportModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
        initialName={reportName}
        isUpdating={!!id}
      />
    </div>
  );
}
