import { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCanSave } from '../../hooks/useConnection';
import { SavingPausedHint } from '../connection/SavingPausedHint';
import {
  parseCsvRecords,
  normalizeDate,
  buildImportRows,
  describeSkippedRows,
  unknownDirectionWords,
  columnRolesFor,
  columnKeys,
  fitsSavedColumns,
  decodeCsvBytes,
  detectDelimiter,
  detectSkipRows,
  detectDateFormat,
  detectNumberFormat,
  CSV_ENCODINGS,
  type ColumnRole,
  type CsvEncoding,
  type DateFormat,
  type Delimiter,
  type ImportSettings,
  type NumberFormat,
  type SkippedRow,
} from '../../utils/csv';
import {
  decodeCamtBytes,
  looksLikeCamt,
  parseCamt,
  statementAccountKey,
  type CamtStatement,
} from '../../utils/camt';
import {
  chooseSheet,
  readSpreadsheet,
  sheetLayout,
  sheetText,
  showsDateFormat,
  showsNumberFormat,
  spreadsheetKind,
  textCells,
  SpreadsheetError,
  type Sheet,
} from '../../utils/spreadsheet';
import { importPreview } from '../../api/transactions';
import { getImportSettings, saveImportSettings, saveStatementAccount } from '../../api/accounts';
import { useImportConfirm } from '../../hooks/useTransactions';
import { formatMoney } from '../../utils/currency';
import { minorUnits } from '../../utils/currencies';
import { useAccountCurrency } from '../../hooks/useCurrency';
import { currencyTextKey } from '../../utils/currencyText';
import { useAccounts } from '../../hooks/useAccounts';
import { usePreferencesStore } from '../../store/preferencesStore';
import { CurrencySelect } from '../currency/CurrencySelect';
import {
  currencyContext,
  currencyMapping,
  currencyValues,
  followUpAccounts,
  markCurrencyColumn,
} from '../../utils/importCurrencies';
import type { Account, ImportPreviewRow } from '../../types';
import type { ImportRow } from '../../api/transactions';
import { IS_DEMO } from '../../demo/demoApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

type Step = 'upload' | 'statement' | 'map' | 'preview' | 'done';

type ImportSource = 'csv' | 'camt' | 'xlsx';

const DELIMITERS: { value: Delimiter; label: string }[] = [
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: '\t', label: 'Tab' },
];

const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  mdy: 'MM/DD/YYYY',
  dmy: 'DD/MM/YYYY',
  ymd: 'YY/MM/DD',
};

const NUMBER_FORMAT_LABELS: Record<NumberFormat, string> = {
  dot: '1,234.56',
  comma: '1.234,56',
};

const selectClass = 'w-full text-xs border border-border rounded px-1.5 py-1 bg-surface text-text';
const optionLabelClass = 'text-xs font-medium text-text-tertiary space-y-1';

const settingsKey = (accountId: string) => ['import-settings', accountId];

/** Settings still being saved, by account: the next import of a file waits for them */
const pendingSaves = new Map<string, Promise<void>>();

/** The most rows one import may send (the server's limit) */
const MAX_IMPORT_ROWS = 100_000;

/** The account an import goes into, and its currency (amounts are read in its decimals) */
type Target = { id: string; currency: string | null };

const NO_ACCOUNTS: Account[] = [];

export function ImportModal({ isOpen, onClose, accountId: openedFor }: Props) {
  const [step, setStep] = useState<Step>('upload');
  // The account being imported into: the one the dialog was opened for, until the rows of
  // another currency in the file are imported into another account (null until then, so a
  // dialog that stays mounted follows the page to another account)
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);
  const accountId = switchedTo ?? openedFor;
  const currencyOf = useAccountCurrency();
  const currency = currencyOf(accountId);
  const { data: accounts = NO_ACCOUNTS } = useAccounts();
  const sections = usePreferencesStore((s) => s.accountSections);
  const canSave = useCanSave();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<ImportSource>('csv');
  // CSV: the file, how it's read, and the settings this account's last import used
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [encoding, setEncoding] = useState<CsvEncoding>('auto');
  const [delimiter, setDelimiter] = useState<Delimiter>(',');
  const [records, setRecords] = useState<string[][]>([]);
  const [skipRows, setSkipRows] = useState(0);
  // What's typed in "Rows above the header" while it isn't a number yet (an emptied field)
  const [skipRowsDraft, setSkipRowsDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<ImportSettings | null>(null);
  // The saved settings of the account being imported into: `saved` until another account's
  // turn, whose own settings are kept apart from the ones this file is read with
  const [ownSaved, setOwnSaved] = useState<ImportSettings | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  // null = what the file looks like (detectDateFormat / detectNumberFormat)
  const [dateFormatChoice, setDateFormatChoice] = useState<DateFormat | null>(null);
  const [numberFormatChoice, setNumberFormatChoice] = useState<NumberFormat | null>(null);
  const [outWord, setOutWord] = useState('');
  // Excel: the sheets with anything in them, and the one being imported
  const [sheets, setSheets] = useState<Sheet[]>([]);
  // Each sheet's cells as text, numbers with a decimal point (for the header and the layout)
  const [sheetTexts, setSheetTexts] = useState<string[][][]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  // CAMT: the statements in the file (one per account)
  const [statements, setStatements] = useState<CamtStatement[]>([]);
  const [statementIdx, setStatementIdx] = useState(0);
  // The account number of the last statement imported into this account, if any
  const [knownStatementAccount, setKnownStatementAccount] = useState<string | null>(null);
  // Pending or unreadable CAMT entries (CSV rows left out are listed in skippedRows)
  const [skippedEntries, setSkippedEntries] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  // A currency column: the currency picked for its values (by `currencyTextKey`)
  const [currencyChoices, setCurrencyChoices] = useState<Record<string, string>>({});
  // Rows of the file in other currencies than the account's, left out of this import
  const [otherCurrencies, setOtherCurrencies] = useState<Record<string, number>>({});
  // Currencies whose rows were imported since the file was chosen
  const [finished, setFinished] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmMutation = useImportConfirm();
  // Counts file loads and closings: a load that finishes after the dialog was closed (or
  // another file was chosen) is dropped, so the next opening starts at the upload step
  const loadId = useRef(0);

  function reset() {
    loadId.current++;
    setStep('upload');
    setSwitchedTo(null);
    setCurrencyChoices({});
    setOtherCurrencies({});
    setFinished([]);
    setSource('csv');
    setBytes(null);
    setEncoding('auto');
    setDelimiter(',');
    setRecords([]);
    setSkipRows(0);
    setSkipRowsDraft(null);
    setSaved(null);
    setOwnSaved(null);
    setUsingSaved(false);
    setDateFormatChoice(null);
    setNumberFormatChoice(null);
    setOutWord('');
    setSheets([]);
    setSheetTexts([]);
    setSheetIdx(0);
    setStatements([]);
    setStatementIdx(0);
    setKnownStatementAccount(null);
    setSkippedEntries(0);
    setHeaders([]);
    setRawRows([]);
    setRoles([]);
    setPreviewRows([]);
    setExcluded(new Set());
    setSkippedRows([]);
    setResult(null);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  /**
   * Shows the rows under the header, with columns mapped as last time or guessed, or as
   * `keepRoles` when the table has as many columns (the same table, read in another encoding
   * or under another header row)
   */
  const showTable = useCallback(
    (
      all: string[][],
      skip: number,
      savedSettings: ImportSettings | null,
      keepRoles?: ColumnRole[],
    ) => {
      const h = all[skip] ?? [];
      const rows = all.slice(skip + 1);
      setSkipRows(skip);
      setHeaders(h);
      setRawRows(rows);
      setRoles(
        keepRoles?.length === h.length
          ? keepRoles
          : markCurrencyColumn(
              h,
              rows,
              columnRolesFor(h, savedSettings?.columns),
              savedSettings?.currencyColumn,
            ),
      );
    },
    [],
  );

  /** Reads the text as CSV; `skip` null finds the header by itself */
  const loadCsv = useCallback(
    (
      content: string,
      sep: Delimiter,
      skip: number | null,
      savedSettings: ImportSettings | null,
      keepRoles?: ColumnRole[],
    ) => {
      const all = parseCsvRecords(content, sep);
      if (all.length === 0) {
        setError('Could not parse CSV file');
        return;
      }
      setError(null);
      setRecords(all);
      setDelimiter(sep);
      const header = Math.min(skip ?? detectSkipRows(all), all.length - 1);
      showTable(all, header, savedSettings, keepRoles);
      setStep('map');
    },
    [showTable],
  );

  async function runPreview(
    target: Target,
    rows: ImportRow[],
    skipped: SkippedRow[],
    {
      camtSkipped = 0,
      others = {},
    }: { camtSkipped?: number; others?: Record<string, number> } = {},
  ) {
    const load = loadId.current;
    // The server's limit: say so, rather than fail the whole file with a generic error
    if (rows.length > MAX_IMPORT_ROWS) {
      setError(
        `This file has ${rows.length.toLocaleString()} transactions. FlyBudget imports up to ${MAX_IMPORT_ROWS.toLocaleString()} at a time: split it into smaller files.`,
      );
      return;
    }
    setLoading(true);
    try {
      // Every row in another currency: nothing to check, only the switch to another account
      const preview = rows.length ? await importPreview(target.id, rows) : [];
      if (load !== loadId.current) return; // closed while checking
      setSwitchedTo(target.id === openedFor ? null : target.id);
      setSkippedRows(skipped);
      setSkippedEntries(camtSkipped);
      setOtherCurrencies(others);
      setPreviewRows(preview);
      setExcluded(new Set(preview.map((r, i) => (r.isDuplicate ? i : -1)).filter((i) => i >= 0)));
      setStep('preview');
    } catch (e: unknown) {
      if (load === loadId.current) setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      if (load === loadId.current) setLoading(false);
    }
  }

  function previewStatement(
    statement: CamtStatement,
    target: Target = { id: accountId, currency },
  ) {
    if (!statement.transactions.length) {
      setError('There are no booked transactions in this statement');
      return;
    }
    setError(null);
    return runPreview(target, statement.transactions, [], { camtSkipped: statement.skipped });
  }

  async function handleFile(file: File) {
    setError(null);
    const load = ++loadId.current;
    setLoading(false); // a preview of the file before is abandoned
    try {
      await readFile(file, load);
    } catch (e) {
      if (load !== loadId.current) return;
      setError(e instanceof SpreadsheetError ? e.message : "Couldn't read this file");
    }
  }

  /** What an account's last imports remembered, or null offline */
  async function savedImport(id = accountId) {
    await pendingSaves.get(id);
    try {
      return await queryClient.fetchQuery({
        queryKey: settingsKey(id),
        queryFn: () => getImportSettings(id),
        retry: false, // offline, don't keep the file waiting
      });
    } catch {
      return null; // Offline: work everything out from the file
    }
  }

  async function readFile(file: File, load: number) {
    const buffer = await file.arrayBuffer();
    if (load !== loadId.current) return;
    setCurrencyChoices({});
    setFinished([]);
    // A new file goes into the account the dialog was opened for, even after a switch
    setSwitchedTo(null);
    setOwnSaved(null);
    const opened: Target = { id: openedFor, currency: currencyOf(openedFor) };

    // A workbook is told by its content, whatever the file is called
    if (spreadsheetKind(new Uint8Array(buffer))) {
      const found = (await readSpreadsheet(new Uint8Array(buffer))).filter((s) => s.rows.length);
      if (load !== loadId.current) return;
      if (!found.length) {
        setError('No rows could be imported. Every sheet in this file is empty.');
        return;
      }
      const savedSettings = (await savedImport(opened.id))?.settings ?? null;
      if (load !== loadId.current) return;
      setSource('xlsx');
      setSaved(savedSettings);
      setOwnSaved(savedSettings);
      setBytes(null);
      // Kept as they were, so the account's next CSV file is still read the same way
      setDelimiter(savedSettings?.delimiter ?? ',');
      setEncoding(savedSettings?.encoding ?? 'auto');
      setDateFormatChoice(null);
      setNumberFormatChoice(null);
      const texts = found.map((s) => sheetText(s.rows, 'dot'));
      setSheets(found);
      setSheetTexts(texts);
      openSheet(texts, chooseSheet(texts, savedSettings), savedSettings);
      return;
    }

    // Decoded like the whole file would be, so a UTF-16 statement is recognized too
    const start = decodeCsvBytes(buffer.slice(0, 4096), 'auto');
    if (/\.xml$/i.test(file.name) || looksLikeCamt(start)) {
      const found = parseCamt(decodeCamtBytes(buffer));
      if (!found?.length) {
        setError("This file isn't a bank statement FlyBudget can read (CAMT.053)");
        return;
      }
      const known = (await savedImport(opened.id))?.statementAccount ?? null;
      if (load !== loadId.current) return;
      setSource('camt');
      setStatements(found);
      setKnownStatementAccount(known);
      // A file with several accounts: the one this account imported last time, if it's there
      const idx = Math.max(
        0,
        found.findIndex((s) => known !== null && statementAccountKey(s.account) === known),
      );
      setStatementIdx(idx);
      if (found.length === 1) await previewStatement(found[0], opened);
      else setStep('statement');
      return;
    }

    setSource('csv');
    const savedSettings = (await savedImport(opened.id))?.settings ?? null;
    if (load !== loadId.current) return; // closed (or another file chosen) meanwhile
    setSaved(savedSettings);
    setOwnSaved(savedSettings);
    setBytes(buffer);
    setDateFormatChoice(null);
    setNumberFormatChoice(null);
    setOutWord('');

    // The last import's settings, as long as this file still fits them (the same columns)
    if (savedSettings) {
      const content = decodeCsvBytes(buffer, savedSettings.encoding);
      if (fitsSavedColumns(parseCsvRecords(content, savedSettings.delimiter), savedSettings)) {
        setEncoding(savedSettings.encoding);
        setUsingSaved(true);
        // Only with the rest of the settings: it means something for this bank's files only
        setOutWord(savedSettings.outWord ?? '');
        loadCsv(content, savedSettings.delimiter, savedSettings.skipRows, savedSettings);
        return;
      }
    }
    setEncoding('auto');
    setUsingSaved(false);
    const content = decodeCsvBytes(buffer, 'auto');
    loadCsv(content, detectDelimiter(content), null, savedSettings);
  }

  /** Shows a sheet's table: under the saved header row if it has the saved columns */
  function openSheet(texts: string[][][], idx: number, savedSettings: ImportSettings | null) {
    const layout = sheetLayout(texts[idx], savedSettings);
    setError(null);
    setSheetIdx(idx);
    setUsingSaved(layout.usingSaved);
    setOutWord(layout.usingSaved ? (savedSettings?.outWord ?? '') : '');
    setRecords(texts[idx]);
    showTable(texts[idx], layout.skipRows, savedSettings);
    setStep('map');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ''; // so choosing the same file again still loads it
  }

  function changeEncoding(next: CsvEncoding) {
    if (!bytes) return;
    setEncoding(next);
    setUsingSaved(false);
    loadCsv(decodeCsvBytes(bytes, next), delimiter, skipRows, saved, roles);
  }

  function changeDelimiter(next: Delimiter) {
    if (!bytes) return;
    setUsingSaved(false);
    loadCsv(decodeCsvBytes(bytes, encoding), next, null, saved);
  }

  function setRole(idx: number, role: ColumnRole) {
    setRoles((prev) => {
      const next = [...prev];
      next[idx] = role;
      return next;
    });
  }

  // A spreadsheet's cells under the header, the same rows as `rawRows`
  const sheetRows = useMemo(
    () => (source === 'xlsx' ? sheets[sheetIdx]?.rows.slice(skipRows + 1) : undefined),
    [source, sheets, sheetIdx, skipRows],
  );
  // A spreadsheet's number and date cells say what they are: only its text cells could be
  // read two ways
  const textRows = useMemo(
    () => (sheetRows ? textCells(sheetRows) : rawRows),
    [sheetRows, rawRows],
  );
  // How the file writes dates, amounts and directions, judged from the columns mapped to them
  const detected = useMemo(() => {
    const column = (role: ColumnRole) => {
      const idx = roles.indexOf(role);
      return idx === -1 ? [] : textRows.map((row) => row[idx] ?? '');
    };
    const amounts = [...column('amount'), ...column('inflow'), ...column('outflow')];
    return {
      dateFormat: detectDateFormat(column('date')),
      numberFormat: detectNumberFormat(amounts),
      // Whether the file showed them at all (a sheet of real dates and numbers doesn't)
      dateShown: showsDateFormat(column('date')),
      numberShown: showsNumberFormat(amounts),
      // Values that really could be read two ways, to quote in the warning
      dateSample: column('date').find((d) => {
        const readings = (['mdy', 'dmy', 'ymd'] as const)
          .map((f) => normalizeDate(d, f))
          .filter((r) => r !== '');
        return new Set(readings).size > 1;
      }),
      amountSample: amounts.find((a) => /^[^\d.,]*\d{1,3}[.,]\d{3}[^\d.,]*$/.test(a.trim())),
      unknownDirections: unknownDirectionWords(column('direction')),
    };
  }, [textRows, roles]);
  // What the user chose now, else what the file shows, else what they chose last time for a
  // file with these columns (another layout may be another bank, with other formats)
  const lastTime = usingSaved ? saved : null;
  const dateFormat = dateFormatChoice ?? detected.dateFormat ?? lastTime?.dateFormat ?? null;
  const numberFormat =
    numberFormatChoice ?? detected.numberFormat ?? lastTime?.numberFormat ?? null;
  // Formats the file couldn't show, taken from the last import (named in the dialog)
  const fromLastTime = [
    !dateFormatChoice &&
      !detected.dateFormat &&
      lastTime?.dateFormat && { what: 'dates', format: DATE_FORMAT_LABELS[lastTime.dateFormat] },
    !numberFormatChoice &&
      !detected.numberFormat &&
      lastTime?.numberFormat && {
        what: 'amounts',
        format: NUMBER_FORMAT_LABELS[lastTime.numberFormat],
      },
  ].filter((f): f is { what: string; format: string } => !!f);
  const hasDirection = roles.includes('direction');
  const needsOutWord = hasDirection && !outWord.trim() && detected.unknownDirections.length > 0;

  // A column saying each row's currency: its values, and the currency each one means
  const currencyIdx = roles.indexOf('currency');
  const values = useMemo(
    () => (currencyIdx === -1 ? [] : currencyValues(rawRows, currencyIdx)),
    [rawRows, currencyIdx],
  );
  const context = useMemo(
    () => currencyContext(accountId, accounts, sections),
    [accountId, accounts, sections],
  );
  const mapping = useMemo(
    () =>
      currencyMapping(values, { context, saved: saved?.currencyNames, chosen: currencyChoices }),
    [values, context, saved, currencyChoices],
  );
  // The values whose currency is known, as `buildImportRows` takes them
  const names = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(mapping).filter((e): e is [string, string] => e[1] !== null),
      ),
    [mapping],
  );
  const unmapped = values.filter((v) => !mapping[v.key]);
  const fileCurrencies = [...new Set(values.flatMap((v) => mapping[v.key] ?? []))];
  // Without a currency for the account, rows in two currencies can't be told apart
  const needsAccountCurrency = !currency && fileCurrencies.length > 1;

  function handlePreview(target: Target = { id: accountId, currency }) {
    setError(null);
    // Never guess: swapped days and months, or amounts off by 100x, would look plausible
    if (!dateFormat) return setError('Choose how this file writes dates');
    if (!numberFormat) return setError('Choose how this file writes amounts');
    if (needsOutWord) return setError('Type the word your bank uses for money going out');
    if (unmapped.length) return setError(`Choose the currency of "${unmapped[0].text}"`);
    if (!target.currency && fileCurrencies.length > 1) {
      return setError("Choose this account's currency first");
    }
    // Number cells written in the chosen format, so they read back exactly
    const cells = sheetRows ? sheetText(sheetRows, numberFormat) : rawRows;
    const built = buildImportRows(cells, roles, {
      dateFormat,
      numberFormat,
      outWord,
      minor: minorUnits(target.currency),
      currencies: { names, account: target.currency },
    });
    if (typeof built === 'string') {
      setError(built);
      return;
    }
    const { rows, skipped, otherCurrencies: others } = built;
    if (!rows.length && !Object.keys(others).length) {
      setError(
        skipped.length
          ? `No rows could be imported. ${describeSkippedRows(skipped)}`
          : 'No valid rows found',
      );
      return;
    }
    void runPreview(target, rows, skipped, { others });
  }

  /**
   * Goes on with the same file in another account: the rows of its currency (CSV and Excel,
   * with the same settings) or the whole statement (CAMT)
   */
  function switchAccount(id: string) {
    const target = { id, currency: currencyOf(id) };
    // This account's rows are dealt with (imported, or nothing to import): not offered again
    if (currency) setFinished((prev) => (prev.includes(currency) ? prev : [...prev, currency]));
    const load = loadId.current;
    if (source === 'camt') {
      // That account's last statement, to notice one for another account
      void savedImport(id).then((s) => setKnownStatementAccount(s?.statementAccount ?? null));
      void previewStatement(statements[statementIdx], target);
      return;
    }
    // Each value keeps the currency it was read as here, whatever accounts are around there
    setCurrencyChoices(names);
    // What that account remembers is updated after its import, not replaced by this one's
    setOwnSaved(null);
    void savedImport(id).then((s) => {
      if (load === loadId.current) setOwnSaved(s?.settings ?? null);
    });
    handlePreview(target);
  }

  /** Remembers how this account's bank writes its files, for the next import */
  function rememberSettings() {
    type Saved = Awaited<ReturnType<typeof getImportSettings>>;
    let request: Promise<Partial<Saved>>;
    if (source === 'camt') {
      // Which account the statement was for, to notice a statement for another account
      const account = statementAccountKey(statements[statementIdx]?.account ?? null);
      if (!account) return;
      request = saveStatementAccount(accountId, account);
    } else {
      if (!dateFormat || !numberFormat) return;
      const columns: ImportSettings['columns'] = {};
      // At most 200 columns (the server's limit); longer files are worked out each time
      if (headers.length > 200) return;
      const keys = columnKeys(headers);
      keys.forEach((key, i) => {
        // The currency column is Skip to upstream, which has no such role
        columns[key] = roles[i] === 'currency' ? 'skip' : roles[i];
      });
      // What this file's currency values mean, kept with the other files' (one entry each)
      const named = values.flatMap((v) => {
        const code = mapping[v.key];
        return code && v.text.length <= 100 ? [[v.text, code] as const] : [];
      });
      const currencyNames = Object.fromEntries(
        [
          ...Object.entries(ownSaved?.currencyNames ?? {}).filter(
            ([text]) => !values.some((v) => v.key === currencyTextKey(text)),
          ),
          ...named,
        ].slice(-200),
      );
      // A sheet of real dates or numbers says nothing about the account's CSV files: keep
      // what was known for these columns, so a CSV file with ambiguous text is still asked about
      const shown = (chosen: unknown, inFile: boolean) => source !== 'xlsx' || !!chosen || inFile;
      const known =
        ownSaved === saved
          ? lastTime
          : ownSaved && keys.every((key) => Object.hasOwn(ownSaved.columns, key))
            ? ownSaved
            : null;
      const settings: ImportSettings = {
        // A workbook has neither: the account's next CSV file is still read the same way
        delimiter: source === 'xlsx' ? (ownSaved?.delimiter ?? ',') : delimiter,
        encoding: source === 'xlsx' ? (ownSaved?.encoding ?? 'auto') : encoding,
        skipRows,
        columns,
        dateFormat: shown(dateFormatChoice, detected.dateShown)
          ? dateFormat
          : (known?.dateFormat ?? null),
        numberFormat: shown(numberFormatChoice, detected.numberShown)
          ? numberFormat
          : (known?.numberFormat ?? null),
        outWord: outWord.trim().slice(0, 50) || null,
        ...(currencyIdx !== -1 && { currencyColumn: keys[currencyIdx] }),
        ...(Object.keys(currencyNames).length && { currencyNames }),
      };
      request = saveImportSettings(accountId, settings);
    }
    const save: Promise<void> = request
      .then((stored) => {
        // The server keeps the part that wasn't saved; so does the cache
        queryClient.setQueryData<Saved>(settingsKey(accountId), (old) => ({
          settings: null,
          statementAccount: null,
          ...old,
          ...stored,
        }));
      })
      .catch(() => {
        // Not worth an error: the next import works the settings out again
      })
      .finally(() => {
        if (pendingSaves.get(accountId) === save) pendingSaves.delete(accountId);
      });
    pendingSaves.set(accountId, save);
  }

  function handleConfirm() {
    const rows = previewRows
      .filter((_, i) => !excluded.has(i))
      .map(({ isDuplicate: _, ...row }) => row as ImportRow);

    if (!rows.length) {
      setError('No rows selected');
      return;
    }

    const load = loadId.current;
    confirmMutation.mutate(
      { accountId, rows },
      {
        onSuccess: (data) => {
          rememberSettings(); // the import happened, even if the dialog was closed meanwhile
          if (load !== loadId.current) return; // closed: the next opening starts afresh
          if (currency) setFinished((prev) => [...prev, currency]);
          setResult(data);
          setStep('done');
        },
        onError: (e) => {
          if (load === loadId.current) setError(e instanceof Error ? e.message : 'Import failed');
        },
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

  function previewBack() {
    if (source !== 'camt') setStep('map');
    else setStep(statements.length > 1 ? 'statement' : 'upload');
  }

  const roleOptions: { value: ColumnRole; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'payee', label: 'Payee' },
    { value: 'amount', label: 'Amount' },
    { value: 'inflow', label: 'Inflow' },
    { value: 'outflow', label: 'Outflow' },
    { value: 'direction', label: 'Direction (in/out)' },
    { value: 'notes', label: 'Notes' },
    { value: 'currency', label: 'Currency' },
    { value: 'skip', label: 'Skip' },
  ];

  // A statement for another account than the one imported here last time
  const statementAccount =
    source === 'camt' ? statementAccountKey(statements[statementIdx]?.account ?? null) : null;
  const otherStatementAccount =
    statementAccount && knownStatementAccount && statementAccount !== knownStatementAccount
      ? statementAccount
      : null;
  const entriesLeftOut = `${skippedEntries} ${skippedEntries === 1 ? 'entry is' : 'entries are'} pending or couldn't be read, and left out.`;
  // A statement in another currency than this account's: its amounts would mean something else
  const statementCurrency = source === 'camt' ? (statements[statementIdx]?.currency ?? null) : null;
  const otherCurrency =
    statementCurrency && currency && statementCurrency !== currency ? statementCurrency : null;
  // The file's rows in currencies not imported yet, offered once this import is done
  const leftover = Object.entries(otherCurrencies).filter(([code]) => !finished.includes(code));
  // Every row here is a duplicate or unticked (or there are none): the others can come next
  const nothingHere = previewRows.length === excluded.size;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Transactions" size="lg">
      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 text-sm bg-negative-subtle text-negative rounded-lg">
          <AlertTriangle size={14} /> {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto flex items-center justify-center max-md:min-h-11 max-md:min-w-11"
            aria-label="Dismiss"
          >
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
            Drag and drop a file from your bank, or click to browse
          </p>
          <p className="text-xs text-text-tertiary">
            CSV, Excel (.xlsx, .xls), or a CAMT.053 bank statement (XML)
          </p>
          {loading && <p className="text-xs text-text-tertiary">Checking…</p>}
          {IS_DEMO && (
            <p className="text-xs text-text-tertiary">
              Demo: your file stays in this browser tab and isn't saved.
            </p>
          )}
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,.tsv,.txt,.xml,.xlsx,.xlsm,.xltx,.xls"
            aria-label="Bank file"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {step === 'statement' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This file has statements for {statements.length} accounts. Which one belongs to this
            account?
          </p>
          <label className={optionLabelClass}>
            <span>Statement</span>
            <select
              value={statementIdx}
              onChange={(e) => setStatementIdx(Number(e.target.value))}
              className={selectClass}
            >
              {statements.map((s, i) => (
                <option key={i} value={i}>
                  {s.account ?? 'Account without a number'} ({s.transactions.length} transactions)
                  {knownStatementAccount !== null &&
                    statementAccountKey(s.account) === knownStatementAccount &&
                    ', imported here before'}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              onClick={() => void previewStatement(statements[statementIdx])}
              disabled={loading}
            >
              {loading ? 'Checking...' : 'Preview'}
            </Button>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Map each column to a field. Found {rawRows.length} rows.
            {usingSaved && ' Using the settings from your last import into this account.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sheets.length > 1 && source === 'xlsx' && (
              <label className={optionLabelClass}>
                <span>Sheet</span>
                <select
                  value={sheetIdx}
                  onChange={(e) => openSheet(sheetTexts, Number(e.target.value), saved)}
                  className={selectClass}
                >
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {source === 'csv' && (
              <>
                <label className={optionLabelClass}>
                  <span>Separator</span>
                  <select
                    value={delimiter}
                    onChange={(e) => changeDelimiter(e.target.value as Delimiter)}
                    className={selectClass}
                  >
                    {DELIMITERS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={optionLabelClass}>
                  <span>Encoding</span>
                  <select
                    value={encoding}
                    onChange={(e) => changeEncoding(e.target.value as CsvEncoding)}
                    className={selectClass}
                  >
                    {CSV_ENCODINGS.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className={optionLabelClass}>
              <span>Rows above the header</span>
              <input
                type="number"
                min={0}
                max={Math.max(records.length - 1, 0)}
                value={skipRowsDraft ?? skipRows}
                onChange={(e) => {
                  // An emptied field is being retyped: keep the table until there's a number
                  setSkipRowsDraft(e.target.value);
                  if (e.target.value.trim() === '') return;
                  const n = Math.trunc(Number(e.target.value));
                  if (Number.isFinite(n) && n >= 0 && n < records.length) {
                    showTable(records, n, saved, roles);
                  }
                }}
                onBlur={() => setSkipRowsDraft(null)}
                className={selectClass}
              />
            </label>
            {/* Year-first or written-out dates (and a sheet's date cells) read the same in any
                order: nothing to choose */}
            {detected.dateShown && (
              <label className={optionLabelClass}>
                <span>Dates</span>
                <select
                  value={dateFormat ?? ''}
                  onChange={(e) => setDateFormatChoice(e.target.value as DateFormat)}
                  className={selectClass}
                >
                  {!dateFormat && <option value="">Choose…</option>}
                  {Object.entries(DATE_FORMAT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={optionLabelClass}>
              <span>Amounts</span>
              <select
                value={numberFormat ?? ''}
                onChange={(e) => setNumberFormatChoice(e.target.value as NumberFormat)}
                className={selectClass}
              >
                {!numberFormat && <option value="">Choose…</option>}
                {Object.entries(NUMBER_FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {hasDirection && (
              <label className={optionLabelClass}>
                <span>Word for money out</span>
                <input
                  type="text"
                  value={outWord}
                  maxLength={50}
                  placeholder="Optional, e.g. Af"
                  onChange={(e) => setOutWord(e.target.value)}
                  className={selectClass}
                />
              </label>
            )}
          </div>
          {(!dateFormat || !numberFormat || needsOutWord) && (
            <div className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {!dateFormat &&
                  (detected.dateSample
                    ? `This file doesn't show in which order ${detected.dateSample} is written. `
                    : 'Rows in this file write dates in different orders. ')}
                {!numberFormat &&
                  (detected.amountSample
                    ? `This file doesn't show whether ${detected.amountSample} uses a decimal point or a decimal comma. `
                    : 'Rows in this file write amounts in different formats. ')}
                {(!dateFormat || !numberFormat) && 'Choose the format your bank uses. '}
                {needsOutWord &&
                  `FlyBudget doesn't know what ${detected.unknownDirections
                    .slice(0, 3)
                    .map((w) => `"${w}"`)
                    .join(
                      ', ',
                    )} means in the direction column. Type the word your bank uses for money going out; other words it doesn't know count as money in.`}
              </span>
            </div>
          )}
          {fromLastTime.length > 0 && (
            <p className="text-xs text-text-tertiary">
              This file doesn't show how it writes {fromLastTime.map((f) => f.what).join(' or ')}:
              using {fromLastTime.map((f) => f.format).join(' and ')}, as in your last import into
              this account.
            </p>
          )}
          {values.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-tertiary">Currencies in this file</p>
              <table className="text-sm border-collapse">
                <tbody>
                  {values.map((v) => (
                    <tr key={v.key}>
                      <td className="pr-3 py-1 text-xs text-text">{v.text}</td>
                      <td className="pr-3 py-1 text-xs text-text-tertiary whitespace-nowrap">
                        {v.count} {v.count === 1 ? 'row' : 'rows'}
                      </td>
                      <td className="py-1">
                        <CurrencySelect
                          value={mapping[v.key] ?? ''}
                          onChange={(code) =>
                            setCurrencyChoices((prev) => ({ ...prev, [v.key]: code }))
                          }
                          first={context}
                          placeholder="Choose…"
                          size="sm"
                          aria-label={`Currency of ${v.text}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unmapped.length > 0 && (
                <p className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    FlyBudget can't tell which currency{' '}
                    {unmapped.map((v) => `"${v.text}"`).join(', ')}{' '}
                    {unmapped.length === 1 ? 'is' : 'are'}. Choose it above.
                  </span>
                </p>
              )}
              {needsAccountCurrency && (
                <p className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    This file has rows in {fileCurrencies.join(' and ')}, but this account has no
                    currency yet, so FlyBudget can't tell which rows belong here.{' '}
                    <Link to="/settings?tab=currencies" className="underline hover:no-underline">
                      Choose the budget's currency
                    </Link>{' '}
                    first.
                  </span>
                </p>
              )}
            </div>
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
                        aria-label={`Column ${h}`}
                        onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                        className={selectClass}
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
                {(sheetRows
                  ? sheetText(sheetRows.slice(0, 3), numberFormat ?? 'dot')
                  : rawRows.slice(0, 3)
                ).map((row, ri) => (
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
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              onClick={() => handlePreview()}
              disabled={loading || unmapped.length > 0 || needsAccountCurrency}
            >
              {loading ? 'Checking...' : 'Preview'}
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {previewRows.length} transactions found.{' '}
            {previewRows.filter((r) => r.isDuplicate).length} duplicates detected.{' '}
            {previewRows.length - excluded.size} will be imported.
            {skippedEntries > 0 && ` ${entriesLeftOut}`}
          </p>
          {otherCurrency && (
            <p
              role="alert"
              className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span className="space-y-2">
                <span className="block">
                  This statement is in {otherCurrency}, but this account is in {currency}.
                </span>
                <OtherAccountPicker
                  key={`${accountId}:${otherCurrency}`}
                  accountId={accountId}
                  accounts={accounts}
                  currency={otherCurrency}
                  label="Import it into"
                  onChoose={switchAccount}
                  busy={loading}
                />
              </span>
            </p>
          )}
          {leftover.map(([code, count]) => (
            <p
              key={code}
              role="status"
              className="flex items-start gap-2 px-3 py-2 text-sm bg-surface-alt text-text-secondary rounded-lg"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span className="space-y-2">
                <span className="block">
                  {count} {count === 1 ? 'row' : 'rows'} in {code}{' '}
                  {count === 1 ? "isn't" : "aren't"} imported here.
                  {!nothingHere &&
                    ` You can import ${count === 1 ? 'it' : 'them'} into a ${code} account after this.`}
                </span>
                {nothingHere && (
                  <OtherAccountPicker
                    key={`${accountId}:${code}`}
                    accountId={accountId}
                    accounts={accounts}
                    currency={code}
                    label={`Import the ${code} rows into`}
                    onChoose={switchAccount}
                    busy={loading}
                  />
                )}
              </span>
            </p>
          ))}
          {otherStatementAccount && (
            <p
              role="alert"
              className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                This statement is for account {otherStatementAccount}, but the last statement
                imported into this account was for {knownStatementAccount}. Check that you're
                importing it into the right account.
              </span>
            </p>
          )}
          {skippedRows.length > 0 && (
            <p
              role="status"
              className="flex items-start gap-2 px-3 py-2 text-sm bg-caution-subtle text-caution rounded-lg"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {describeSkippedRows(skippedRows)} Fix the file and import it again to include them.
              </span>
            </p>
          )}
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
                      {formatMoney(row.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SavingPausedHint className="text-right" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={previewBack}>
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                confirmMutation.isPending ||
                previewRows.length === excluded.size ||
                !canSave ||
                // A statement in another currency would be read as this account's
                !!otherCurrency
              }
            >
              {confirmMutation.isPending
                ? 'Importing...'
                : `Import ${previewRows.length - excluded.size} Transactions`}
            </Button>
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
          {leftover.map(([code, count]) => (
            <div key={code} className="text-sm text-text-secondary">
              <OtherAccountPicker
                key={`${accountId}:${code}`}
                accountId={accountId}
                accounts={accounts}
                currency={code}
                label={`Import the ${count} ${code} ${count === 1 ? 'row' : 'rows'} into`}
                onChoose={switchAccount}
                busy={loading}
              />
            </div>
          ))}
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}

/**
 * "Import the 12 USD rows into [account ▾]": goes on with the same file in an open account in
 * that currency, suggesting the card's other side. Leaving it is the same as not importing.
 */
function OtherAccountPicker({
  accountId,
  accounts,
  currency,
  label,
  onChoose,
  busy,
}: {
  accountId: string;
  accounts: readonly Account[];
  currency: string;
  label: string;
  onChoose: (accountId: string) => void;
  /** A preview is loading */
  busy: boolean;
}) {
  const sections = usePreferencesStore((s) => s.accountSections);
  const { options, defaultId } = followUpAccounts(accountId, accounts, currency, sections);
  // The suggestion until the user picks (accounts and sections may still be loading)
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = picked ?? defaultId ?? '';
  if (!options.length) {
    return (
      <span>
        There's no open account in {currency} to import them into: add one, then import this file
        into it.
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{label}</span>
      <select
        value={chosen}
        onChange={(e) => setPicked(e.target.value)}
        aria-label={`Account for the ${currency} rows`}
        className="text-xs border border-border rounded px-1.5 py-1 bg-surface text-text max-md:min-h-11"
      >
        {!chosen && <option value="">Choose an account…</option>}
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!chosen || busy}
        onClick={() => onChoose(chosen)}
        aria-label={`Preview the ${currency} rows`}
      >
        Preview
      </Button>
    </span>
  );
}
