import { test, expect, open, isoDay, type Api } from './fixtures';

// Account Groups: accounts of one real-world product (the pesos and dollars sides of a card)
// shown together. A group is one row in the sidebar and one card on the Accounts page.

/** A card with a pesos and a dollars side, plus an account with no group. US$1 = $40 today. */
async function seedCard(api: Api) {
  await api.call('PUT', `/exchange-rates/${isoDay()}`, { rate: 40 });
  const pesos = await api.createAccount('Visa pesos', 150_000, 'checking', {
    groupName: 'Visa Itaú',
  });
  const dollars = await api.createAccount('Visa dolares', 10_000, 'checking', {
    currency: 'USD',
    groupName: 'Visa Itaú',
  });
  const cash = await api.createAccount('Efectivo', 20_000, 'cash');
  return { pesos, dollars, cash };
}

test.describe('account groups', () => {
  test('the sidebar shows a group as one row that opens to its accounts', async ({ page, api }) => {
    await seedCard(api);
    await open(page, '/dashboard');
    const nav = page.getByRole('complementary');
    await nav.getByRole('button', { name: /^For budget/ }).click();

    // $1,500 + US$100 at 40 = $5,500
    const group = nav.getByRole('button', { name: 'Visa Itaú $5,500' });
    await expect(group).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: /Visa pesos/ })).toHaveCount(0);
    // An account with no group stays a plain row
    await expect(nav.getByRole('link', { name: 'Efectivo $200' })).toBeVisible();

    // Keyboard: the row is a button
    await group.focus();
    await page.keyboard.press('Enter');
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link', { name: 'Visa pesos $1,500' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Visa dolares US$100' })).toBeVisible();

    // The group goes nowhere; its accounts do
    await expect(page).toHaveURL(/#\/dashboard$/);
    await nav.getByRole('link', { name: 'Visa dolares US$100' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Visa dolares' })).toBeVisible();
  });

  test('an open group is still open after a reload', async ({ page, api }) => {
    await seedCard(api);
    await open(page, '/dashboard');
    const nav = page.getByRole('complementary');
    await nav.getByRole('button', { name: /^For budget/ }).click();
    await nav.getByRole('button', { name: /^Visa Itaú/ }).click();
    await expect(nav.getByRole('link', { name: /Visa pesos/ })).toBeVisible();

    await page.reload();
    await nav.getByRole('button', { name: /^For budget/ }).click();
    await expect(nav.getByRole('button', { name: /^Visa Itaú/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(nav.getByRole('link', { name: /Visa pesos/ })).toBeVisible();
  });

  test('a group with accounts on and off budget appears in both sections', async ({
    page,
    api,
  }) => {
    await api.createAccount('Itaú caja', 100_000, 'checking', { groupName: 'Itaú' });
    await api.createAccount('Itaú fondo', 300_000, 'investment', { groupName: 'Itaú' });
    await open(page, '/dashboard');
    const nav = page.getByRole('complementary');
    await nav.getByRole('button', { name: /^For budget/ }).click();
    await nav.getByRole('button', { name: /^Off budget/ }).click();

    await expect(nav.getByRole('button', { name: 'Itaú $1,000' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Itaú $3,000' })).toBeVisible();
  });

  test('the Accounts page shows a group as a card with its accounts inside', async ({
    page,
    api,
  }) => {
    await seedCard(api);
    await open(page, '/accounts');
    const card = page.getByRole('region', { name: 'Visa Itaú group' });
    await expect(card.getByRole('heading', { name: 'Visa Itaú' })).toBeVisible();
    await expect(card).toContainText('$5,500');
    await expect(card).toContainText('Visa pesos');
    await expect(card).toContainText('US$100');
    await expect(card).not.toContainText('Efectivo');

    await card.getByText('Visa dolares').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Visa dolares' })).toBeVisible();
  });

  test('an account joins a group from its dialogs, and an unused group is gone', async ({
    page,
    api,
  }) => {
    const first = await api.createAccount('Oca pesos', 0, 'checking', { groupName: 'Oca' });
    await open(page, '/accounts');
    const main = page.getByRole('main');

    // Add: the groups in use are offered
    await main.getByRole('button', { name: 'Add Account' }).click();
    const add = page.getByRole('dialog', { name: 'Add Account' });
    await add.getByRole('textbox', { name: 'Account name' }).fill('Oca dolares');
    const groupField = add.getByRole('combobox', { name: /^Group/ });
    await expect(add.locator('datalist option')).toHaveCount(1);
    await expect(add.locator('datalist option')).toHaveAttribute('value', 'Oca');
    await groupField.fill('Oca');
    await add.getByRole('button', { name: 'Add Account' }).click();
    await expect(add).toBeHidden();
    await expect
      .poll(async () => (await api.accounts()).map((a) => a.groupName))
      .toEqual(['Oca', 'Oca']);

    // Edit: type a new name to start another group
    await open(page, `/accounts/${first.id}`);
    await page.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Account' });
    await expect(edit.getByRole('combobox', { name: /^Group/ })).toHaveValue('Oca');
    await edit.getByRole('combobox', { name: /^Group/ }).fill('Oca Blue');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit).toBeHidden();
    await expect
      .poll(async () => (await api.accounts()).find((a) => a.id === first.id)?.groupName)
      .toBe('Oca Blue');

    // Edit: empty leaves the group, and a group nobody uses is no longer listed
    await page.getByRole('button', { name: 'Edit' }).click();
    await edit.getByRole('combobox', { name: /^Group/ }).fill('');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit).toBeHidden();
    await expect
      .poll(async () => (await api.accounts()).find((a) => a.id === first.id)?.groupName)
      .toBeNull();

    await open(page, '/accounts');
    await expect(page.getByRole('region', { name: 'Oca group' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Oca Blue group' })).toHaveCount(0);
    await main.getByRole('button', { name: 'Add Account' }).click();
    await expect(add.locator('datalist option')).toHaveCount(1);
  });
});
