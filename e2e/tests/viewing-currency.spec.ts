import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth, type Api } from './fixtures';

// The Viewing Currency: one switch for the dashboard, reports, cash flow and net worth. The
// Budget and each account's own amounts never follow it.

/**
 * US$1 = $40 today. Pesos: $40,000 paid in, $2,000 of groceries. Dollars: US$1,000 paid in,
 * US$50 of groceries. So income is $80,000 or US$2,000, spending $4,000 or US$100, and what
 * is left is $38,000 + US$950 = $76,000 or US$1,900.
 */
async function seed(api: Api) {
  const pesos = await api.createAccount('Caja pesos', 0);
  const dollars = await api.createAccount('Caja dolares', 0, 'savings', { currency: 'USD' });
  const groceries = await api.category('Groceries');
  const paychecks = await api.category('Paychecks');
  await api.call('PUT', `/exchange-rates/${isoDay()}`, { rate: 40 });
  const add = (accountId: string, amount: number, payeeName: string, categoryId: string) =>
    api.createTransaction({ accountId, date: isoDay(), amount, payeeName, categoryId });
  await add(pesos.id, 4_000_000, 'Employer', paychecks.id);
  await add(pesos.id, -200_000, 'Market', groceries.id);
  await add(dollars.id, 100_000, 'Client abroad', paychecks.id);
  await add(dollars.id, -5_000, 'Import Market', groceries.id);
}

const viewing = (page: Page) => page.getByRole('radiogroup', { name: 'Viewing currency' });

test.describe('viewing currency', () => {
  test('the dashboard and net worth are in pesos until the switch says dollars', async ({
    page,
    api,
  }) => {
    await seed(api);
    await open(page, '/dashboard');
    const main = page.getByRole('main');
    const nav = page.getByRole('complementary');
    await expect(viewing(page).getByRole('radio', { name: 'Pesos' })).toBeChecked();
    await expect(main).toContainText(/Net Worth\s*\$76,000/);
    await expect(main.getByTestId('net-worth-breakdown')).toHaveText('$38,000 + US$950');
    await expect(main).toContainText(/Avg Monthly Income\s*\$80,000/);
    await expect(nav.getByRole('link', { name: 'All accounts $76,000' })).toBeVisible();

    await viewing(page).getByRole('radio', { name: 'Dollars' }).click();
    // A balance converts at today's rate; each transaction at the rate of its own date
    await expect(main).toContainText(/Net Worth\s*US\$1,900/);
    await expect(main.getByTestId('net-worth-breakdown')).toHaveText('US$950 + $38,000');
    await expect(main).toContainText(/Avg Monthly Income\s*US\$2,000/);
    await expect(main).toContainText(/Avg Monthly Expenses\s*US\$100/);
    await expect(nav.getByRole('link', { name: 'All accounts US$1,900' })).toBeVisible();

    // Each account keeps its own balance in its own currency
    await nav.getByRole('button', { name: 'For budget US$1,900' }).click();
    await expect(nav.getByRole('link', { name: 'Caja pesos $38,000' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Caja dolares US$950' })).toBeVisible();

    // Remembered on this device
    await page.reload();
    await expect(viewing(page).getByRole('radio', { name: 'Dollars' })).toBeChecked();
    await expect(page.getByRole('main')).toContainText(/Net Worth\s*US\$1,900/);
  });

  test('one switch covers reports, custom reports and cash flow, their exports included', async ({
    page,
    api,
  }) => {
    await seed(api);
    await open(page, '/reports');
    const main = page.getByRole('main');
    await expect(main).toContainText(/\$80,000\s*Total Income/);
    await viewing(page).getByRole('radio', { name: 'Dollars' }).click();
    await expect(main).toContainText(/US\$2,000\s*Total Income/);
    await expect(main).toContainText(/US\$100\s*Total Expenses/);
    await expect(main).not.toContainText('$80,000');

    // Chosen on one page, in force on the others
    await open(page, '/reports/custom');
    await expect(viewing(page).getByRole('radio', { name: 'Dollars' })).toBeChecked();
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('account');
    const table = page.getByRole('table');
    // A dollar purchase is its own amount; a pesos one is what it cost in dollars that day
    await expect(table.getByRole('row', { name: 'Caja dolares US$50' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Caja pesos US$50' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Total US$100' })).toBeVisible();

    await open(page, '/cash-flow');
    await expect(viewing(page).getByRole('radio', { name: 'Dollars' })).toBeChecked();
    await expect(page.getByRole('main')).toContainText(/US\$2,000\s*Total income/);
    await expect(page.getByRole('main')).toContainText(/US\$100\s*Total expenses/);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const csv = fs.readFileSync(await (await download).path(), 'utf8').split('\n');
    expect(csv[0]).toBe('category,group,total_cents,currency');
    expect(csv.find((line) => line.includes('Groceries'))).toMatch(/,10000,US\$$/);

    // Back to pesos from here
    await viewing(page).getByRole('radio', { name: 'Pesos' }).click();
    await expect(page.getByRole('main')).toContainText(/\$80,000\s*Total income/);
  });

  test('the Accounts page totals follow the switch, each account keeps its own balance', async ({
    page,
    api,
  }) => {
    await seed(api);
    await open(page, '/accounts');
    const main = page.getByRole('main');
    // Checking in pesos and savings in dollars are both cash
    await expect(main.getByTestId('account-type-total')).toHaveText('$76,000');
    await expect(main).toContainText(/Assets\s*\$76,000/);

    await viewing(page).getByRole('radio', { name: 'Dollars' }).click();
    await expect(main.getByTestId('account-type-total')).toHaveText('US$1,900');
    await expect(main).toContainText(/Assets\s*US\$1,900/);
    await expect(main).toContainText(/Net Worth\s*US\$1,900/);
    await expect(main).toContainText('$38,000');
    await expect(main).toContainText('US$950');
  });

  test('the Budget, planned amounts and Goals stay in pesos whatever the switch says', async ({
    page,
    api,
  }) => {
    await seed(api);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 500_000 });
    await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });
    await open(page, '/dashboard');
    await viewing(page).getByRole('radio', { name: 'Dollars' }).click();
    const dashboard = page.getByRole('main');
    await expect(dashboard).toContainText(/Net Worth\s*US\$1,900/);
    // The dashboard's Budget figures are the Budget's: $5,000 planned, $4,000 spent
    await expect(dashboard).toContainText(/Left to Spend\s*\$1,000/);
    await expect(dashboard).toContainText('$5,000 planned');

    // Income and spending of both accounts, in pesos: $80,000 and $4,000
    await page.getByRole('link', { name: 'Budget', exact: true }).click();
    const main = page.getByRole('main');
    await expect(main).toContainText('$75,000');
    await expect(page.getByRole('button', { name: 'Planned for Groceries: $5,000' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Groceries' })).toContainText('$4,000');
    await expect(main).not.toContainText('US$');

    await page.getByRole('link', { name: 'Goals', exact: true }).click();
    await expect(page.getByRole('main')).toContainText('$2,000');
    await expect(page.getByRole('main')).not.toContainText('US$');

    // An account's own page is in the account's currency
    const nav = page.getByRole('complementary');
    await nav.getByRole('button', { name: /^For budget/ }).click();
    await nav.getByRole('link', { name: /^Caja pesos/ }).click();
    await expect(page.getByRole('main')).toContainText('$38,000');
    await expect(page.getByRole('main')).not.toContainText('US$');
    await nav.getByRole('link', { name: /^Caja dolares/ }).click();
    await expect(page.getByRole('main')).toContainText('US$950');
    await expect(page.getByRole('main')).toContainText('US$1,000');
  });
});
