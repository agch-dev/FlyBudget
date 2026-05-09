import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useSavedReports, useDeleteSavedReport } from '../../hooks/useCustomReports';

interface Props {
  activeId?: string;
}

export default function SavedReportsList({ activeId }: Props) {
  const { data: reports = [] } = useSavedReports();
  const deleteMutation = useDeleteSavedReport();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (reports.length === 0) return null;

  const activeReport = reports.find(r => r.id === activeId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {activeReport ? activeReport.name : 'Saved Reports'}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-20 py-1">
          {reports.map(r => (
            <div
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer group ${r.id === activeId ? 'bg-blue-50' : ''}`}
            >
              <button
                onClick={() => { navigate(`/reports/custom/${r.id}`); setOpen(false); }}
                className="flex-1 text-left text-sm text-gray-700 truncate"
              >
                {r.name}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(r.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
