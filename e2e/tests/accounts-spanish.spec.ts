import { test, expect, open, isoDay, typeAmount } from './fixtures';
import { createEditAndCloseAnAccount, reconcileAnAccount } from './accountsInSpanish';

// Accounts, the reconciliation flow and "Update value" with the App Language set to Spanish.
// The same steps run at phone width in tests/phone/accounts-spanish.spec.ts.

test.use({ language: 'es' });

test('creating, editing and closing an account work in Spanish', async ({ page, api }) => {
  await createEditAndCloseAnAccount(page, api);
});

test('reconciling an account works in Spanish', async ({ page, api }) => {
  await reconcileAnAccount(page, api);
});

test('a statement that differs is settled with an adjustment, noted in Spanish', async ({
  page,
  api,
}) => {
  const sueldo = await api.createAccount('Itaú Sueldo', 100_000);
  await api.createTransaction({
    accountId: sueldo.id,
    date: isoDay(),
    amount: -5_000,
    payeeName: 'Almacén',
  });
  await open(page, `/accounts/${sueldo.id}/reconcile`);
  const main = page.getByRole('main');
  await typeAmount(main.getByRole('textbox', { name: 'Saldo del estado de cuenta' }), '940');
  await main.getByRole('button', { name: 'Empezar a conciliar' }).click();
  await main.getByRole('row', { name: /Almacén/ }).click();
  await main.getByRole('button', { name: 'Crear ajuste' }).click();

  await expect(page).toHaveURL(new RegExp(`#/accounts/${sueldo.id}$`));
  await expect.poll(() => api.balance(sueldo.id)).toBe(94_000);
  const adjustment = (await api.transactions(`?account_id=${sueldo.id}`)).find(
    (t) => t.amount === -1_000,
  );
  expect(adjustment).toMatchObject({ notes: 'Ajuste de conciliación', isAdjustment: 1 });
});

test('updating the value of a property works in Spanish', async ({ page, api }) => {
  await api.createAccount('Itaú Sueldo', 0);
  const casa = await api.createAccount('Casa', 10_000_000, 'real_estate');
  await open(page, `/accounts/${casa.id}`);
  const main = page.getByRole('main');
  // A property is tracked by value: nothing to reconcile
  await expect(main.getByRole('button', { name: 'Conciliar' })).toBeHidden();
  await main.getByRole('button', { name: 'Actualizar valor' }).click();
  const dialog = page.getByRole('dialog', { name: 'Actualizar valor' });
  await expect(dialog.getByText('Actualmente $100,000.')).toBeVisible();
  await typeAmount(dialog.getByRole('textbox', { name: 'Valor hoy' }), '105000');
  await expect(
    dialog.getByText('Actualmente $100,000. Agrega un ajuste de +$5,000 con fecha de hoy.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect.poll(() => api.balance(casa.id)).toBe(10_500_000);
  const [adjustment] = await api.transactions(`?account_id=${casa.id}`);
  expect(adjustment).toMatchObject({ amount: 500_000, notes: 'Actualización de valor' });
});

test('the sidebar and the page name an account type the same way', async ({ page, api }) => {
  await api.createAccount('Itaú Sueldo', 100_000);
  await api.createAccount('Préstamo del auto', -500_000, 'auto_loan');
  await open(page, '/accounts');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: /^Préstamos/ })).toBeVisible();
  await expect(main.getByText('Préstamo automotor', { exact: true })).toBeVisible();
  // The assets and liabilities summary uses the names of the groups of account types
  await expect(main.getByText('Préstamos', { exact: true })).toHaveCount(2);
  await expect(main.getByText('Efectivo y bancos', { exact: true })).toHaveCount(2);
});
