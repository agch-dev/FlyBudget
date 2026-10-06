import { test, expect, open, isoDay } from './fixtures';

// Settings: managing categories and groups, and preferences.

test.describe('categories', () => {
  test.beforeEach(async ({ api, page }) => {
    await api.createAccount('Checking', 0);
    await open(page, '/settings');
  });

  test('creates a group and a category in it', async ({ page, api }) => {
    // The second "Create group" is in the Expenses section
    await page.getByRole('button', { name: 'Create group' }).nth(1).click();
    await page.getByPlaceholder('Group name...').fill('Pets');
    await page.getByRole('button', { name: 'Add group' }).click();
    await expect(page.getByText('Pets', { exact: true })).toBeVisible();

    // New groups go last, so its "Create Category" is the last one
    await page.getByRole('button', { name: 'Create Category' }).last().click();
    await page.getByPlaceholder('Category name...').fill('Vet Bills');
    await page.getByPlaceholder('Category name...').press('Enter');
    await expect(page.getByRole('button', { name: 'Edit Vet Bills' })).toBeVisible();

    const pets = (await api.categoryGroups()).find((g) => g.name === 'Pets')!;
    expect(pets).toMatchObject({ isIncome: 0 });
    expect(pets.categories.map((c) => c.name)).toEqual(['Vet Bills']);
  });

  test('renames a category from the keyboard', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Edit Parking' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Edit Category' });
    await dialog.getByRole('textbox', { name: 'Category name' }).fill('Parking & Tolls');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Edit Parking & Tolls' })).toBeVisible();
    await expect.poll(() => api.category('Parking & Tolls')).toBeTruthy();
  });

  test('deleting a used category moves its transactions first', async ({ page, api }) => {
    const [checking] = await api.accounts();
    const parking = await api.category('Parking');
    const transit = await api.category('Public Transit');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_200,
      payeeName: 'City Garage',
      categoryId: parking.id,
    });

    await page.getByRole('button', { name: 'Edit Parking' }).click();
    await page
      .getByRole('dialog', { name: 'Edit Category' })
      .getByRole('button', { name: 'Delete' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Delete Category' });
    await expect(dialog).toContainText('Parking has 1 transaction');
    await expect(dialog.getByRole('button', { name: 'Reassign & Delete' })).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Move transactions to' }).selectOption(transit.id);
    await dialog.getByRole('button', { name: 'Reassign & Delete' }).click();

    await expect(page.getByRole('button', { name: 'Edit Parking' })).toBeHidden();
    const [tx] = await api.transactions();
    expect(tx.categoryId).toBe(transit.id);
  });
});

test.describe('preferences', () => {
  test('persist across reloads', async ({ page, api }) => {
    await api.createAccount('Checking', 123_456);
    await open(page, '/settings');
    await page.getByRole('button', { name: 'Preferences' }).click();
    // The dark theme is applied to the page and remembered
    await page.getByRole('main').getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('goals', () => {
  test('adds a savings goal and shows its progress', async ({ page, api }) => {
    const savings = await api.createAccount('Savings', 0, 'savings');
    await open(page, '/goals');
    await page.getByRole('main').getByRole('button', { name: 'Add Goal' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Add Goal' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Emergency Fund');
    await dialog.getByRole('textbox', { name: 'Target', exact: true }).fill('10000');
    await dialog.getByRole('textbox', { name: 'Saved so far' }).fill('2500');
    await dialog
      .getByRole('combobox', { name: 'Linked account' })
      .selectOption({ label: 'Savings' });
    await dialog.getByRole('button', { name: '🛡️' }).click();
    await expect(dialog.getByRole('button', { name: '🛡️' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog.getByRole('button', { name: 'Color #059669' }).click();
    await dialog.getByRole('button', { name: 'Add Goal' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('main')).toContainText('Emergency Fund');
    await expect(page.getByRole('main')).toContainText('25%');
    const [goal] = await api.call<any[]>('GET', '/goals');
    expect(goal).toMatchObject({
      name: 'Emergency Fund',
      targetAmount: 1_000_000,
      currentAmount: 250_000,
      accountId: savings.id,
      icon: '🛡️',
      color: '#059669',
      currency: 'UYU',
    });
  });

  test('a dollar goal shows dollars on its card and pesos in the summary', async ({
    page,
    api,
  }) => {
    await api.createAccount('Checking', 0);
    await api.call('PUT', `/exchange-rates/${isoDay()}`, { rate: 40 });
    await api.call('POST', '/goals', { name: 'Trip', targetAmount: 500_000 });
    await open(page, '/goals');
    await page.getByRole('main').getByRole('button', { name: 'Add Goal' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Add Goal' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('House');
    const currency = dialog.getByRole('radiogroup', { name: 'Currency' });
    await expect(currency.getByRole('radio', { name: 'Pesos ($)' })).toBeChecked();
    await currency.getByRole('radio', { name: 'Dollars (US$)' }).click();
    await dialog.getByRole('textbox', { name: 'Target', exact: true }).fill('1000');
    await dialog.getByRole('textbox', { name: 'Saved so far' }).fill('250');
    await dialog.getByRole('button', { name: 'Add Goal' }).click();
    await expect(dialog).toBeHidden();

    const main = page.getByRole('main');
    // The card, in dollars
    await expect(main).toContainText('US$250');
    await expect(main).toContainText('of US$1,000');
    await expect(main).toContainText('US$750 to go');
    // The summary, in pesos at 40: target 40,000 + 5,000, of which 10,000 is saved
    await expect(main).toContainText('$45,000');
    await expect(main).toContainText('$35,000');
    await expect(main).toContainText("converted at today's exchange rate");
  });

  test('linking a dollar account locks the currency and asks to confirm the target', async ({
    page,
    api,
  }) => {
    await api.createAccount('Dollar savings', 0, 'savings', { currency: 'USD' });
    const goal = await api.call<{ id: string }>('POST', '/goals', {
      name: 'Car',
      targetAmount: 800_000,
    });
    await open(page, '/goals');
    await page.getByRole('main').getByText('Car').click();

    const dialog = page.getByRole('dialog', { name: 'Edit Goal' });
    await dialog
      .getByRole('combobox', { name: 'Linked account' })
      .selectOption({ label: 'Dollar savings' });
    await expect(dialog.getByRole('radio', { name: 'Dollars (US$)' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Pesos ($)' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Save' }).click();

    const confirm = page.getByRole('dialog', { name: 'Check the target' });
    await expect(confirm).toContainText('US$8,000');
    // Nothing is saved until the user confirms
    expect((await api.call<any[]>('GET', '/goals'))[0]).toMatchObject({ currency: 'UYU' });
    await confirm.getByRole('button', { name: 'Yes, save' }).click();
    await expect(confirm).toBeHidden();

    await expect(page.getByRole('main')).toContainText('of US$8,000');
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/goals')).find((g) => g.id === goal.id))
      .toMatchObject({ currency: 'USD', targetAmount: 800_000 });
  });
});

test.describe('exchange rates', () => {
  test.beforeEach(async ({ api }) => {
    await api.createAccount('Checking', 0);
  });

  test('a rate is entered by hand, then corrected', async ({ page, api }) => {
    await open(page, '/settings?tab=rates');
    await expect(page.getByText('No exchange rates yet')).toBeVisible();
    await expect(page.getByText('Never fetched')).toBeVisible();

    await page.getByRole('button', { name: 'Enter a rate' }).first().click();
    let dialog = page.getByRole('dialog', { name: 'Enter a rate' });
    // Today is filled in
    await expect(dialog.getByLabel('Date')).toHaveValue(isoDay());
    await expect(dialog.getByRole('button', { name: 'Save rate' })).toBeDisabled();
    await dialog.getByLabel('Pesos per dollar').fill('40.342');
    await dialog.getByRole('button', { name: 'Save rate' }).click();
    await expect(dialog).toBeHidden();

    const main = page.getByRole('main');
    await expect(main).toContainText("Today's rate");
    await expect(main).toContainText('$ 40.342 per US$ 1');
    await expect(main).toContainText('Entered by hand');
    await expect(main).toContainText('1 rate');

    await page.getByRole('button', { name: /^Edit the rate of / }).click();
    dialog = page.getByRole('dialog', { name: 'Correct a rate' });
    await expect(dialog.getByLabel('Pesos per dollar')).toHaveValue('40.342');
    await dialog.getByLabel('Pesos per dollar').fill('41.5');
    await dialog.getByRole('button', { name: 'Save rate' }).click();
    await expect(dialog).toBeHidden();
    await expect(main).toContainText('$ 41.50 per US$ 1');

    const { rates } = await api.call('GET', '/exchange-rates');
    expect(rates).toMatchObject([{ date: isoDay(), rate: 41.5, manual: true }]);
  });

  test('rates are listed by month, and an earlier rate covers today', async ({ page, api }) => {
    await api.call('PUT', `/exchange-rates/${isoDay(-2)}`, { rate: 40.25 });
    await api.call('PUT', `/exchange-rates/${isoDay(-45)}`, { rate: 39.75 });
    await open(page, '/settings?tab=rates');

    const main = page.getByRole('main');
    await expect(main).toContainText('$ 40.25 per US$ 1');
    await expect(main).toContainText('the latest there is');
    // One group per month, the newest open
    const months = main.getByRole('group', { name: /^Rates of / });
    await expect(months).toHaveCount(2);
    await expect(months.first()).toHaveAttribute('open', '');
    await expect(months.last()).not.toHaveAttribute('open');
    await expect(main.getByText('39.75')).toBeHidden();
    await months.last().getByText('1 rate').click();
    await expect(main.getByText('39.75')).toBeVisible();
  });

  test('a refresh that fails says so and keeps the rates', async ({ page, api }) => {
    // The test servers run with fetching switched off (global-setup.ts): the source is a
    // personal API, so nothing here may reach it. The failed request logs a console error.
    test.info().annotations.push({ type: 'allow-page-errors', description: 'refresh fails' });
    await api.call('PUT', `/exchange-rates/${isoDay(-1)}`, { rate: 40.25 });
    await open(page, '/settings?tab=rates');

    await page.getByRole('button', { name: 'Refresh' }).click();
    // With fetching switched off the refusal says so, rather than "couldn't get them right now"
    await expect(page.getByRole('alert')).toHaveText(
      'Fetching exchange rates is switched off (FLYBUDGET_EXCHANGE_RATES=off)',
    );
    await expect(page.getByRole('main')).toContainText('$ 40.25 per US$ 1');
  });
});

test.describe('estimated exchange rates', () => {
  test('a banner names dollar dates without a rate until one is entered', async ({ page, api }) => {
    const dollars = await api.createAccount('Dollars', 0, 'checking', { currency: 'USD' });
    await api.call('PUT', `/exchange-rates/${isoDay(-30)}`, { rate: 40.25 });
    for (const days of [-90, -60, -10]) {
      await api.createTransaction({ accountId: dollars.id, date: isoDay(days), amount: -1_500 });
    }
    await open(page, '/dashboard');

    const banner = page.getByRole('status', { name: 'Estimated exchange rates' });
    await expect(banner).toContainText('No exchange rate for');
    await expect(banner).toContainText('those dates');
    expect((await api.call('GET', '/exchange-rates/estimated')).dates).toEqual([
      isoDay(-90),
      isoDay(-60),
    ]);

    await banner.getByRole('link', { name: 'Enter rates' }).click();
    await expect(page).toHaveURL(/settings\?tab=rates/);
    await page.getByRole('button', { name: 'Enter a rate' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Enter a rate' });
    await dialog.getByLabel('Date').fill(isoDay(-60));
    await dialog.getByLabel('Pesos per dollar').fill('39.9');
    await dialog.getByRole('button', { name: 'Save rate' }).click();
    await expect(dialog).toBeHidden();
    // One date left
    await expect(banner).toContainText('that date');

    await api.call('PUT', `/exchange-rates/${isoDay(-90)}`, { rate: 39.5 });
    await page.reload();
    await expect(page.getByRole('main')).toContainText('per US$ 1');
    await expect(banner).toBeHidden();
  });

  test('with no rate stored, dollars are said to be left out, not estimated', async ({
    page,
    api,
  }) => {
    await api.createAccount('Caja pesos', 100_000);
    await api.createAccount('Caja dolares', 25_050, 'savings', { currency: 'USD' });
    await open(page, '/dashboard');

    const banner = page.getByRole('status', { name: 'Estimated exchange rates' });
    await expect(banner).toContainText('No exchange rate stored yet.');
    await expect(banner).toContainText('Totals in pesos leave dollar amounts out');
    await expect(banner).not.toContainText('closest rate');
    // The total counts pesos only, and the line under it says the dollars are missing
    const main = page.getByRole('main');
    await expect(main).toContainText(/Net Worth\s*\$1,000/);
    await expect(main.getByTestId('net-worth-breakdown')).toHaveText(
      '$1,000 + US$250.50 not counted (no exchange rate)',
    );

    await api.call('PUT', `/exchange-rates/${isoDay()}`, { rate: 40 });
    await page.reload();
    await expect(main).toContainText(/Net Worth\s*\$11,020/);
    await expect(main.getByTestId('net-worth-breakdown')).toHaveText('$1,000 + US$250.50');
    await expect(banner).toBeHidden();
  });

  test('a budget in pesos only never shows the banner', async ({ page, api }) => {
    const checking = await api.createAccount('Checking', 0);
    await api.createTransaction({ accountId: checking.id, date: isoDay(-900), amount: -1_500 });
    const answered = page.waitForResponse((r) => r.url().endsWith('/exchange-rates/estimated'));
    await open(page, '/accounts');
    expect(await (await answered).json()).toEqual({ dates: [], notCounted: false });
    await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Estimated exchange rates' })).toBeHidden();
  });

  test('the banner appears when an old dollar transaction is added', async ({ page, api }) => {
    const dollars = await api.createAccount('Dollars', 0, 'checking', { currency: 'USD' });
    await api.call('PUT', `/exchange-rates/${isoDay(-30)}`, { rate: 40.25 });
    await open(page, '/dashboard');
    const banner = page.getByRole('status', { name: 'Estimated exchange rates' });
    await expect(banner).toBeHidden();
    await api.createTransaction({ accountId: dollars.id, date: isoDay(-60), amount: -1_500 });
    await page.reload();
    await expect(banner).toContainText('that date');
  });
});

test('settings link to the license and the source code', async ({ page, api }) => {
  await api.createAccount('Checking');
  await open(page, '/settings');
  await expect(page.getByRole('link', { name: 'GNU AGPL v3' })).toHaveAttribute(
    'href',
    'https://www.gnu.org/licenses/agpl-3.0.html',
  );
  const source = page.getByRole('link', { name: 'Source code' });
  await expect(source).toHaveAttribute('href', 'https://github.com/dtymoszenko/FlyBudget');
  // Opens outside the app (the desktop app hands https links to the system browser)
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', /noopener/);
});
