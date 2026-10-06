import express, { Router } from 'express';
import { db } from '../db/index.js';
import { accounts, categories, transactions } from '../db/schema.js';
import {
  InvalidBackupError,
  createBackup,
  parseBackup,
  restoreBackup,
  saveSafetyCopy,
} from '../services/backupService.js';
import { listRates } from '../services/exchangeRateService.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { isRealDate } from '../utils/validation.js';
import { refusal } from '../utils/refusals.js';
import { shownName } from '../services/defaultNames.js';
import { requestLanguage } from '../utils/language.js';
import { csvText } from '../services/csvText.js';

export const exportRouter = Router();

export const RESTORE_PATH = '/api/export/restore';
const RESTORE_BODY_LIMIT = '250mb';

/**
 * Quotes a text cell for CSV. Payee names and notes can come from banks and
 * merchants, so cells that a spreadsheet would treat as a formula (=, +, -, @,
 * tab, CR) are prefixed with an apostrophe to block CSV formula injection
 * (https://owasp.org/www-community/attacks/CSV_Injection).
 */
export function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** A column of a file: the key of its header in `csvText`, and how a row writes its cell */
type Column<Row, Key extends string> = readonly [header: Key, cell: (row: Row) => string];

/**
 * A file's header line (the words the app supplies, escaped like any other text) and its rows,
 * both in the order of `columns`, so a header always sits over its own cells
 */
function csvTable<Row, Key extends string>(
  columns: readonly Column<Row, Key>[],
  headers: Record<Key, string>,
  rows: readonly Row[],
): { header: string; body: string } {
  return {
    header: `${columns.map(([key]) => escapeCsv(headers[key])).join(',')}\n`,
    body: rows.map((row) => columns.map(([, cell]) => cell(row)).join(',')).join('\n'),
  };
}

/** The header that makes the answer a download called `fileName` (one of the app's own names) */
const attachment = (fileName: string) => `attachment; filename="${fileName}"`;

// Both files follow the App Language of the device that asks (services/csvText.ts): their
// header row, the words the app supplies in cells and their name. A download is a plain
// navigation, so the language comes in the address (`lang`).
exportRouter.get('/transactions/csv', (req, res) => {
  const { from, to } = req.query;
  if (
    (from !== undefined && !isRealDate(String(from))) ||
    (to !== undefined && !isRealDate(String(to)))
  ) {
    return res.status(400).json({ error: 'Expected `from` and `to` as YYYY-MM-DD' });
  }
  const language = requestLanguage(req);
  const text = csvText(language).transactions;
  // A split is exported as its parts (which carry the categories), so amounts add up
  const filters = [eq(transactions.isParent, 0)];
  if (typeof from === 'string') filters.push(gte(transactions.date, from));
  if (typeof to === 'string') filters.push(lte(transactions.date, to));

  const rows = db
    .select({
      date: transactions.date,
      amount: transactions.amount,
      payeeName: transactions.payeeName,
      notes: transactions.notes,
      reconciled: transactions.reconciled,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(and(...filters))
    .orderBy(transactions.date)
    .all();

  const accts = Object.fromEntries(
    db
      .select()
      .from(accounts)
      .all()
      .map((a) => [a.id, a]),
  );
  const cats = Object.fromEntries(
    db
      .select()
      .from(categories)
      .all()
      .map((c) => [c.id, shownName('category', c.name, language)]),
  );

  // Amounts are native: each row's is in its account's currency, named in its own column.
  // Group is the account's Account Group (empty when it has none)
  type Row = (typeof rows)[number];
  const account = (r: Row) => accts[r.accountId];
  const columns: Column<Row, keyof typeof text.header>[] = [
    ['date', (r) => r.date],
    ['account', (r) => escapeCsv(account(r)?.name ?? '')],
    ['group', (r) => escapeCsv(account(r)?.groupName)],
    ['currency', (r) => account(r)?.currency ?? ''],
    ['payee', (r) => escapeCsv(r.payeeName)],
    ['category', (r) => escapeCsv(r.categoryId ? (cats[r.categoryId] ?? '') : '')],
    ['notes', (r) => escapeCsv(r.notes)],
    ['amount', (r) => (r.amount / 100).toFixed(2)],
    ['reconciled', (r) => escapeCsv(r.reconciled ? text.yes : text.no)],
  ];
  const { header, body } = csvTable(columns, text.header, rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', attachment(text.fileName));
  res.send(header + body);
});

// Every stored exchange rate (pesos per dollar), oldest first: what converted totals use
exportRouter.get('/exchange-rates/csv', (req, res) => {
  const text = csvText(requestLanguage(req)).exchangeRates;
  const columns: Column<ReturnType<typeof listRates>[number], keyof typeof text.header>[] = [
    ['date', (r) => r.date],
    ['rate', (r) => String(r.rate)],
    ['source', (r) => escapeCsv(r.manual ? text.enteredByHand : text.fetched)],
  ];
  const { header, body } = csvTable(columns, text.header, listRates());
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', attachment(text.fileName));
  res.send(header + body);
});

exportRouter.get('/backup', (_req, res) => {
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="budget-backup-${dateStr}.json"`);
  res.json(createBackup());
});

// Replaces everything with a backup. A backup can be much bigger than other requests
// (every transaction, plus logos), so this route parses its own body; index.ts skips
// the general 10 MB parser for it. It runs after the login check like every route here.
exportRouter.post('/restore', express.json({ limit: RESTORE_BODY_LIMIT }), async (req, res) => {
  let data;
  try {
    data = parseBackup(req.body);
  } catch (err) {
    if (err instanceof InvalidBackupError) return res.status(400).json(err.refusal);
    throw err;
  }
  const safetyCopy = await saveSafetyCopy();
  try {
    const restored = restoreBackup(data);
    res.json({ restored, safetyCopy });
  } catch (err) {
    // e.g. a row pointing at an account that isn't in the file: nothing was changed
    console.error('Restore failed:', err);
    res
      .status(400)
      .json(refusal('backup_inconsistent', 'The backup is inconsistent, so nothing was restored'));
  }
});
