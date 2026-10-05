import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, otherDayThisMonth, typeAmount, type Api } from './fixtures';

// Entering and editing transactions in an account register, checking both what the
// page shows and what the server stored.

async function setup(api: Api) {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  const savings = await api.createAccount('Rainy Day Savings', 500_000, 'savings');
  return { checking, savings };
}

const header = (page: Page) => page.getByRole('main').locator('div').first();

const newForm = (page: Page) => page.getByRole('form', { name: 'New transaction' });

/** The register row for a payee */
const row = (page: Page, payee: string) =>
  page.getByTestId('transaction-row').filter({ hasText: payee });

async function fillNewTransaction(
  page: Page,
  fields: { payee?: string; category?: string; notes?: string; outflow?: string; inflow?: string },
) {
  await page.getByRole('button', { name: 'Add Transaction' }).click();
  const form = newForm(page);
  if (fields.payee) await form.getByRole('textbox', { name: 'Payee' }).fill(fields.payee);
  if (fields.category) {
    await form.getByRole('combobox', { name: 'Category' }).selectOption({ label: fields.category });
  }
  if (fields.notes) await form.getByRole('textbox', { name: 'Notes' }).fill(fields.notes);
  if (fields.outflow) await form.getByRole('spinbutton', { name: 'Outflow' }).fill(fields.outflow);
  if (fields.inflow) await form.getByRole('spinbutton', { name: 'Inflow' }).fill(fields.inflow);
}

test.describe('account register', () => {
  test('adds an expense with a payee and category', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, {
      payee: 'Corner Grocery',
      category: '🛒 Groceries',
      notes: 'weekly shop',
      outflow: '42.50',
    });
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Corner Grocery', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '🛒 Groceries' })).toBeVisible();
    await expect(header(page)).toContainText('$957.50');
    expect(await api.balance(checking.id)).toBe(95_750);

    const [tx] = await api.transactions(`?account_id=${checking.id}`);
    expect(tx).toMatchObject({ amount: -4_250, payeeName: 'Corner Grocery', notes: 'weekly shop' });
    expect(tx.categoryId).toBe((await api.category('Groceries')).id);
    // A new payee was created for it
    const payees = await api.call<{ name: string }[]>('GET', '/payees');
    expect(payees.map((p) => p.name)).toContain('Corner Grocery');
  });

  test('adds income as an inflow', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, {
      payee: 'Acme Corp',
      category: '💵 Paychecks',
      inflow: '2500',
    });
    await newForm(page).getByRole('button', { name: 'Save' }).click();
    await expect(header(page)).toContainText('$3,500');
    expect(await api.balance(checking.id)).toBe(350_000);
  });

  test('a split transaction counts once toward the balance', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { payee: 'Big Box Store', outflow: '100' });
    const form = newForm(page);
    await form.getByRole('button', { name: 'Split transaction' }).click();
    await form
      .getByRole('combobox', { name: 'Split 1 category' })
      .selectOption({ label: '🛒 Groceries' });
    await form.getByRole('spinbutton', { name: 'Split 1 amount' }).fill('60');
    await expect(form.getByText('$40 remaining')).toBeVisible();
    await form
      .getByRole('combobox', { name: 'Split 2 category' })
      .selectOption({ label: '🏠 Rent / Mortgage' });
    await form.getByRole('spinbutton', { name: 'Split 2 amount' }).fill('40');
    await expect(form.getByText('Balanced')).toBeVisible();
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('button', { name: 'Split (2)' })).toBeVisible();
    // $1,000 − $100, not − $200
    await expect(header(page)).toContainText('$900');
    expect(await api.balance(checking.id)).toBe(90_000);

    const [parent] = await api.transactions(`?account_id=${checking.id}`);
    const parts = parent.children.map((c: { amount: number }) => c.amount);
    expect(parts.sort((a: number, b: number) => a - b)).toEqual([-6_000, -4_000]);
  });

  test('a transfer moves money between two accounts', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await fillNewTransaction(page, { category: 'Transfer: Rainy Day Savings', outflow: '250' });
    await newForm(page).getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Transfer: Rainy Day Savings')).toBeVisible();
    expect(await api.balance(checking.id)).toBe(75_000);
    expect(await api.balance(savings.id)).toBe(525_000);

    // Deleting one side removes it and unlinks the other
    const [out] = await api.transactions(`?account_id=${checking.id}`);
    await api.call('DELETE', `/transactions/${out.id}`);
    const [other] = await api.transactions(`?account_id=${savings.id}`);
    expect(other.transferTransactionId).toBeNull();
  });

  test('edits the category, payee, date and notes from the detail panel', async ({ page, api }) => {
    const { checking } = await setup(api);
    const tx = await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_999,
      payeeName: 'Streamflix',
    });
    await open(page, `/accounts/${checking.id}`);
    // Rows open with the keyboard too
    await row(page, 'Streamflix').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Transaction Details')).toBeVisible();
    const panel = page.getByRole('complementary', { name: 'Transaction details' });

    // Category via the searchable picker
    await panel.getByRole('button', { name: 'Uncategorized' }).click();
    await page.getByPlaceholder('Search categories...').fill('stream');
    await page.getByRole('button', { name: /Streaming Services/ }).click();

    await panel.getByRole('textbox', { name: 'Notes' }).fill('family plan');
    await panel.getByRole('textbox', { name: 'Notes' }).blur();
    await panel.getByRole('textbox', { name: 'Date' }).fill(otherDayThisMonth());
    await panel.getByRole('textbox', { name: 'Date' }).blur();

    await expect
      .poll(async () => (await api.transactions(`?account_id=${checking.id}`))[0])
      .toMatchObject({
        id: tx.id,
        notes: 'family plan',
        date: otherDayThisMonth(),
        categoryId: (await api.category('Streaming Services')).id,
      });
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page.getByText('Transaction Details')).toBeHidden();
  });

  test('deletes a transaction after confirming', async ({ page, api }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Oops Store',
    });
    await open(page, `/accounts/${checking.id}`);
    await row(page, 'Oops Store').click();
    await page.getByRole('button', { name: 'Delete Transaction' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No transactions yet')).toBeVisible();
    expect(await api.balance(checking.id)).toBe(100_000);
  });

  test('searches and filters by date range', async ({ page, api }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1_000,
      payeeName: 'Coffee Corner',
    });
    await api.createTransaction({
      accountId: checking.id,
      date: '2020-06-15',
      amount: -2_000,
      payeeName: 'Old Bookshop',
    });
    await open(page, `/accounts/${checking.id}`);
    // "This Month" by default: the 2020 purchase is hidden
    await expect(page.getByRole('button', { name: 'Coffee Corner', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Old Bookshop', exact: true })).toBeHidden();

    await page.getByRole('button', { name: 'All Time' }).click();
    await expect(page.getByText('2 transactions', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Search payee or notes…').fill('book');
    await expect(page.getByText('1 transaction', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Old Bookshop', exact: true })).toBeVisible();
  });

  test('the all-transactions page lists every account', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -1,
      payeeName: 'A-Mart',
    });
    await api.createTransaction({
      accountId: savings.id,
      date: isoDay(),
      amount: 2,
      payeeName: 'B-Bank',
    });
    await open(page, '/transactions');
    await expect(page.getByRole('button', { name: 'A-Mart', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'B-Bank', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to Rainy Day Savings' })).toBeVisible();
  });
});

test('the Add transaction dialog makes transfers too', async ({ page, api }) => {
  const { checking, savings } = await setup(api);
  await open(page, '/transactions?add=1');
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });

  await dialog.getByRole('button', { name: 'Credit' }).click();
  await typeAmount(dialog.getByLabel('Amount', { exact: true }), '300');
  await dialog.getByRole('button', { name: /Select account/ }).click();
  await dialog.getByRole('button', { name: /Everyday Checking/ }).click();
  await dialog.getByRole('button', { name: /^Category:/ }).click();
  await dialog.getByRole('button', { name: 'Transfer: Rainy Day Savings' }).click();

  // A transfer is named after the other account, so it needs no merchant
  await expect(dialog.getByText('Merchant')).toBeHidden();
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(dialog).toBeHidden();

  // A credit brings the money into the chosen account
  expect(await api.balance(checking.id)).toBe(130_000);
  expect(await api.balance(savings.id)).toBe(470_000);
  const [into] = await api.transactions(`?account_id=${checking.id}`);
  expect(into.transferTransactionId).not.toBeNull();
});

test.describe('transfers between a pesos and a dollars account', () => {
  async function pesosAndDollars(api: Api) {
    const pesos = await api.createAccount('Cuenta pesos', 10_000_000);
    const dollars = await api.createAccount('Caja dolares', 0, 'savings', { currency: 'USD' });
    return { pesos, dollars };
  }

  test('the Add transaction dialog asks for both amounts and shows the rate', async ({
    page,
    api,
  }) => {
    const { pesos, dollars } = await pesosAndDollars(api);
    await open(page, '/transactions?add=1');
    const dialog = page.getByRole('dialog', { name: 'Add transaction' });

    await dialog.getByRole('button', { name: /Select account/ }).click();
    await dialog.getByRole('button', { name: /Cuenta pesos/ }).click();
    // One amount until the transfer goes to an account of another currency
    await expect(dialog.getByLabel('Amount', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: /^Category:/ }).click();
    await dialog.getByRole('button', { name: 'Transfer: Caja dolares' }).click();

    await expect(dialog.getByText('Amount leaving Cuenta pesos ($) *')).toBeVisible();
    await expect(dialog.getByText('Amount arriving in Caja dolares (US$) *')).toBeVisible();
    const add = dialog.getByRole('button', { name: 'Add transaction' });
    await typeAmount(dialog.getByLabel('Amount leaving ($)'), '40000');
    // Both amounts are needed
    await expect(add).toBeDisabled();
    await expect(dialog.getByText(/^Rate:/)).toBeHidden();

    // The rate follows the amount as it's typed
    await dialog.getByLabel('Amount arriving (US$)').click();
    await page.keyboard.type('1000');
    await expect(dialog.getByText('Rate: $ 40.00 per US$ 1')).toBeVisible();
    await add.click();
    await expect(dialog).toBeHidden();

    // Each side keeps its own native amount
    expect(await api.balance(pesos.id)).toBe(6_000_000);
    expect(await api.balance(dollars.id)).toBe(100_000);
    const [out] = await api.transactions(`?account_id=${pesos.id}`);
    const [into] = await api.transactions(`?account_id=${dollars.id}`);
    expect(out).toMatchObject({ amount: -4_000_000, transferTransactionId: into.id });
    expect(into).toMatchObject({ amount: 100_000, transferTransactionId: out.id });
  });

  test('the register form asks for the other amount, and the details show the rate', async ({
    page,
    api,
  }) => {
    const { pesos, dollars } = await pesosAndDollars(api);
    // Selling dollars, entered from the pesos account: an inflow here that left the dollars
    await api.call('POST', '/transactions/transfer', {
      fromAccountId: pesos.id,
      toAccountId: dollars.id,
      date: otherDayThisMonth(),
      amount: 8_000_000,
      toAmount: 200_000,
    });
    await open(page, `/accounts/${pesos.id}`);
    await fillNewTransaction(page, { category: 'Transfer: Caja dolares', inflow: '20250' });
    const form = newForm(page);
    await expect(form.getByText('Inflow ($)')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Save' })).toBeDisabled();
    await form.getByRole('spinbutton', { name: 'Amount leaving (US$)' }).fill('500');
    await expect(form.getByText('Rate: $ 40.50 per US$ 1')).toBeVisible();
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form).toBeHidden();

    expect(await api.balance(pesos.id)).toBe(10_000_000 - 8_000_000 + 2_025_000);
    expect(await api.balance(dollars.id)).toBe(200_000 - 50_000);

    // The dollars side of the sale, with what happened in pesos
    await open(page, `/accounts/${dollars.id}`);
    await expect(row(page, 'Transfer: Cuenta pesos')).toHaveCount(2);
    await row(page, 'Transfer: Cuenta pesos').filter({ hasText: 'US$500' }).focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('complementary', { name: 'Transaction details' });
    await expect(panel).toContainText('$20,250 arrived in Cuenta pesos');
    await expect(panel).toContainText('Rate: $ 40.50 per US$ 1');
  });

  test('editing one side changes its amount only, and its date on both sides', async ({ api }) => {
    const { pesos, dollars } = await pesosAndDollars(api);
    const [out, into] = await api.call<{ id: string }[]>('POST', '/transactions/transfer', {
      fromAccountId: pesos.id,
      toAccountId: dollars.id,
      date: isoDay(),
      amount: 4_000_000,
      toAmount: 100_000,
    });
    await api.call('PUT', `/transactions/${into.id}`, { amount: 99_500, date: isoDay(-1) });
    expect(await api.balance(pesos.id)).toBe(6_000_000);
    expect(await api.balance(dollars.id)).toBe(99_500);
    const [pesosSide] = await api.transactions(`?account_id=${pesos.id}`);
    expect(pesosSide).toMatchObject({ id: out.id, amount: -4_000_000, date: isoDay(-1) });
  });
});

test.describe('linking two imported transactions as a transfer', () => {
  const panel = (page: Page) => page.getByRole('complementary', { name: 'Transaction details' });

  async function openDetails(page: Page, payee: string) {
    await row(page, payee).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
  }

  test('an outflow in pesos is linked to an inflow in dollars, then unlinked', async ({
    page,
    api,
  }) => {
    const pesos = await api.createAccount('Cuenta pesos', 10_000_000);
    const dollars = await api.createAccount('Caja dolares', 0, 'savings', { currency: 'USD' });
    const groceries = await api.category('Groceries');
    const out = await api.createTransaction({
      accountId: pesos.id,
      date: isoDay(),
      amount: -4_000_000,
      payeeName: 'COMPRA MONEDA EXTRANJERA',
      categoryId: groceries.id,
    });
    const into = await api.createTransaction({
      accountId: dollars.id,
      date: isoDay(-1),
      amount: 100_000,
      payeeName: 'CREDITO POR COMPRA USD',
    });
    // Not offered: an outflow, and a transaction in the same account
    await api.createTransaction({
      accountId: dollars.id,
      date: isoDay(),
      amount: -5_000,
      payeeName: 'Cafe en dolares',
    });
    await api.createTransaction({
      accountId: pesos.id,
      date: isoDay(),
      amount: 300_000,
      payeeName: 'Reintegro',
    });

    await open(page, `/accounts/${pesos.id}`);
    await openDetails(page, 'COMPRA MONEDA EXTRANJERA');
    await panel(page).getByRole('button', { name: 'Link as transfer' }).click();

    const dialog = page.getByRole('dialog', { name: 'Link as transfer' });
    const offered = dialog.getByRole('list', { name: 'Transactions to link' });
    await expect(offered.getByRole('button')).toHaveCount(1);
    await offered.getByRole('button', { name: /CREDITO POR COMPRA USD.*US\$1,000/ }).click();
    await expect(dialog).toBeHidden();

    await expect(panel(page)).toContainText('US$1,000 arrived in Caja dolares');
    await expect(panel(page)).toContainText('Rate: $ 40.00 per US$ 1');
    await expect(panel(page).getByRole('button', { name: 'Link as transfer' })).toBeHidden();
    const [pesosSide] = await api.transactions(`?account_id=${pesos.id}&search=COMPRA`);
    expect(pesosSide).toMatchObject({
      id: out.id,
      amount: -4_000_000,
      categoryId: null,
      transferTransactionId: into.id,
    });

    await panel(page).getByRole('button', { name: 'Unlink transfer' }).click();
    await expect(panel(page).getByRole('button', { name: 'Link as transfer' })).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Uncategorized' })).toBeVisible();
    const [dollarsSide] = await api.transactions(`?account_id=${dollars.id}&search=CREDITO`);
    expect(dollarsSide).toMatchObject({ amount: 100_000, transferTransactionId: null });
  });

  test('two pesos transactions of different amounts are refused with a reason', async ({
    page,
    api,
  }) => {
    const checking = await api.createAccount('Everyday Checking', 100_000);
    const savings = await api.createAccount('Rainy Day Savings', 0, 'savings');
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -25_000,
      payeeName: 'TRASPASO A CAJA',
    });
    await api.createTransaction({
      accountId: savings.id,
      date: isoDay(),
      amount: 24_000,
      payeeName: 'TRASPASO DE CUENTA',
    });

    await open(page, `/accounts/${checking.id}`);
    await openDetails(page, 'TRASPASO A CAJA');
    await panel(page).getByRole('button', { name: 'Link as transfer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Link as transfer' });
    await dialog.getByRole('button', { name: /TRASPASO DE CUENTA/ }).click();
    await expect(dialog.getByRole('alert')).toContainText('must be for the same amount');
    expect(await api.balance(savings.id)).toBe(24_000);
  });
});

test.describe('transfer suggestions', () => {
  const suggestions = (page: Page) => page.getByRole('region', { name: 'Possible transfers' });
  const suggestion = (page: Page, payee: string) =>
    suggestions(page).getByTestId('transfer-suggestion').filter({ hasText: payee });

  /** Both sides of two movements, as importing each account's file leaves them */
  async function seed(api: Api) {
    const pesos = await api.createAccount('Cuenta pesos', 10_000_000);
    const savings = await api.createAccount('Caja de ahorro', 0, 'savings');
    const dollars = await api.createAccount('Caja dolares', 0, 'savings', { currency: 'USD' });
    await api.call('PUT', `/exchange-rates/${isoDay(-10)}`, { rate: 40 });
    const add = (accountId: string, amount: number, payeeName: string, daysAgo = 0) =>
      api.createTransaction({ accountId, date: isoDay(-daysAgo), amount, payeeName });
    const out = await add(pesos.id, -250_000, 'TRASPASO A CAJA', 1);
    const into = await add(savings.id, 250_000, 'TRASPASO DE CUENTA');
    const bought = await add(pesos.id, -4_050_000, 'COMPRA MONEDA EXTRANJERA');
    const credited = await add(dollars.id, 100_000, 'CREDITO POR COMPRA USD');
    // Spending that matches nothing
    await add(pesos.id, -99_900, 'Supermercado');
    return { pesos, savings, dollars, out, into, bought, credited };
  }

  test('shows both transactions of each pair, and the rate between currencies', async ({
    page,
    api,
  }) => {
    const { pesos, out } = await seed(api);
    await open(page, `/accounts/${pesos.id}`);

    await expect(suggestions(page)).toContainText('2 possible transfers');
    await suggestions(page).getByRole('button', { name: 'Review' }).click();
    await expect(suggestions(page).getByTestId('transfer-suggestion')).toHaveCount(2);

    const same = suggestion(page, 'TRASPASO A CAJA');
    await expect(same).toContainText('TRASPASO DE CUENTA');
    await expect(same).toContainText('Caja de ahorro');
    await expect(same).toContainText('-$2,500');
    await expect(same).toContainText('+$2,500');
    await expect(same).not.toContainText('Rate:');

    const across = suggestion(page, 'COMPRA MONEDA EXTRANJERA');
    await expect(across).toContainText('-$40,500');
    await expect(across).toContainText('+US$1,000');
    await expect(across).toContainText('Rate: $ 40.50 per US$ 1');

    // Looking at them links nothing
    const [stillAlone] = await api.transactions(`?account_id=${pesos.id}&search=TRASPASO`);
    expect(stillAlone).toMatchObject({ id: out.id, transferTransactionId: null });
  });

  test('confirming one links the pair as a transfer', async ({ page, api }) => {
    const { pesos, dollars, bought, credited } = await seed(api);
    await open(page, `/accounts/${pesos.id}`);
    await suggestions(page).getByRole('button', { name: 'Review' }).click();
    await suggestion(page, 'COMPRA MONEDA EXTRANJERA')
      .getByRole('button', { name: /^Link as transfer/ })
      .click();

    await expect(suggestions(page)).toContainText('1 possible transfer');
    await expect(suggestion(page, 'COMPRA MONEDA EXTRANJERA')).toHaveCount(0);
    const [pesosSide] = await api.transactions(`?account_id=${pesos.id}&search=COMPRA`);
    expect(pesosSide).toMatchObject({
      id: bought.id,
      amount: -4_050_000,
      transferTransactionId: credited.id,
    });
    const [dollarsSide] = await api.transactions(`?account_id=${dollars.id}&search=CREDITO`);
    expect(dollarsSide).toMatchObject({ amount: 100_000, transferTransactionId: bought.id });
  });

  test('a dismissed pair is not suggested again', async ({ page, api }) => {
    const { savings, out } = await seed(api);
    // Only the pesos pair has a side in this account
    await open(page, `/accounts/${savings.id}`);
    await expect(suggestions(page)).toContainText('1 possible transfer');
    await suggestions(page).getByRole('button', { name: 'Review' }).click();
    await suggestion(page, 'TRASPASO A CAJA')
      .getByRole('button', { name: /^Not a transfer/ })
      .click();
    await expect(suggestions(page)).toBeHidden();

    await page.reload();
    await expect(row(page, 'TRASPASO DE CUENTA')).toBeVisible();
    await expect(suggestions(page)).toBeHidden();
    const found = await api.call<{ outflow: { id: string } }[]>('GET', '/transfer-suggestions');
    expect(found.map((s) => s.outflow.id)).not.toContain(out.id);
    const [untouched] = await api.transactions(`?account_id=${savings.id}`);
    expect(untouched.transferTransactionId).toBeNull();
  });
});

test('sending a new transaction twice (offline retry) saves it once', async ({ api }) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  const savings = await api.createAccount('Savings', 0, 'savings');
  const post = (path: string, data: object) => api.request.post(`/api${path}`, { data });

  const tx = {
    id: 'offline-tx-00000000001',
    accountId: checking.id,
    date: isoDay(),
    amount: -475,
    payeeName: 'Coffee Cart',
  };
  const first = await post('/transactions', tx);
  expect(first.status()).toBe(201);
  const again = await post('/transactions', { ...tx, amount: -999_999 });
  // The same saved transaction comes back; nothing new is created or changed
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ id: tx.id, amount: -475 });

  const split = {
    id: 'offline-split-000000001',
    accountId: checking.id,
    date: isoDay(),
    amount: -3_000,
    payeeName: 'Market',
    splits: [
      { categoryId: null, amount: -1_000 },
      { categoryId: null, amount: -2_000 },
    ],
  };
  expect((await post('/transactions', split)).status()).toBe(201);
  const splitAgain = await post('/transactions', split);
  expect(splitAgain.status()).toBe(200);
  expect((await splitAgain.json()).children).toHaveLength(2);

  const transfer = {
    id: 'offline-transfer-000001',
    fromAccountId: checking.id,
    toAccountId: savings.id,
    date: isoDay(),
    amount: 10_000,
  };
  expect((await post('/transactions/transfer', transfer)).status()).toBe(201);
  const transferAgain = await post('/transactions/transfer', transfer);
  expect(transferAgain.status()).toBe(200);
  expect(await transferAgain.json()).toHaveLength(2);

  // Ids from a device must look like ids
  expect((await post('/transactions', { ...tx, id: 'short' })).status()).toBe(400);
  expect((await post('/transactions', { ...tx, id: 'has spaces in it, 1234' })).status()).toBe(400);

  const rows = await api.call<{ id: string }[]>('GET', '/transactions');
  expect(rows.filter((r) => r.id === tx.id)).toHaveLength(1);
  // Balances count each one once: 1,000.00 − 4.75 − 30.00 − 100.00
  const accounts = await api.accounts();
  expect(accounts.find((a) => a.id === checking.id)!.balance).toBe(100_000 - 475 - 3_000 - 10_000);
  expect(accounts.find((a) => a.id === savings.id)!.balance).toBe(10_000);
});
