import { useMemo, useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import {
  parseCsv,
  guessColumnRoles,
  guessConventions,
  readImportRows,
  DEFAULT_CONVENTIONS,
  type ColumnRole,
  type DateOrder,
  type DecimalSeparator,
  type ImportConventions,
  type ImportProblem,
} from '../../utils/csv';
import { usePreferencesStore } from '../../store/preferencesStore';
import { importPreview } from '../../api/transactions';
import { useImportConfirm } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { ImportPreviewRow } from '../../types';
import type { ImportRow } from '../../api/transactions';
import { IS_DEMO } from '../../demo/demoApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

/** Unreadable rows listed before "and N more" */
const PROBLEMS_SHOWN = 5;
const NO_PROBLEMS: ImportProblem[] = [];

export function ImportModal({ isOpen, onClose, accountId }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const canSave = useCanSave();
  // The file's amounts are in the currency of the account they're imported into
  const { data: accounts } = useAccounts();
  const currency = accounts?.find((a) => a.id === accountId)?.currency;
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [conventions, setConventions] = useState<ImportConventions>(DEFAULT_CONVENTIONS);
  const rememberConventions = usePreferencesStore((s) => s.setCsvImportConventions);
  // Only the answer to the latest preview request is shown
  const previewRequest = useRef(0);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmMutation = useImportConfirm();

  function reset() {
    setStep('upload');
    setHeaders([]);
    setRawRows([]);
    setRoles([]);
    setConventions(DEFAULT_CONVENTIONS);
    previewRequest.current++;
    setPreviewRows([]);
    setExcluded(new Set());
    setResult(null);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      if (h.length === 0) {
        setError('Could not parse CSV file');
        return;
      }
      setHeaders(h);
      setRawRows(r);
      setRoles(guessColumnRoles(h));
      // What this account's files used last time, else what this file's data suggests
      setConventions(
        usePreferencesStore.getState().csvImportConventions[accountId] ?? guessConventions(r),
      );
      setStep('map');
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function setRole(idx: number, role: ColumnRole) {
    setRoles((prev) => {
      const next = [...prev];
      next[idx] = role;
      return next;
    });
  }

  const hasDate = roles.includes('date');
  const hasAmount = roles.some((r) => r === 'amount' || r === 'inflow' || r === 'outflow');

  /** The file as it reads with the chosen columns and conventions */
  const read = useMemo(
    () => (hasDate && hasAmount ? readImportRows(rawRows, roles, conventions) : null),
    [hasDate, hasAmount, rawRows, roles, conventions],
  );
  const problems = read?.problems ?? NO_PROBLEMS;

  async function runPreview(using: ImportConventions) {
    setError(null);
    if (!hasDate) return setError('Date column is required');
    if (!hasAmount) return setError('At least one amount column is required');

    const { rows, problems: unreadable } = readImportRows(rawRows, roles, using);
    if (!rows.length) {
      previewRequest.current++;
      setStep('map');
      setError(
        unreadable.length
          ? `None of the ${unreadable.length} rows could be read. Check the Dates and Decimals choices.`
          : 'No valid rows found',
      );
      return;
    }

    const request = ++previewRequest.current;
    setLoading(true);
    try {
      const preview = await importPreview(accountId, rows);
      if (request !== previewRequest.current) return;
      setPreviewRows(preview);
      setExcluded(new Set(preview.map((r, i) => (r.isDuplicate ? i : -1)).filter((i) => i >= 0)));
      setStep('preview');
    } catch (e: unknown) {
      if (request !== previewRequest.current) return;
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      if (request === previewRequest.current) setLoading(false);
    }
  }

  /** Changing a choice re-reads the file; on the preview step that means a new preview */
  function changeConventions(next: ImportConventions) {
    setConventions(next);
    setError(null);
    if (step === 'preview') void runPreview(next);
  }

  function handleConfirm() {
    const rows = previewRows
      .filter((_, i) => !excluded.has(i))
      .map(({ isDuplicate: _, ...row }) => row as ImportRow);

    if (!rows.length) {
      setError('No rows selected');
      return;
    }

    confirmMutation.mutate(
      { accountId, rows },
      {
        onSuccess: (data) => {
          rememberConventions(accountId, conventions);
          setResult(data);
          setStep('done');
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Import failed'),
      },
    );
  }

  function toggleExclude(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const roleOptions: { value: ColumnRole; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'payee', label: 'Payee' },
    { value: 'amount', label: 'Amount' },
    { value: 'inflow', label: 'Inflow' },
    { value: 'outflow', label: 'Outflow' },
    { value: 'notes', label: 'Notes' },
    { value: 'skip', label: 'Skip' },
  ];

  const selectClass =
    'text-sm border border-border rounded px-2 py-1 bg-surface text-text max-md:min-h-11';
  const conventionFields = (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        Dates
        <select
          value={conventions.dateOrder}
          onChange={(e) =>
            changeConventions({ ...conventions, dateOrder: e.target.value as DateOrder })
          }
          className={selectClass}
        >
          <option value="day-first">Day first (31/12/2026)</option>
          <option value="month-first">Month first (12/31/2026)</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        Decimals
        <select
          value={conventions.decimal}
          onChange={(e) =>
            changeConventions({ ...conventions, decimal: e.target.value as DecimalSeparator })
          }
          className={selectClass}
        >
          <option value="comma">Comma (1.234,56)</option>
          <option value="point">Point (1,234.56)</option>
        </select>
      </label>
    </div>
  );

  const problemList = problems.length > 0 && (
    <div role="alert" className="px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
      <p className="font-medium">
        {problems.length === 1
          ? "1 row can't be read and won't be imported."
          : `${problems.length} rows can't be read and won't be imported.`}{' '}
        Check the Dates and Decimals choices.
      </p>
      <ul className="mt-1 text-xs">
        {problems.slice(0, PROBLEMS_SHOWN).map((p) => (
          <li key={p.row}>
            Row {p.row}: {p.message}
          </li>
        ))}
        {problems.length > PROBLEMS_SHOWN && <li>and {problems.length - PROBLEMS_SHOWN} more</li>}
      </ul>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Transactions" size="lg">
      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 text-sm bg-negative-subtle text-negative rounded-lg">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {step === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-border rounded-lg hover:border-brand-400 transition-colors cursor-pointer"
          onClick={() => document.getElementById('csv-file-input')?.click()}
        >
          <Upload size={32} className="text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            Drag and drop a CSV file, or click to browse
          </p>
          <p className="text-xs text-text-tertiary">Supports .csv files</p>
          {IS_DEMO && (
            <p className="text-xs text-text-tertiary">
              Demo: your file stays in this browser tab and isn't saved.
            </p>
          )}
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            aria-label="CSV file"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Map each column to a field. Found {rawRows.length} rows.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-2 py-1 text-left border-b border-border">
                      <div className="text-xs font-medium text-text-tertiary mb-1">{h}</div>
                      <select
                        value={roles[i]}
                        aria-label={`Column ${h}`}
                        onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-surface text-text"
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 3).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="px-2 py-1 text-xs text-text-secondary border-b border-border-light max-w-[150px] truncate"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {conventionFields}
          {read && read.rows.length > 0 && (
            <p className="text-xs text-text-secondary">
              First row reads as{' '}
              <span className="font-medium text-text">
                {read.rows[0].date}, {formatCurrency(read.rows[0].amount, currency)}
              </span>
              .
            </p>
          )}
          {problemList}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep('upload')}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:bg-hover"
            >
              Back
            </button>
            <button
              onClick={() => void runPreview(conventions)}
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Preview'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {previewRows.length} transactions found.{' '}
            {previewRows.filter((r) => r.isDuplicate).length} duplicates detected.{' '}
            {previewRows.length - excluded.size} will be imported.
          </p>
          {conventionFields}
          {problemList}
          <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-surface-alt">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
                    Date
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
                    Payee
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-text-tertiary">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border-light ${excluded.has(i) ? 'opacity-40' : ''} ${row.isDuplicate ? 'bg-caution-subtle' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={!excluded.has(i)}
                        onChange={() => toggleExclude(i)}
                        aria-label={`Import ${row.payeeName ?? 'row'} on ${row.date}`}
                        className="w-3.5 h-3.5 accent-brand-600"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-text-secondary">{row.date}</td>
                    <td className="px-2 py-1.5 text-xs text-text flex items-center gap-1">
                      {row.payeeName ?? '—'}
                      {row.isDuplicate && (
                        <span className="text-[10px] px-1 py-0.5 bg-caution-subtle text-caution rounded">
                          duplicate
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-xs text-right tabular-nums ${row.amount < 0 ? 'text-text' : 'text-positive'}`}
                    >
                      {formatCurrency(row.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SavingPausedHint className="text-right" />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep('map')}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:bg-hover"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                confirmMutation.isPending ||
                loading ||
                previewRows.length === excluded.size ||
                !canSave
              }
              className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {confirmMutation.isPending
                ? 'Importing...'
                : `Import ${previewRows.length - excluded.size} Transactions`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={40} className="text-positive" />
          <div className="text-center">
            <p className="text-sm font-medium text-text">Import complete</p>
            <p className="text-sm text-text-secondary mt-1">
              {result.imported} imported, {result.skipped} skipped
            </p>
          </div>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
