import { test, expect, open, isoDay, thisMonth } from '../fixtures';

// The budget on a phone (390×844) with the App Language set to Spanish: the cards, the sheet
// that plans an amount, and a category's page.

test.use({ language: 'es' });

test('the budget plans an amount and opens a category in Spanish', async ({ page, api }) => {
  const checking = await api.createAccount('Everyday Checking', 100_000);
  const groceries = await api.category('Groceries');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -4_250,
    payeeName: 'Corner Grocery',
    categoryId: groceries.id,
  });
  await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
  await open(page, '/budget');

  const main = page.getByRole('main');
  const card = page.getByTestId('budget-card').filter({ hasText: 'Groceries' });
  await expect(card).toContainText('$457.50 restante');
  await expect(card).toContainText('Planificado');
  await expect(card).toContainText('Gastado');
  await expect(page.getByRole('status', { name: 'Por asignar' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Flexibles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mes anterior' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeVisible();
  const month = new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date());
  await expect(main.getByText(new RegExp(`^${month} \\d{4}$`, 'i'))).toBeVisible();

  // Planning an amount in the sheet
  await card.getByRole('button', { name: 'Planificado para Groceries: $500' }).click();
  const sheet = page.getByRole('dialog', { name: 'Planificar Groceries' });
  await expect(
    sheet.getByRole('checkbox', { name: 'Usar este monto para los próximos 12 meses' }),
  ).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  await sheet.getByRole('spinbutton', { name: 'Planificado para Groceries' }).fill('425');
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toBeHidden();
  await expect(card).toContainText('$382.50 restante');

  // Inactive categories
  const fixed = page.getByRole('region', { name: 'Fijos' });
  await fixed.getByRole('button', { name: /^Mostrar \d+ categorías inactivas$/ }).click();
  await expect(
    fixed.getByRole('button', { name: /^Ocultar \d+ categorías inactivas$/ }),
  ).toBeVisible();
  await expect(main).not.toContainText(
    /Planned|Remaining|remaining|Received|Spent|inactive|Summary|budgeted|to budget|earned|spent|Fixed|Flexible\b/,
  );

  // A category's page
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`#/budget/category/${groceries.id}$`));
  await expect(main).toContainText('Historial de gastos');
  await expect(main).toContainText('Gastos totales');
  await expect(main).toContainText('Última transacción');
});
