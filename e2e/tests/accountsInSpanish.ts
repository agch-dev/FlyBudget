import type { Page } from '@playwright/test';
import { expect, open, isoDay, typeAmount, type Api } from './fixtures';

// Accounts with the App Language set to Spanish, shared by the desktop suite and the phone
// one (accounts-spanish.spec.ts in each): the same steps must work at both widths.

/** The English these pages had: none of it may be left (account names are Spanish here) */
const ENGLISH =
  /\b(Add Account|Add account|Assets|Liabilities|past month|Checking|Credit|Cash|Group|Edit|Reconcile|Statement|Balance|Currency|Off budget|Save|Cancel|Close|Loading|Payee|Amount|Date|Difference|Finish)\b/;

/** Adds a card, edits it, reads why its currency is locked and closes it */
export async function createEditAndCloseAnAccount(page: Page, api: Api) {
  const sueldo = await api.createAccount('Itaú Sueldo', 100_000);
  await api.createTransaction({
    accountId: sueldo.id,
    date: isoDay(),
    amount: -5_000,
    payeeName: 'Almacén',
  });

  await open(page, '/accounts');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeVisible();
  await expect(main.getByText('Activos', { exact: true })).toBeVisible();
  await expect(main.getByText('Pasivos', { exact: true })).toBeVisible();
  await expect(main.getByText('Todavía no hay tarjetas de crédito ni préstamos.')).toBeVisible();
  // The section of the account's type, and the type under its name
  await expect(main.getByRole('button', { name: /^Efectivo y bancos.*último mes/ })).toBeVisible();
  await expect(main.getByText('Cuenta corriente', { exact: true })).toBeVisible();

  await main.getByRole('button', { name: 'Agregar cuenta' }).click();
  const add = page.getByRole('dialog', { name: 'Agregar cuenta' });
  await add.getByRole('textbox', { name: 'Nombre de la cuenta' }).fill('Visa');
  const type = add.getByRole('combobox', { name: 'Tipo de cuenta' });
  await expect(type.locator('optgroup[label="Inversiones"]')).toBeAttached();
  await expect(type.locator('option', { hasText: 'Caja de ahorro' })).toBeAttached();
  await type.selectOption({ label: 'Tarjeta de crédito' });
  await expect(add.getByText('Tarjeta de crédito o de compra')).toBeVisible();
  await add
    .getByRole('radiogroup', { name: 'Moneda' })
    .getByRole('radio', { name: 'Dólares (US$)' })
    .click();
  await typeAmount(add.getByRole('textbox', { name: 'Monto adeudado' }), '250');
  await add.getByRole('combobox', { name: 'Grupo (opcional)' }).fill('Tarjetas');
  await expect(add.getByRole('checkbox', { name: /^Fuera del presupuesto/ })).not.toBeChecked();
  await expect(add).not.toContainText(ENGLISH);
  await add.getByRole('button', { name: 'Agregar cuenta' }).click();

  await expect
    .poll(async () => (await api.accounts()).find((a) => a.name === 'Visa'))
    .toMatchObject({ balance: -25_000, currency: 'USD', groupName: 'Tarjetas' });
  // Its Account Group gets a card
  await expect(main.getByRole('region', { name: 'Grupo Tarjetas' })).toContainText('Grupo');
  await expect(main).not.toContainText(ENGLISH);

  // The account's page: its header and actions
  await main.getByText('Visa', { exact: true }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Visa' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Cuentas', exact: true })).toBeVisible();
  await expect(main.getByText('Crédito', { exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Conciliar' })).toBeVisible();

  await main.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar cuenta' });
  await edit.getByRole('textbox', { name: 'Nombre de la cuenta' }).fill('Visa Oro');
  await expect(edit.getByRole('textbox', { name: 'Saldo inicial' })).toHaveValue('-US$250');
  await expect(edit.getByRole('button', { name: 'Subir imagen' })).toBeVisible();
  await expect(edit).not.toContainText(ENGLISH);
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Visa Oro' })).toBeVisible();

  // An account with transactions says why its currency can't change
  await open(page, `/accounts/${sueldo.id}`);
  await main.getByRole('button', { name: 'Editar' }).click();
  await expect(
    edit.getByText('La moneda no se puede cambiar una vez que la cuenta tiene transacciones.'),
  ).toBeVisible();
  await expect(edit.getByRole('radio', { name: 'Dólares (US$)' })).toBeDisabled();
  await edit.getByRole('button', { name: 'Cancelar' }).click();

  const visa = (await api.accounts()).find((a) => a.name === 'Visa Oro')!;
  await open(page, `/accounts/${visa.id}`);
  await main.getByRole('button', { name: 'Editar' }).click();
  await edit.getByRole('button', { name: 'Cerrar cuenta' }).click();
  const confirm = page.getByRole('dialog', { name: 'Cerrar cuenta' });
  await expect(confirm).toContainText(
    '¿Seguro que querés cerrar "Visa Oro"? Va a quedar oculta en tu lista de cuentas.',
  );
  await confirm.getByRole('button', { name: 'Cerrar cuenta' }).click();
  await expect.poll(async () => (await api.accounts()).map((a) => a.name)).toEqual(['Itaú Sueldo']);
}

/** Reconciles an account against a statement that matches, start to finish */
export async function reconcileAnAccount(page: Page, api: Api) {
  const sueldo = await api.createAccount('Itaú Sueldo', 100_000);
  await api.createTransaction({
    accountId: sueldo.id,
    date: isoDay(),
    amount: -5_000,
    payeeName: 'Almacén',
  });

  await open(page, `/accounts/${sueldo.id}`);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Conciliar' }).click();
  await expect(
    main.getByRole('heading', { level: 1, name: 'Conciliar: Itaú Sueldo' }),
  ).toBeVisible();
  await expect(
    main.getByRole('heading', { name: 'Ingresá el saldo final de tu banco' }),
  ).toBeVisible();
  await expect(main).not.toContainText(ENGLISH);
  await typeAmount(main.getByRole('textbox', { name: 'Saldo del estado de cuenta' }), '950');
  await main.getByRole('button', { name: 'Empezar a conciliar' }).click();

  for (const name of ['Fecha', 'Beneficiario', 'Monto']) {
    await expect(main.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }
  await expect(main.getByText('Saldo seleccionado')).toBeVisible();
  await expect(main.getByText('Diferencia')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Terminar' })).toBeDisabled();
  await expect(main).not.toContainText(ENGLISH);
  await main.getByRole('row', { name: /Almacén/ }).click();
  await expect(main.getByText('¡Todo listo para terminar!')).toBeVisible();
  await main.getByRole('button', { name: 'Terminar' }).click();

  await expect(page).toHaveURL(new RegExp(`#/accounts/${sueldo.id}$`));
  await expect
    .poll(async () => (await api.transactions(`?account_id=${sueldo.id}`)).map((t) => t.reconciled))
    .toEqual([1]);
}
