import { useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import {
  decodeCsvBytes,
  parseCsv,
  readTable,
  guessRoles,
  guessConventions,
  guessChargesPositive,
  hasAmountColumn,
  hasSignedAmountColumn,
  readImportRows,
  DEFAULT_CONVENTIONS,
  type ColumnRole,
  type DateOrder,
  type DecimalSeparator,
  type ImportConventions,
  type ImportProblem,
  type ReadImportRow,
} from '../../utils/csv';
import {
  readSpreadsheet,
  sheetText,
  spreadsheetKind,
  SpreadsheetError,
  type Cell,
  type Sheet,
} from '../../utils/spreadsheet';
import { defaultDestination, destinationAccounts, isCardType } from '../../utils/importDestination';
import { usePreferencesStore } from '../../store/preferencesStore';
import { importPreview } from '../../api/transactions';
import { useImportConfirm } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency } from '../../utils/currency';
import type { Currency, ImportPreviewRow } from '../../types';
import type { ImportRow } from '../../api/transactions';
import { IS_DEMO } from '../../demo/demoApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type Step = 'upload' | 'map' | 'preview' | 'done';

/** A row of the preview: where it goes and in which currency */
type PreviewRow = ImportPreviewRow & { accountId: string; currency: Currency };

/** Unreadable rows listed before "and N more" */
const PROBLEMS_SHOWN = 5;
const NO_PROBLEMS: ImportProblem[] = [];
const NO_CELLS: Cell[][] = [];

const COLUMN_ROLES: ColumnRole[] = [
  'date',
  'payee',
  'amount',
  'inflow',
  'outflow',
  'amountUYU',
  'amountUSD',
  'currency',
  'notes',
  'skip',
];

/** What the import API takes: a read row without what only the dialog needs */
const toImportRow = ({ date, amount, payeeName, notes, importedId }: ReadImportRow): ImportRow => ({
  date,
  amount,
  payeeName,
  notes,
  importedId,
});

export function ImportModal({ isOpen, onClose, accountId }: Props) {
  const { t } = useTranslation('import');
  const [step, setStep] = useState<Step>('upload');
  const canSave = useCanSave();
  // The file's amounts are in the currency of the account they're imported into, unless
  // the file itself says otherwise (a card statement in pesos and dollars)
  const { data: accounts } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);
  const currency = account?.currency;
  const otherCurrency: Currency = currency === 'USD' ? 'UYU' : 'USD';
  /** A currency inside a sentence: "pesos", "dollars" */
  const word = (c: Currency) => t(`currencyWord.${c}`);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  /** The lines under the headers, as the file holds them */
  const [cells, setCells] = useState<Cell[][]>(NO_CELLS);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [conventions, setConventions] = useState<ImportConventions>(DEFAULT_CONVENTIONS);
  const [chargesPositive, setChargesPositive] = useState(false);
  /** Where rows of the other currency go; null = not imported */
  const [otherAccountId, setOtherAccountId] = useState<string | null>(null);
  const rememberChoices = usePreferencesStore((s) => s.setCsvImportConventions);
  // Only the latest file, and the answer to the latest preview request, are shown
  const fileRequest = useRef(0);
  const previewRequest = useRef(0);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmMutation = useImportConfirm();

  function reset() {
    setStep('upload');
    setSheets([]);
    setSheetIdx(0);
    setHeaders([]);
    setCells(NO_CELLS);
    setRoles([]);
    setConventions(DEFAULT_CONVENTIONS);
    setChargesPositive(false);
    setOtherAccountId(null);
    fileRequest.current++;
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

  /** Shows one sheet of the file with the choices remembered for this account, else guessed */
  function showSheet(sheet: Cell[][]) {
    const memory = usePreferencesStore.getState().csvImportConventions[accountId];
    const table = readTable(sheetText(sheet, 'point'));
    const body = sheet.slice(table.preamble.length + 1);
    // What this account's files used last time, else what this file's text suggests (the
    // lines above the headers too: a statement's period often has a day above 12)
    const written = sheet.map((row) => row.map((cell) => (typeof cell === 'number' ? '' : cell)));
    const using: ImportConventions = memory
      ? { dateOrder: memory.dateOrder, decimal: memory.decimal }
      : guessConventions(written);
    const rows = sheetText(body, using.decimal);
    const sameHeaders =
      memory?.columns?.headers.length === table.headers.length &&
      memory.columns.headers.every((h, i) => h === table.headers[i]);
    const columns = sameHeaders ? memory!.columns!.roles : guessRoles(table.headers, rows);

    setHeaders(table.headers);
    setCells(body);
    setRoles(columns);
    setConventions(using);
    setChargesPositive(
      memory?.chargesPositive ??
        (!!account &&
          isCardType(account.type) &&
          hasSignedAmountColumn(columns) &&
          guessChargesPositive(readImportRows(rows, columns, using).rows.map((r) => r.amount))),
    );
    const destinations = account ? destinationAccounts(account, accounts ?? [], otherCurrency) : [];
    setOtherAccountId(
      memory?.otherAccountId === null
        ? null
        : (destinations.find((a) => a.id === memory?.otherAccountId)?.id ??
            (account ? defaultDestination(account, accounts ?? [], otherCurrency) : null)),
    );
  }

  async function handleFile(file: File) {
    setError(null);
    const request = ++fileRequest.current;
    let loaded: Sheet[];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (spreadsheetKind(bytes)) {
        loaded = await readSpreadsheet(bytes);
      } else {
        const { headers: first, rows: rest } = parseCsv(decodeCsvBytes(bytes));
        loaded = [{ name: file.name, rows: first.length ? [first, ...rest] : [] }];
      }
    } catch (e) {
      if (request !== fileRequest.current) return;
      setError(e instanceof SpreadsheetError ? e.message : t('errors.readFile'));
      return;
    }
    if (request !== fileRequest.current) return;
    loaded = loaded.filter((sheet) => sheet.rows.length > 0);
    if (loaded.length === 0) {
      setError(t('errors.noRows'));
      return;
    }
    // A workbook's transactions aren't always on its first sheet (Itaú's card summary)
    const withTable = loaded.findIndex((s) => readTable(sheetText(s.rows, 'point')).recognized);
    const at = Math.max(withTable, 0);
    setSheets(loaded);
    setSheetIdx(at);
    showSheet(loaded[at].rows);
    setStep('map');
  }

  function changeSheet(idx: number) {
    setSheetIdx(idx);
    setError(null);
    showSheet(sheets[idx].rows);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function setRole(idx: number, role: ColumnRole) {
    setRoles((prev) => {
      const next = [...prev];
      next[idx] = role;
      return next;
    });
  }

  const hasDate = roles.includes('date');
  const hasAmount = hasAmountColumn(roles);
  const signedAmounts = hasSignedAmountColumn(roles);

  /** The file's rows as text; number cells of a spreadsheet follow the Decimals choice */
  const rawRows = useMemo(
    () => sheetText(cells, conventions.decimal),
    [cells, conventions.decimal],
  );

  /** The file as it reads with the chosen columns and conventions */
  const read = useMemo(
    () =>
      hasDate && hasAmount
        ? readImportRows(rawRows, roles, conventions, { chargesPositive })
        : null,
    [hasDate, hasAmount, rawRows, roles, conventions, chargesPositive],
  );
  const problems = read?.problems ?? NO_PROBLEMS;

  /** A row the file gives the other currency: it can't go into this account */
  const isOther = (row: { currency: Currency | null }) =>
    row.currency !== null && row.currency !== currency;
  const otherCount = read?.rows.filter(isOther).length ?? 0;
  const destinations = account ? destinationAccounts(account, accounts ?? [], otherCurrency) : [];
  const accountName = (id: string) => accounts?.find((a) => a.id === id)?.name ?? '';

  async function runPreview(using: ImportConventions) {
    setError(null);
    if (!hasDate) return setError(t('errors.dateRequired'));
    if (!hasAmount) return setError(t('errors.amountRequired'));

    const { rows, problems: unreadable } = readImportRows(
      sheetText(cells, using.decimal),
      roles,
      using,
      { chargesPositive },
    );
    // Each row with the account it goes to; the other currency's rows may go nowhere
    const placed = rows.flatMap((row) => {
      const into = isOther(row) ? otherAccountId : accountId;
      return into ? [{ row, into, currency: row.currency ?? currency ?? 'UYU' }] : [];
    });
    if (!placed.length) {
      previewRequest.current++;
      setStep('map');
      setError(
        rows.length
          ? t('errors.everyRowOther', { currency: word(otherCurrency) })
          : unreadable.length
            ? t('errors.noneReadable', { count: unreadable.length })
            : t('errors.noValidRows'),
      );
      return;
    }

    const request = ++previewRequest.current;
    setLoading(true);
    try {
      const intoAccounts = [...new Set(placed.map((p) => p.into))];
      const answers = await Promise.all(
        intoAccounts.map((into) =>
          importPreview(
            into,
            placed.filter((p) => p.into === into).map((p) => toImportRow(p.row)),
          ),
        ),
      );
      if (request !== previewRequest.current) return;
      // Back in the file's order: each account's answer lists its rows in the order sent
      const next = intoAccounts.map(() => 0);
      const preview = placed.map(({ into, currency: rowCurrency }) => {
        const a = intoAccounts.indexOf(into);
        return { ...answers[a][next[a]++], accountId: into, currency: rowCurrency };
      });
      setPreviewRows(preview);
      setExcluded(new Set(preview.map((r, i) => (r.isDuplicate ? i : -1)).filter((i) => i >= 0)));
      setStep('preview');
    } catch (e: unknown) {
      if (request !== previewRequest.current) return;
      setError(e instanceof Error ? e.message : t('errors.previewFailed'));
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

  async function handleConfirm() {
    const chosen = previewRows.filter((_, i) => !excluded.has(i));
    if (!chosen.length) {
      setError(t('errors.noneSelected'));
      return;
    }

    // This account first, then the other currency's: one request each
    const intoAccounts = [...new Set(chosen.map((r) => r.accountId))].sort(
      (a, b) => Number(b === accountId) - Number(a === accountId),
    );
    const total = { imported: 0, skipped: 0 };
    const done: string[] = [];
    for (const into of intoAccounts) {
      try {
        const answer = await confirmMutation.mutateAsync({
          accountId: into,
          rows: chosen.filter((r) => r.accountId === into).map(toImportRow),
        });
        total.imported += answer.imported;
        total.skipped += answer.skipped;
        done.push(into);
      } catch (e) {
        const reason = e instanceof Error ? e.message : t('errors.importFailed');
        setError(
          done.length
            ? t('errors.partial', {
                done: done.map(accountName).join(', '),
                failed: accountName(into),
                reason,
              })
            : reason,
        );
        return;
      }
    }

    const memory = usePreferencesStore.getState().csvImportConventions[accountId];
    rememberChoices(accountId, {
      ...memory,
      ...conventions,
      columns: { headers, roles },
      ...(signedAmounts ? { chargesPositive } : {}),
      ...(otherCount > 0 ? { otherAccountId } : {}),
    });
    setResult(total);
    setStep('done');
  }

  function toggleExclude(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const selectClass =
    'text-sm border border-border rounded px-2 py-1 bg-surface text-text max-md:min-h-11';
  const conventionFields = (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        {t('conventions.dates')}
        <select
          value={conventions.dateOrder}
          onChange={(e) =>
            changeConventions({ ...conventions, dateOrder: e.target.value as DateOrder })
          }
          className={selectClass}
        >
          <option value="day-first">{t('conventions.dateOrder.day-first')}</option>
          <option value="month-first">{t('conventions.dateOrder.month-first')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        {t('conventions.decimals')}
        <select
          value={conventions.decimal}
          onChange={(e) =>
            changeConventions({ ...conventions, decimal: e.target.value as DecimalSeparator })
          }
          className={selectClass}
        >
          <option value="comma">{t('conventions.decimal.comma')}</option>
          <option value="point">{t('conventions.decimal.point')}</option>
        </select>
      </label>
    </div>
  );

  const twoAccounts = previewRows.some((row) => row.accountId !== accountId);

  const problemList = problems.length > 0 && (
    <div role="alert" className="px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
      <p className="font-medium">{t('problems.summary', { count: problems.length })}</p>
      <ul className="mt-1 text-xs">
        {problems.slice(0, PROBLEMS_SHOWN).map((p) => (
          <li key={p.row}>{t('problems.row', { row: p.row, message: p.message })}</li>
        ))}
        {problems.length > PROBLEMS_SHOWN && (
          <li>{t('problems.more', { more: problems.length - PROBLEMS_SHOWN })}</li>
        )}
      </ul>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('title')} size="lg">
      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 text-sm bg-negative-subtle text-negative rounded-lg">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto" aria-label={t('dismiss')}>
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
          <p className="text-sm text-text-secondary">{t('upload.drop')}</p>
          <p className="text-xs text-text-tertiary">{t('upload.supports')}</p>
          {IS_DEMO && <p className="text-xs text-text-tertiary">{t('upload.demo')}</p>}
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,.xlsx,.xltx,.xlsm,.xls"
            aria-label={t('upload.fileLabel')}
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{t('map.intro', { count: rawRows.length })}</p>
          {sheets.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              {t('map.sheet')}
              <select
                value={sheetIdx}
                onChange={(e) => changeSheet(Number(e.target.value))}
                className={selectClass}
              >
                {sheets.map((sheet, i) => (
                  <option key={i} value={i}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-2 py-1 text-left border-b border-border">
                      <div className="text-xs font-medium text-text-tertiary mb-1">{h}</div>
                      <select
                        value={roles[i]}
                        aria-label={t('map.column', { header: h })}
                        onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-surface text-text"
                      >
                        {COLUMN_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`role.${role}`)}
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
          {signedAmounts && (
            <label className="flex items-start gap-2 text-sm text-text-secondary max-md:min-h-11">
              <input
                type="checkbox"
                checked={chargesPositive}
                onChange={(e) => setChargesPositive(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 accent-brand-600"
              />
              <span>
                {t('chargesPositive.label')}
                <span className="block text-xs text-text-tertiary">
                  {t('chargesPositive.hint')}
                </span>
              </span>
            </label>
          )}
          {otherCount > 0 && (
            <div className="space-y-1">
              <label className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                {t('otherCurrency.goTo', { currency: word(otherCurrency) })}
                <select
                  value={otherAccountId ?? ''}
                  onChange={(e) => setOtherAccountId(e.target.value || null)}
                  className={selectClass}
                >
                  <option value="">{t('otherCurrency.notImported')}</option>
                  {destinations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.groupName ? `${a.groupName}: ${a.name}` : a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-text-tertiary">
                {t(
                  destinations.length === 0
                    ? 'otherCurrency.countAddAccount'
                    : 'otherCurrency.count',
                  {
                    count: otherCount,
                    currency: word(otherCurrency),
                    own: word(currency ?? 'UYU'),
                  },
                )}
              </p>
            </div>
          )}
          {read && read.rows.length > 0 && (
            <p className="text-xs text-text-secondary">
              <Trans
                t={t}
                i18nKey="map.firstRow"
                values={{
                  date: read.rows[0].date,
                  amount: formatCurrency(read.rows[0].amount, read.rows[0].currency ?? currency),
                }}
                components={{ strong: <span className="font-medium text-text" /> }}
              />
            </p>
          )}
          {problemList}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep('upload')}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:bg-hover"
            >
              {t('back')}
            </button>
            <button
              onClick={() => void runPreview(conventions)}
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? t('map.checking') : t('map.preview')}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t(otherCount > 0 && !otherAccountId ? 'preview.summaryLeftOut' : 'preview.summary', {
              found: t('preview.found', { count: previewRows.length }),
              duplicates: t('preview.duplicates', {
                count: previewRows.filter((r) => r.isDuplicate).length,
              }),
              willImport: t('preview.willImport', { count: previewRows.length - excluded.size }),
              leftOut: t('preview.leftOut', { count: otherCount, currency: word(otherCurrency) }),
            })}
          </p>
          {conventionFields}
          {problemList}
          <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-surface-alt">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary w-8"></th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
                    {t('role.date')}
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
                    {t('role.payee')}
                  </th>
                  {twoAccounts && (
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">
                      {t('field.account', { ns: 'transactions' })}
                    </th>
                  )}
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-text-tertiary">
                    {t('role.amount')}
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
                        aria-label={
                          row.payeeName
                            ? t('preview.importRow', { payee: row.payeeName, date: row.date })
                            : t('preview.importUnnamedRow', { date: row.date })
                        }
                        className="w-3.5 h-3.5 accent-brand-600"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-text-secondary whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-text flex items-center gap-1">
                      {row.payeeName ?? '—'}
                      {row.isDuplicate && (
                        <span className="text-[10px] px-1 py-0.5 bg-caution-subtle text-caution rounded">
                          {t('preview.duplicate')}
                        </span>
                      )}
                    </td>
                    {twoAccounts && (
                      <td className="px-2 py-1.5 text-xs text-text-secondary">
                        {accountName(row.accountId)}
                      </td>
                    )}
                    <td
                      className={`px-2 py-1.5 text-xs text-right tabular-nums whitespace-nowrap ${row.amount < 0 ? 'text-text' : 'text-positive'}`}
                    >
                      {formatCurrency(row.amount, row.currency)}
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
              {t('back')}
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={
                confirmMutation.isPending ||
                loading ||
                previewRows.length === excluded.size ||
                !canSave
              }
              className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {confirmMutation.isPending
                ? t('preview.importing')
                : t('preview.import', { count: previewRows.length - excluded.size })}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={40} className="text-positive" />
          <div className="text-center">
            <p className="text-sm font-medium text-text">{t('done.title')}</p>
            <p className="text-sm text-text-secondary mt-1">
              {t('done.summary', {
                imported: t('done.imported', { count: result.imported }),
                skipped: t('done.skipped', { count: result.skipped }),
              })}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            {t('done.close')}
          </button>
        </div>
      )}
    </Modal>
  );
}
