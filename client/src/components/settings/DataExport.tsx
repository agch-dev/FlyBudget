import { useState } from 'react';
import { Download } from 'lucide-react';

const API_BASE = '/api/export';

export function DataExport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    window.location.href = `${API_BASE}/transactions/csv${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Data Export</h2>
        <p className="text-xs text-gray-400 mt-0.5">Download your data for backup or analysis.</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">Export Transactions</h3>
          <p className="text-xs text-gray-400 mt-0.5">Download all transactions as a CSV file. Optionally filter by date range.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">Full Backup</h3>
          <p className="text-xs text-gray-400 mt-0.5">Download a complete JSON backup of all your data — accounts, categories, transactions, budgets, payees, and rules.</p>
        </div>
        <button
          onClick={() => { window.location.href = `${API_BASE}/backup`; }}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Download size={14} /> Download Backup
        </button>
      </div>
    </div>
  );
}
