import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, thisMonth } from './fixtures';

// The zero-based budget: To Be Budgeted = income + carry-over − planned.

const toBeBudgeted = (page: Page) => page.getByRole('status', { name: 'To be budgeted' });

async function plan(page: Page, category: string, amount: string) {
  const button = page.getByRole('button', { name: new RegExp(`^Planned for ${category}:`) });
  // Categories with no activity sit under "Show N inactive categories" in each section
  await expect(page.getByRole('button', { name: /^Planned for / }).first()).toBeVisible();
  const showInactive = page.getByRole('button', { name: /^Show \d+ inactive/ });
  while (!(await button.isVisible()) && (await showInactive.count()) > 0) {
    await showInactive.first().click();
  }
  await button.click();
  const input = page.getByRole('spinbutton', { name: `Planned for ${category}` });
  await input.fill(amount);
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: new RegExp(`^Planned for ${category}: \\$`) }),
  ).toBeVisible();
}

test.describe('budget', () => {
  test('income is ready to budget, and planning spends it down', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 300_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });

    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$3,000');
    await expect(toBeBudgeted(page)).toContainText('Left to budget');

    await plan(page, 'Groceries', '400');
    await expect(toBeBudgeted(page)).toContainText('$2,600');
    await plan(page, 'Rent / Mortgage', '2600');
    await expect(toBeBudgeted(page)).toContainText('$0');
    await expect(toBeBudgeted(page)).toContainText('Fully budgeted');

    const summary = await api.call('GET', `/budget/${thisMonth()}/summary`);
    expect(summary).toMatchObject({ income: 300_000, totalBudgeted: 300_000, toBeBudgeted: 0 });

    await plan(page, 'Restaurants', '50');
    await expect(toBeBudgeted(page)).toContainText('-$50');
    await expect(toBeBudgeted(page)).toContainText('Over budget');
  });

  test('spending shows against its categories, including split parts', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 100_000);
    const groceries = await api.category('Groceries');
    const restaurants = await api.category('Restaurants');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
    await api.call('PUT', `/budget/${thisMonth()}/${restaurants.id}`, { budgeted: 10_000 });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -12_000,
      payeeName: 'Supercenter',
      splits: [
        { categoryId: groceries.id, amount: -9_000 },
        { categoryId: restaurants.id, amount: -3_000 },
      ],
    });

    await open(page, '/budget');
    const groceriesRow = page.getByRole('row').filter({ hasText: 'Groceries' });
    await expect(groceriesRow).toContainText('$90');
    await expect(groceriesRow).toContainText('$410');
    const restaurantsRow = page.getByRole('row').filter({ hasText: 'Restaurants' });
    await expect(restaurantsRow).toContainText('$30');
    await expect(restaurantsRow).toContainText('$70');
  });

  test('income in an off-budget account is not money to budget', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const brokerage = await api.createAccount('Brokerage', 0, 'investment');
    const paychecks = await api.category('Paychecks');
    const dividends = await api.category('Interest');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      categoryId: paychecks.id,
    });
    await api.createTransaction({
      accountId: brokerage.id,
      date: isoDay(),
      amount: 55_000,
      categoryId: dividends.id,
    });
    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$1,000');
  });

  test('unspent money carries over to the next month', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 100_000,
      categoryId: paychecks.id,
    });
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 40_000 });

    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$600');
    await page.getByRole('button', { name: 'Next month' }).click();
    // Last month's unbudgeted $600 is still there to budget
    await expect(toBeBudgeted(page)).toContainText('$600');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(toBeBudgeted(page)).toContainText('$0');
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(toBeBudgeted(page)).toContainText('$600');
  });

  test('a category links to its detail page with its transactions', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 20_000 });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -4_321,
      payeeName: 'Farm Stand',
      categoryId: groceries.id,
    });
    await open(page, '/budget');
    await page.getByRole('row').filter({ hasText: 'Groceries' }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));
    await expect(
      page.getByTestId('transaction-row').filter({ hasText: 'Farm Stand' }),
    ).toBeVisible();
  });
  test('a dollar account counts in pesos, at the exchange rate of each transaction’s date', async ({
    page,
    api,
  }) => {
    const dollars = await api.createAccount('Dollar savings', 0, 'checking', { currency: 'USD' });
    const groceries = await api.category('Groceries');
    const paychecks = await api.category('Paychecks');
    await api.call('PUT', `/exchange-rates/${isoDay()}`, { rate: 40 });
    await api.createTransaction({
      accountId: dollars.id,
      date: isoDay(),
      amount: 100_000,
      payeeName: 'Client abroad',
      categoryId: paychecks.id,
    });
    await api.createTransaction({
      accountId: dollars.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Import Market',
      categoryId: groceries.id,
    });

    // US$ 1,000 received and US$ 50 spent at 40 pesos per dollar
    await open(page, '/budget');
    await expect(toBeBudgeted(page)).toContainText('$40,000');
    const groceriesRow = page.getByRole('row').filter({ hasText: 'Groceries' });
    await expect(groceriesRow).toContainText('$2,000');

    // The category page lists the native amount, with the pesos it counts as on hover and in
    // the detail panel
    await groceriesRow.getByRole('link').click();
    const purchase = page.getByTestId('transaction-row').filter({ hasText: 'Import Market' });
    await expect(purchase).toContainText('US$50');
    await expect(purchase.getByTitle(/^\$2,000 at the exchange rate of /)).toHaveText('US$50');
    await expect(page.getByRole('main')).toContainText('Total spending');
    await purchase.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    await expect(panel.getByTestId('converted-amount')).toContainText(
      '$2,000 at the exchange rate of',
    );
    await page.getByRole('button', { name: 'Close details' }).click();

    // Correcting that day's rate changes the budget right away
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exchange rates' }).click();
    await page.getByRole('button', { name: /^Edit the rate of / }).click();
    const dialog = page.getByRole('dialog', { name: 'Correct a rate' });
    await dialog.getByLabel('Pesos per dollar').fill('42');
    await dialog.getByRole('button', { name: 'Save rate' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('link', { name: 'Budget', exact: true }).click();
    await expect(toBeBudgeted(page)).toContainText('$42,000');
    await expect(page.getByRole('row').filter({ hasText: 'Groceries' })).toContainText('$2,100');
  });

  test('switching months keeps the budget on screen while the next month loads', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 0);
    const groceries = await api.category('Groceries');
    await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 20_000 });
    await open(page, '/budget');
    const groceriesPlanned = page.getByRole('button', { name: /^Planned for Groceries:/ });
    await expect(groceriesPlanned).toBeVisible();

    // Make next month slow to load, so the moment in between can be checked
    const [y, m] = thisMonth().split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    await page.route(`**/api/budget/${next}**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Next month' }).click();
    // Still loading: this month's table stays (faded) instead of collapsing to nothing
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(groceriesPlanned).toBeVisible();
    await expect(page.getByText('No categories yet')).toHaveCount(0);

    // Then next month's figures replace it
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Planned for Groceries: \$0(\.00)?$/ }),
    ).toBeVisible();
  });
});

test.describe('the budget in Spanish', () => {
  test.use({ language: 'es' });

  /** A month's name as the Spanish app writes it ("octubre de 2026"; shown with a capital) */
  const monthTitle = (date: Date) =>
    new RegExp(
      `^${new Intl.DateTimeFormat('es', { month: 'long' }).format(date)} de ${date.getFullYear()}$`,
      'i',
    );

  test('planning, moving between months and a category page read in Spanish', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Checking', 0);
    const paychecks = await api.category('Paychecks');
    const groceries = await api.category('Groceries');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: 300_000,
      payeeName: 'Employer',
      categoryId: paychecks.id,
    });
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -4_321,
      payeeName: 'Farm Stand',
      categoryId: groceries.id,
    });

    await open(page, '/budget');
    const main = page.getByRole('main');
    const porAsignar = page.getByRole('status', { name: 'Por asignar' });
    await expect(porAsignar).toContainText('$3,000');
    await expect(porAsignar).toContainText('Queda por asignar');
    const today = new Date();
    await expect(main.getByText(monthTitle(today))).toBeVisible();
    await expect(main).toContainText('Todavía no hay nada planificado para');
    await expect(main.getByRole('link', { name: /Cómo funciona el presupuesto/ })).toBeVisible();

    // Planning an amount
    await page.getByRole('button', { name: /^Planificado para Supermercado:/ }).click();
    const input = page.getByRole('spinbutton', { name: 'Planificado para Supermercado' });
    await expect(main).toContainText('Promedio mensual');
    await input.fill('400');
    await input.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Planificado para Supermercado: $400' }),
    ).toBeVisible();
    await expect(porAsignar).toContainText('$2,600');

    // The table, its sections and the summary beside it
    for (const text of [
      'Ingresos',
      'Gastos',
      'Planificado',
      'Real',
      'Restante',
      'Ingresos totales',
      'Gastos totales',
      'Fijos',
      'Flexibles',
      'Resumen',
      '$400 planificado',
      'gastado',
    ]) {
      await expect(main).toContainText(text);
    }
    const showInactive = main.getByRole('button', { name: /^Mostrar \d+ categorías inactivas$/ });
    await showInactive.first().click();
    await expect(
      main.getByRole('button', { name: /^Ocultar \d+ categorías inactivas$/ }),
    ).toBeVisible();
    // Nothing of the English page is left (category and group names are stored data)
    await expect(main).not.toContainText(
      /Planned|Actual|Remaining|Total Income|Total Expenses|Today|inactive|Summary|budgeted|to budget|earned|spent|Fixed|Flexible\b|Non-Monthly/,
    );

    // Moving between months
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    await expect(main.getByText(monthTitle(next))).toBeVisible();
    await page.getByRole('button', { name: 'Mes anterior' }).click();
    await page.getByRole('button', { name: 'Mes anterior' }).click();
    await page.getByRole('button', { name: 'Hoy' }).click();
    await expect(main.getByText(monthTitle(today))).toBeVisible();

    // A category's page
    await page.getByRole('row').filter({ hasText: 'Supermercado' }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));
    await expect(main.getByRole('link', { name: 'Presupuesto', exact: true })).toBeVisible();
    for (const text of [
      'Historial de gastos',
      'Planificado',
      'Restante',
      'Resumen',
      'Cantidad de transacciones',
      'Transacción más grande',
      'Gastos totales',
      'Primera transacción',
    ]) {
      await expect(main).toContainText(text);
    }
    // Dates are written the Spanish way: "5 oct 2026"
    await expect(main).toContainText(
      new RegExp(`${today.getDate()} \\p{L}{3,4} ${today.getFullYear()}`, 'u'),
    );
    await expect(main).not.toContainText(
      /Spending History|Summary|Planned|Remaining|Largest|Average transaction|Total spending/,
    );
  });
});
