import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';
import type { Api } from './fixtures';

// Files whose rows are in more than one currency: an import brings in the account's currency,
// then offers to import the other currencies' rows into another account. The card statement is
// made-up data in the shape of a Uruguayan bank's export (a Moneda column of Pesos/Dolares).

const CARD_CSV = fs.readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../fixtures/two-currencies/card-moneda-column.csv',
  ),
);

const setCurrency = (api: Api, currency: string) => api.call('PUT', '/currency', { currency });

async function importFile(page: Page, name: string, buffer: Buffer) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Transactions' });
  await dialog.getByLabel('Bank file').setInputFiles({ name, mimeType: 'text/plain', buffer });
  return dialog;
}

async function putInSection(page: Page, accountId: string, section: string) {
  await open(page, `/accounts/${accountId}`);
  await page.getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Account' });
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
  await putInSection(page, pesos.id, 'Visa');
  await putInSection(page, dollars.id, 'Visa');

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
