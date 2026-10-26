import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// "Flip amount signs": for exports that write purchases as positive amounts (some card
// statements). Offered for a signed amount column, remembered per account, never ticked by
// FlyBudget itself; on a card, a mostly positive file gets a caution.

// A card export with purchases positive and the payment negative
const CARD_CSV =
  'Date,Description,Amount\r\n' +
  '2025-03-01,Grocer,45.10\r\n' +
  '2025-03-02,Bookshop,12.00\r\n' +
  '2025-03-03,Cinema,18.50\r\n' +
  '2025-03-04,Pharmacy,9.99\r\n' +
  '2025-03-05,Bakery,4.20\r\n' +
  '2025-03-06,Refund,-15.00\r\n' +
  '2025-03-07,Payment,-200.00\r\n';

async function importCsv(page: Page, csv: string) {
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Transactions' });
  await dialog.getByLabel('Bank file').setInputFiles({
    name: 'card.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  return dialog;
}

const CAUTION = 'Most amounts in this file are positive.';

test('flips the signs of a card export, and remembers it for the next file', async ({
  page,
  api,
}) => {
  const card = await api.createAccount('Visa', 0, 'credit');
  await open(page, `/accounts/${card.id}`);
  let dialog = await importCsv(page, CARD_CSV);
  const flip = dialog.getByRole('checkbox', { name: 'Flip amount signs' });
  await expect(flip).not.toBeChecked();
  await expect(dialog).toContainText(CAUTION);

  await flip.check();
  await expect(dialog).not.toContainText(CAUTION);
  await dialog.getByRole('button', { name: 'Preview' }).click();
  await expect(dialog).toContainText('7 transactions found.');
  await dialog.getByRole('button', { name: 'Import 7 Transactions' }).click();
  await expect(dialog).toContainText('7 imported, 0 skipped');
  await dialog.getByRole('button', { name: 'Done' }).click();

  const amounts = Object.fromEntries(
    (await api.transactions(`?account_id=${card.id}&from=2025-03-01`)).map((t) => [
      t.payeeName,
      t.amount,
    ]),
  );
  expect(amounts).toMatchObject({ Grocer: -4510, Refund: 1500, Payment: 20000 });

  // Next month's file has the same columns: ticked already
  dialog = await importCsv(page, CARD_CSV.replaceAll('2025-03', '2025-04'));
  await expect(dialog.getByRole('checkbox', { name: 'Flip amount signs' })).toBeChecked();
});

test('only a card gets the caution, and inflow/outflow files have no box', async ({
  page,
  api,
}) => {
  const checking = await api.createAccount('Checking', 0);
  await open(page, `/accounts/${checking.id}`);
  let dialog = await importCsv(page, CARD_CSV);
  await expect(dialog.getByRole('checkbox', { name: 'Flip amount signs' })).not.toBeChecked();
  await expect(dialog).not.toContainText(CAUTION);
  await dialog.getByRole('button', { name: 'Close' }).click();

  dialog = await importCsv(
    page,
    'Date,Description,Debit,Credit\r\n2025-03-01,Grocer,45.10,\r\n2025-03-02,Salary,,2500.00\r\n',
  );
  await expect(dialog.getByRole('combobox', { name: 'Column Debit' })).toHaveValue('outflow');
  await expect(dialog.getByRole('checkbox', { name: 'Flip amount signs' })).toHaveCount(0);
});
