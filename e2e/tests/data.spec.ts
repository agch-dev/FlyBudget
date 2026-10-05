import fs from 'fs';
import type { Page } from '@playwright/test';
import { test, expect, open, isoDay } from './fixtures';

// Getting data in (CSV import) and out (CSV export, full backup) and restoring it.

// What banks actually send: an Excel byte order mark, a quoted memo with a comma and a
// line break, accounting-style negatives, and two identical coffees on the same day.
const BANK_CSV =
  '﻿Date,Description,Amount,Memo\r\n' +
  '01/15/2025,Corner Coffee,(4.50),\r\n' +
  '01/15/2025,Corner Coffee,(4.50),\r\n' +
  '01/16/2025,"Acme, Inc. Payroll",2500.00,"Direct deposit\r\nJanuary"\r\n' +
  '01/17/2025,Hardware Store,-89.99,\r\n';

async function importCsv(page: Page, csv: string) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Transactions' });
  await dialog.getByLabel('CSV file').setInputFiles({
    name: 'bank-export.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  return dialog;
}

test.describe('CSV import', () => {
  test('maps columns and imports every row, even tricky ones', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, BANK_CSV);

    await expect(dialog).toContainText('Found 4 rows');
    // Columns are recognized from their headers, the BOM notwithstanding
    await expect(dialog.getByRole('combobox', { name: 'Column Date' })).toHaveValue('date');
    await expect(dialog.getByRole('combobox', { name: 'Column Description' })).toHaveValue('payee');
    await expect(dialog.getByRole('combobox', { name: 'Column Amount' })).toHaveValue('amount');
    await expect(dialog.getByRole('combobox', { name: 'Column Memo' })).toHaveValue('notes');

    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('4 transactions found. 0 duplicates detected.');
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await expect(dialog).toContainText('4 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();

    const txs = await api.transactions(`?account_id=${checking.id}&from=2025-01-01`);
    const summary = txs
      .map((t) => [t.date, t.payeeName, t.amount, t.notes])
      .sort((a, b) => String(a).localeCompare(String(b)));
    expect(summary).toEqual([
      ['2025-01-15', 'Corner Coffee', -450, null],
      ['2025-01-15', 'Corner Coffee', -450, null],
      ['2025-01-16', 'Acme, Inc. Payroll', 250_000, 'Direct deposit\r\nJanuary'],
      ['2025-01-17', 'Hardware Store', -8_999, null],
    ]);
    expect(await api.balance(checking.id)).toBe(240_101);
  });

  test('importing the same file again finds only duplicates', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    let dialog = await importCsv(page, BANK_CSV);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The next month's export overlaps: one new row
    dialog = await importCsv(page, BANK_CSV + '01/20/2025,Bakery,(7.25),\r\n');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText(
      '5 transactions found. 4 duplicates detected. 1 will be imported.',
    );
    await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
    await expect(dialog).toContainText('1 imported, 0 skipped');
    expect(await api.transactions(`?account_id=${checking.id}&from=2025-01-01`)).toHaveLength(5);
  });

  // A Uruguayan bank's export: semicolons, day-first dates and 1.234,56 amounts
  const URUGUAYAN_CSV =
    'Fecha;Descripción;Débito;Crédito\r\n' +
    '05/03/2026;"Supermercado; sucursal 3";1.234,56;\r\n' +
    '25/03/2026;Sueldo;;80.000,00\r\n';

  test('reads a Uruguayan file and remembers its conventions for the account', async ({
    page,
    api,
  }) => {
    const caja = await api.createAccount('Caja de ahorro', 0);
    await open(page, `/accounts/${caja.id}`);
    let dialog = await importCsv(page, URUGUAYAN_CSV);

    await expect(dialog).toContainText('Found 2 rows');
    await expect(dialog.getByRole('combobox', { name: 'Column Fecha' })).toHaveValue('date');
    await expect(dialog.getByRole('combobox', { name: 'Column Débito' })).toHaveValue('outflow');
    // Guessed from the file: a day above 12, and a comma before the last two digits
    await expect(dialog.getByLabel('Dates')).toHaveValue('day-first');
    await expect(dialog.getByLabel('Decimals')).toHaveValue('comma');

    await dialog.getByRole('button', { name: 'Preview' }).click();
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();

    const txs = await api.transactions(`?account_id=${caja.id}&from=2026-01-01`);
    expect(txs.map((t) => [t.date, t.payeeName, t.amount]).sort()).toEqual([
      ['2026-03-05', 'Supermercado; sucursal 3', -123_456],
      ['2026-03-25', 'Sueldo', 8_000_000],
    ]);

    // A later file with nothing to guess from (4 March or 3 April? 150 or 1.50?) is read
    // the way this account's files were read before
    dialog = await importCsv(
      page,
      'Fecha;Descripción;Débito;Crédito\r\n04/03/2026;Kiosco;150;\r\n',
    );
    await expect(dialog.getByLabel('Dates')).toHaveValue('day-first');
    await expect(dialog.getByLabel('Decimals')).toHaveValue('comma');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog.getByRole('row', { name: /Kiosco/ })).toContainText('2026-03-04');
  });

  test('a wrong date or decimal choice shows before anything is imported', async ({
    page,
    api,
  }) => {
    const caja = await api.createAccount('Caja de ahorro', 0);
    await open(page, `/accounts/${caja.id}`);
    const dialog = await importCsv(page, URUGUAYAN_CSV);

    // With point decimals neither amount is a number: say so instead of importing zeros
    await dialog.getByLabel('Decimals').selectOption('point');
    await expect(dialog.getByRole('alert')).toContainText("2 rows can't be read");
    await expect(dialog.getByRole('alert')).toContainText(
      'Row 1: Can\'t read the amount "1.234,56"',
    );
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('None of the 2 rows could be read');

    await dialog.getByLabel('Decimals').selectOption('comma');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('2 transactions found');

    // The preview follows the choices: month first, 25/03 is no date and 05/03 is 3 May
    await dialog.getByLabel('Dates').selectOption('month-first');
    await expect(dialog).toContainText('1 transactions found');
    await expect(dialog.getByRole('alert')).toContainText(
      'Row 2: Can\'t read the date "25/03/2026"',
    );
    await expect(dialog.getByRole('row', { name: /Supermercado/ })).toContainText('2026-05-03');
    await dialog.getByLabel('Dates').selectOption('day-first');
    await expect(dialog.getByRole('row', { name: /Supermercado/ })).toContainText('2026-03-05');
    expect(await api.transactions(`?account_id=${caja.id}`)).toHaveLength(0);
  });

  test('unreadable files explain what went wrong', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importCsv(page, 'Name,Notes\r\nfoo,bar\r\n');
    await dialog.getByRole('combobox', { name: 'Column Name' }).selectOption('payee');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('Date column is required');
    expect(await api.transactions(`?account_id=${checking.id}`)).toHaveLength(0);
  });
});

test.describe('export, backup and restore', () => {
  test('exports transactions as CSV, with formula injection neutralized', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_000,
      payeeName: '=HYPERLINK("http://evil.example")',
    });
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Data' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = fs.readFileSync(await (await download).path(), 'utf8');
    expect(csv.split('\n')[0]).toBe('Date,Account,Payee,Category,Notes,Amount,Reconciled');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
    expect(csv).toContain('-10.00');
  });

  test('a backup restores everything it contained', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 50_000);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -2_500,
      payeeName: 'Before Backup',
    });
    await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });

    await open(page, '/settings');
    await page.getByRole('button', { name: 'Data' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Backup' }).click();
    const backupFile = await (await download).path();
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    expect(backup).toMatchObject({ format: 'flybudget-backup', version: 2 });
    expect(backup.goals).toHaveLength(1);
    // Never any bank credentials or login data
    expect(Object.keys(backup)).not.toContain('plaidItems');
    expect(Object.keys(backup)).not.toContain('sessions');

    // Things change after the backup…
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -99_999,
      payeeName: 'After Backup',
    });
    await api.createAccount('New Account', 1);

    // …and restoring brings it back
    await page.getByLabel('Backup file').setInputFiles(backupFile);
    const confirm = page.getByRole('dialog', { name: 'Restore this backup?' });
    await expect(confirm).toContainText('All of your current data will be replaced');
    await confirm.getByRole('button', { name: 'Replace my data' }).click();
    await expect(page.getByRole('status')).toContainText('Restored');
    await expect(page.getByRole('status')).toContainText('1 transactions');

    expect((await api.accounts()).map((a) => a.name)).toEqual(['Checking']);
    expect(await api.balance(checking.id)).toBe(47_500);
    const payees = (await api.transactions()).map((t) => t.payeeName);
    expect(payees).toEqual(['Before Backup']);
    // The sidebar shows the restored data without reloading
    await expect(page.getByRole('complementary')).toContainText('$475');
  });

  test('restoring a file that is not a backup changes nothing', async ({ page, api }) => {
    await api.createAccount('Checking', 50_000);
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Data' }).click();
    await page.getByLabel('Backup file').setInputFiles({
      name: 'notes.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":"world"}'),
    });
    await page
      .getByRole('dialog', { name: 'Restore this backup?' })
      .getByRole('button', { name: 'Replace my data' })
      .click();
    await expect(page.getByRole('status')).toContainText('This is not a FlyBudget backup file');
    expect((await api.accounts()).map((a) => a.name)).toEqual(['Checking']);

    await page.getByLabel('Backup file').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not json'),
    });
    await expect(page.getByRole('status')).toContainText(
      'broken.json is not a FlyBudget backup file',
    );
  });
});
