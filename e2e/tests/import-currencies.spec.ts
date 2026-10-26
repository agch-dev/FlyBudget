import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';
import type { Account, Api } from './fixtures';

// Files whose rows are in more than one currency: an import brings in the account's currency,
// then offers to import the other currencies' rows into another account. The card statement is
// made-up data in the shape of a Uruguayan bank's export (a Moneda column of Pesos/Dolares).

const sample = (file: string) =>
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/two-currencies', file),
  );
const CARD_CSV = sample('card-moneda-column.csv');
// The same card's statement with a Pesos and a Dólares amount column, under account details
const COLUMNS_CSV = sample('card-pesos-dolares-columns.csv');
// As some exports write it, without a separator at the end of each line: the card's details
// above are then as wide as the table
const COLUMNS_CSV_NO_TRAILING = Buffer.from(COLUMNS_CSV.toString().replace(/,(\r?\n)/g, '$1'));

const setCurrency = (api: Api, currency: string) => api.call('PUT', '/currency', { currency });

async function importFile(page: Page, name: string, buffer: Buffer) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Transactions' });
  await dialog.getByLabel('Bank file').setInputFiles({ name, mimeType: 'text/plain', buffer });
  return dialog;
}

async function putInSection(page: Page, account: Account, section: string) {
  await open(page, `/accounts/${account.id}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Account' });
  // Filled in once the account has loaded: typing before that would be undone
  await expect(dialog.getByRole('textbox', { name: 'Account name' })).toHaveValue(account.name);
  await dialog.getByRole('combobox', { name: /^Section/ }).fill(section);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}

test('a card statement in pesos and dollars goes into each currency’s account', async ({
  page,
  api,
}) => {
  await setCurrency(api, 'UYU');
  const pesos = await api.createAccount('Visa pesos', 0, 'credit');
  const dollars = await api.createAccount('Visa dollars', 0, 'credit', { currency: 'USD' });
  await api.createAccount('Dollar savings', 0, 'savings', { currency: 'USD' });
  await putInSection(page, pesos, 'Visa');
  await putInSection(page, dollars, 'Visa');

  await open(page, `/accounts/${pesos.id}`);
  let dialog = await importFile(page, 'card.csv', CARD_CSV);
  await expect(dialog.getByRole('combobox', { name: 'Column Moneda' })).toHaveValue('currency');
  // "Pesos" could be any peso: this card's section is in Uruguayan pesos. This device speaks
  // English, so "Dolares" is the user's to say.
  await expect(dialog.getByRole('combobox', { name: 'Currency of Pesos' })).toHaveValue('UYU');
  const dolares = dialog.getByRole('combobox', { name: 'Currency of Dolares' });
  await expect(dolares).toHaveValue('');
  await expect(dialog).toContainText('FlyBudget can\'t tell which currency "Dolares" is');
  await expect(dialog.getByRole('button', { name: 'Preview' })).toBeDisabled();
  await dolares.selectOption('USD');

  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText('4 transactions found. 0 duplicates detected.');
  await expect(dialog).toContainText(
    "1 row in USD isn't imported here. You can import it into a USD account after this.",
  );
  await dialog.getByRole('button', { name: 'Import 4 Transactions' }).click();
  await expect(dialog).toContainText('4 imported, 0 skipped');

  // The card's other side is suggested; the savings account is offered too
  const picker = dialog.getByRole('combobox', { name: 'Account for the USD rows' });
  await expect(picker).toHaveValue(dollars.id);
  await expect(picker.getByRole('option')).toHaveText(['Visa dollars', 'Dollar savings']);
  await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
  await expect(dialog).toContainText('1 transactions found. 0 duplicates detected.');
  // Pesos are done: not offered again
  await expect(dialog).not.toContainText('in UYU');
  await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
  await expect(dialog).toContainText('1 imported, 0 skipped');
  await expect(dialog.getByRole('combobox', { name: /^Account for the/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done' }).click();

  const summary = async (accountId: string) =>
    (await api.transactions(`?account_id=${accountId}&from=2026-09-01`))
      .map((t) => [t.date, t.payeeName, t.amount])
      .sort((a, b) => String(a).localeCompare(String(b)));
  expect(await summary(pesos.id)).toEqual([
    ['2026-09-28', 'DLOPedidosYa', 66_689],
    ['2026-09-30', 'Farmacia', 45_550],
    ['2026-09-30', 'Heladera', 100_000],
    ['2026-09-30', 'Pago', -500_000],
  ]);
  expect(await summary(dollars.id)).toEqual([['2026-09-29', 'APPLECOMBILL', 303]]);

  // Next month: the column and what "Dolares" means are remembered
  dialog = await importFile(page, 'card.csv', CARD_CSV);
  await expect(dialog.getByRole('combobox', { name: 'Currency of Dolares' })).toHaveValue('USD');
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText('4 transactions found. 4 duplicates detected.');
  // Nothing new here: go straight on to the dollars, which are already there too
  await expect(dialog.getByRole('button', { name: 'Import 0 Transactions' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
  await expect(dialog).toContainText('1 transactions found. 1 duplicates detected.');
  // The pesos were dealt with: not offered again
  await expect(dialog).not.toContainText('in UYU');
});

const summary = async (api: Api, accountId: string) =>
  (await api.transactions(`?account_id=${accountId}&from=2026-09-01`))
    .map((t) => [t.date, t.payeeName, t.amount])
    .sort((a, b) => String(a).localeCompare(String(b)));

test.describe('on a Spanish-speaking device', () => {
  test.use({ locale: 'es-UY' });

  test('a card statement with one amount column per currency goes into each account', async ({
    page,
    api,
  }) => {
    await setCurrency(api, 'UYU');
    const pesos = await api.createAccount('Visa pesos', 0, 'credit');
    const dollars = await api.createAccount('Visa dollars', 0, 'credit', { currency: 'USD' });
    await putInSection(page, pesos, 'Visa');
    await putInSection(page, dollars, 'Visa');

    await open(page, `/accounts/${pesos.id}`);
    const dialog = await importFile(page, 'card.csv', COLUMNS_CSV);
    // "Pesos" and "Dólares" could be several currencies: the card's section settles them
    await expect(dialog.getByRole('combobox', { name: 'Column Pesos' })).toHaveValue('amount');
    await expect(dialog.getByRole('combobox', { name: 'Column Dólares' })).toHaveValue('amount');
    await expect(
      dialog.getByRole('combobox', { name: 'Currency of the Pesos column' }),
    ).toHaveValue('UYU');
    await expect(
      dialog.getByRole('combobox', { name: 'Currency of the Dólares column' }),
    ).toHaveValue('USD');
    // "Importe original" names no currency: left out
    await expect(dialog.getByRole('combobox', { name: 'Column Importe original' })).toHaveValue(
      'skip',
    );

    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog).toContainText('2 transactions found. 0 duplicates detected.');
    await expect(dialog).toContainText(
      "3 rows in USD aren't imported here. You can import them into a USD account after this.",
    );
    await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
    await expect(dialog).toContainText('2 imported, 0 skipped');
    await expect(dialog.getByRole('combobox', { name: 'Account for the USD rows' })).toHaveValue(
      dollars.id,
    );
    await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
    await expect(dialog).toContainText('3 transactions found. 0 duplicates detected.');
    await dialog.getByRole('button', { name: 'Import 3 Transactions' }).click();
    await expect(dialog).toContainText('3 imported, 0 skipped');
    await dialog.getByRole('button', { name: 'Done' }).click();

    // Nothing is converted: each account gets its own column's amounts
    expect(await summary(api, pesos.id)).toEqual([
      ['2026-09-19', 'Supermercado', 134_328],
      ['2026-09-20', 'Pago Automatico', -1_382_126],
    ]);
    expect(await summary(api, dollars.id)).toEqual([
      ['2026-09-04', 'Streaming', 999],
      ['2026-09-21', 'Reembolso', -499],
      ['2026-09-22', 'Hotel', 12_000],
    ]);
  });
});

test('the currency of an amount column FlyBudget can’t read is chosen and remembered', async ({
  page,
  api,
}) => {
  await setCurrency(api, 'UYU');
  const pesos = await api.createAccount('Visa pesos', 0, 'credit');
  const dollars = await api.createAccount('Visa dollars', 0, 'credit', { currency: 'USD' });

  await open(page, `/accounts/${pesos.id}`);
  let dialog = await importFile(page, 'card.csv', COLUMNS_CSV_NO_TRAILING);
  // This device speaks English: "Dólares" isn't read as a currency
  await expect(dialog.getByRole('combobox', { name: 'Column Dólares' })).toHaveValue('skip');
  await dialog.getByRole('combobox', { name: 'Column Dólares' }).selectOption('amount');
  const dolares = dialog.getByRole('combobox', { name: 'Currency of the Dólares column' });
  await expect(dolares).toHaveValue('');
  await expect(dialog).toContainText('Choose the currency of "Dólares" under the column.');
  await expect(dialog.getByRole('button', { name: 'Preview' })).toBeDisabled();
  await dolares.selectOption('USD');
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText("3 rows in USD aren't imported here.");
  await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
  await expect(dialog).toContainText('2 imported, 0 skipped');
  // Not in a section: the dollar card is offered, not chosen
  const picker = dialog.getByRole('combobox', { name: 'Account for the USD rows' });
  await expect(picker).toHaveValue('');
  await picker.selectOption(dollars.id);
  await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
  await dialog.getByRole('button', { name: 'Import 3 Transactions' }).click();
  await expect(dialog).toContainText('3 imported, 0 skipped');
  await dialog.getByRole('button', { name: 'Done' }).click();
  expect(await summary(api, dollars.id)).toHaveLength(3);

  // Next month: the column and its currency are remembered
  dialog = await importFile(page, 'card.csv', COLUMNS_CSV_NO_TRAILING);
  await expect(
    dialog.getByRole('combobox', { name: 'Currency of the Dólares column' }),
  ).toHaveValue('USD');
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText('2 transactions found. 2 duplicates detected.');
});

test('a currency column with only the account’s currency imports as usual', async ({
  page,
  api,
}) => {
  await setCurrency(api, 'EUR');
  const account = await api.createAccount('Girokonto', 0);
  await open(page, `/accounts/${account.id}`);
  const dialog = await importFile(page, 'bank.csv', sample('currency-column-other-bank.csv'));
  await expect(dialog.getByRole('combobox', { name: 'Column Currency' })).toHaveValue('currency');
  await expect(dialog.getByRole('combobox', { name: 'Currency of EUR' })).toHaveValue('EUR');
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText('2 transactions found. 0 duplicates detected.');
  await expect(dialog).not.toContainText("isn't imported here");
  await dialog.getByRole('button', { name: 'Import 2 Transactions' }).click();
  await expect(dialog).toContainText('2 imported, 0 skipped');
  await expect(dialog.getByRole('combobox', { name: /^Account for the/ })).toHaveCount(0);
});

test('a file with no rows in the account’s currency offers the other account right away', async ({
  page,
  api,
}) => {
  await setCurrency(api, 'UYU');
  const pesos = await api.createAccount('Visa pesos', 0, 'credit');
  const dollars = await api.createAccount('Visa dollars', 0, 'credit', { currency: 'USD' });
  const csv = 'Fecha,Concepto,Importe,Moneda\n29/09/2026,Hotel,"120,00",USD\n';

  await open(page, `/accounts/${pesos.id}`);
  const dialog = await importFile(page, 'card.csv', Buffer.from(csv));
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText("1 row in USD isn't imported here.");
  await expect(dialog.getByRole('button', { name: 'Import 0 Transactions' })).toBeDisabled();
  // Not in a section: nothing is suggested
  const picker = dialog.getByRole('combobox', { name: 'Account for the USD rows' });
  await expect(picker).toHaveValue('');
  await picker.selectOption(dollars.id);
  await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
  await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
  await expect(dialog).toContainText('1 imported, 0 skipped');
  expect(await api.transactions(`?account_id=${dollars.id}&from=2026-09-01`)).toMatchObject([
    { payeeName: 'Hotel', amount: 12_000 },
  ]);
});

test('a statement in another currency can be imported into an account in it', async ({
  page,
  api,
}) => {
  await setCurrency(api, 'EUR');
  const giro = await api.createAccount('Girokonto', 0);
  const dollars = await api.createAccount('Dollar account', 0, 'checking', { currency: 'USD' });
  const statement = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
  <Acct><Id><IBAN>DE89370400440532013000</IBAN></Id><Ccy>USD</Ccy></Acct>
  <Ntry><AcctSvcrRef>U1</AcctSvcrRef><Amt Ccy="USD">40.00</Amt><CdtDbtInd>DBIT</CdtDbtInd>
    <Sts>BOOK</Sts><BookgDt><Dt>2026-09-15</Dt></BookgDt></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

  await open(page, `/accounts/${giro.id}`);
  const dialog = await importFile(page, 'statement.xml', Buffer.from(statement));
  await expect(dialog.getByRole('alert')).toContainText(
    'This statement is in USD, but this account is in EUR.',
  );
  await expect(dialog.getByRole('button', { name: 'Import 1 Transactions' })).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'Account for the USD rows' }).selectOption(dollars.id);
  await dialog.getByRole('button', { name: 'Preview the USD rows' }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Import 1 Transactions' }).click();
  await expect(dialog).toContainText('1 imported, 0 skipped');
  expect(await api.transactions(`?account_id=${dollars.id}&from=2026-09-01`)).toMatchObject([
    { amount: -4_000 },
  ]);
  expect(await api.transactions(`?account_id=${giro.id}&from=2026-09-01`)).toEqual([]);
});
