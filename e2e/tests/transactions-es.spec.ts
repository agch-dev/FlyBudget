import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, type Api } from './fixtures';
import { xlsx } from './xlsx';

// The register, transfers and the import dialog with the App Language set to Spanish. What
// they do is covered in English by transactions.spec.ts and data.spec.ts; these check that
// the same things can be done reading Spanish, and that no English is left on the way.

test.use({ language: 'es' });

async function setup(api: Api) {
  const checking = await api.createAccount('Cuenta corriente', 100_000);
  const savings = await api.createAccount('Caja de ahorro', 500_000, 'savings');
  return { checking, savings };
}

const newForm = (page: Page) => page.getByRole('form', { name: 'Transacción nueva' });
const row = (page: Page, payee: string) =>
  page.getByTestId('transaction-row').filter({ hasText: payee });
const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Detalles de la transacción' });

async function openDetails(page: Page, payee: string) {
  await row(page, payee).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
}

/**
 * English the register and its dialogs used to show. None of it may be left in Spanish
 * (the account's header above the register belongs to another part of the app).
 */
const ENGLISH =
  /\b(transactions?|Uncategorized|Payee|Category|Notes|Outflow|Inflow|Split|Transfer|This Month|All Time|Loading|Search|Review|Discard|Preview|Import|rows?|Dates|Decimals|Amount|Balanced|remaining|Rate:|exchange rate)\b/;

/** An element's text without the options of its selects (category names are stored data) */
const ownText = (locator: import('@playwright/test').Locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('option, optgroup').forEach((o) => o.remove());
    return copy.textContent ?? '';
  });

test.describe('el registro de una cuenta', () => {
  test('agrega, divide, edita y elimina transacciones', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await expect(page.getByText('Todavía no hay transacciones')).toBeVisible();

    // A split transaction
    await page.getByRole('button', { name: 'Agregar transacción' }).click();
    const form = newForm(page);
    await form.getByRole('textbox', { name: 'Beneficiario' }).fill('Supermercado');
    await form.getByRole('spinbutton', { name: 'Salida' }).fill('100');
    await form.getByRole('button', { name: 'Dividir transacción' }).click();
    await form
      .getByRole('combobox', { name: 'Categoría de la parte 1' })
      .selectOption({ label: '🛒 Supermercado' });
    await form.getByRole('spinbutton', { name: 'Monto de la parte 1' }).fill('60');
    await expect(form.getByText('Restan $40')).toBeVisible();
    await form.getByRole('spinbutton', { name: 'Monto de la parte 2' }).fill('40');
    await expect(form.getByText('Completo')).toBeVisible();
    expect(await ownText(form)).not.toMatch(ENGLISH);
    await form.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('button', { name: 'Dividida (2)' })).toBeVisible();
    await expect(page.getByText('1 transacción', { exact: true })).toBeVisible();
    expect(await api.balance(checking.id)).toBe(90_000);

    // An ordinary one, then edited in the details panel
    await page.getByRole('button', { name: 'Agregar transacción' }).click();
    await newForm(page).getByRole('textbox', { name: 'Beneficiario' }).fill('Panadería');
    await newForm(page).getByRole('textbox', { name: 'Notas' }).fill('bizcochos');
    await newForm(page).getByRole('spinbutton', { name: 'Salida' }).fill('12.50');
    await newForm(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('2 transacciones', { exact: true })).toBeVisible();

    await openDetails(page, 'Panadería');
    await expect(panel(page)).not.toContainText(ENGLISH);
    await panel(page).getByRole('button', { name: 'Sin categoría' }).click();
    await page.getByPlaceholder('Buscar categorías...').fill('rest');
    await page.getByRole('button', { name: /Restaurantes/ }).click();
    await expect(row(page, 'Panadería')).toContainText('Restaurantes');
    await panel(page).getByRole('textbox', { name: 'Notas' }).fill('bizcochos y pan');
    await panel(page).getByRole('textbox', { name: 'Notas' }).blur();
    await expect
      .poll(async () => (await api.transactions(`?account_id=${checking.id}&search=Pan`))[0].notes)
      .toBe('bizcochos y pan');

    // The whole register, filters included, is in Spanish
    for (const name of ['Este mes', 'Últimos 3 meses', 'Este año', 'Todo']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('main')).not.toContainText(ENGLISH);

    await panel(page).getByRole('button', { name: 'Eliminar transacción' }).click();
    const confirm = page.getByRole('dialog', { name: 'Eliminar transacción' });
    await expect(confirm).toContainText('¿Seguro que querés eliminar esta transacción?');
    await confirm.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('1 transacción', { exact: true })).toBeVisible();
    expect(await api.balance(checking.id)).toBe(90_000);
  });

  test('una búsqueda sin resultados lo dice en español', async ({ page, api }) => {
    const { checking } = await setup(api);
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(),
      amount: -500,
      payeeName: 'Kiosco',
    });
    await open(page, `/accounts/${checking.id}`);
    await page.getByPlaceholder('Buscar beneficiario o notas…').fill('nada');
    await expect(page.getByText('No se encontraron transacciones')).toBeVisible();
    await expect(page.getByText('Nada coincide con tu búsqueda y tus filtros.')).toBeVisible();
    await expect(page.getByText('0 transacciones', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(row(page, 'Kiosco')).toBeVisible();
  });

  test('todas las transacciones: agrega una desde el diálogo', async ({ page, api }) => {
    await setup(api);
    await open(page, '/transactions');
    await expect(page.getByRole('heading', { name: 'Todas las transacciones' })).toBeVisible();
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar transacción' });
    await expect(dialog).not.toContainText(ENGLISH);
    for (const label of ['Débito', 'Crédito', 'Monto *', 'Comercio *', 'Fecha *', 'Cuenta *']) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await dialog.getByText('Elegir cuenta...').click();
    await expect(dialog.getByText('En el presupuesto', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: /Cuenta corriente/ }).click();
    await dialog.getByRole('button', { name: /Categoría: Buscar categorías/ }).click();
    await expect(dialog.getByText('Transferencia: Caja de ahorro')).toBeVisible();
  });
});

test.describe('transferencias', () => {
  test('una transferencia mueve dinero entre dos cuentas', async ({ page, api }) => {
    const { checking, savings } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    await page.getByRole('button', { name: 'Agregar transacción' }).click();
    await newForm(page)
      .getByRole('combobox', { name: 'Categoría' })
      .selectOption({ label: 'Transferencia: Caja de ahorro' });
    await newForm(page).getByRole('spinbutton', { name: 'Salida' }).fill('250');
    await newForm(page).getByRole('button', { name: 'Guardar' }).click();

    await expect(row(page, 'Caja de ahorro')).toContainText('Transferencia');
    expect(await api.balance(checking.id)).toBe(75_000);
    expect(await api.balance(savings.id)).toBe(525_000);

    await openDetails(page, 'Caja de ahorro');
    await expect(panel(page)).toContainText('A Caja de ahorro');
    await panel(page).getByRole('button', { name: 'Desvincular transferencia' }).click();
    await expect(panel(page).getByRole('button', { name: 'Sin categoría' })).toBeVisible();
  });

  test('vincula dos transacciones, y explica en español por qué no se puede', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    const add = (accountId: string, amount: number, payeeName: string) =>
      api.createTransaction({ accountId, date: isoDay(), amount, payeeName });
    await add(checking.id, -25_000, 'TRASPASO A CAJA');
    await add(savings.id, 24_000, 'DEPOSITO');
    await add(savings.id, 25_000, 'TRASPASO DE CUENTA');

    await open(page, `/accounts/${checking.id}`);
    await openDetails(page, 'TRASPASO A CAJA');
    await panel(page).getByRole('button', { name: 'Vincular como transferencia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Vincular como transferencia' });
    await expect(dialog).toContainText('$250 salieron de Cuenta corriente el');
    await expect(dialog).toContainText('Elegí la transacción donde llegó este dinero.');
    await expect(dialog).not.toContainText(ENGLISH);

    // The server's refusal carries a code; the app says it in Spanish
    await dialog.getByRole('button', { name: /DEPOSITO/ }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'Estas cuentas tienen la misma moneda, así que las dos transacciones tienen que ser por el mismo monto',
    );

    await dialog.getByRole('button', { name: /TRASPASO DE CUENTA/ }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, 'TRASPASO A CAJA')).toContainText('Transferencia');
  });

  test('una transacción conciliada no se puede cambiar, y lo dice en español', async ({
    page,
    api,
  }) => {
    const { checking, savings } = await setup(api);
    const add = (accountId: string, amount: number, payeeName: string) =>
      api.createTransaction({ accountId, date: isoDay(), amount, payeeName }) as Promise<{
        id: string;
      }>;
    await add(checking.id, -25_000, 'TRASPASO A CAJA');
    const reconciled = await add(savings.id, 25_000, 'TRASPASO DE CUENTA');
    const gone = await add(savings.id, 25_000, 'OTRO DEPOSITO');

    await open(page, `/accounts/${checking.id}`);
    await openDetails(page, 'TRASPASO A CAJA');
    await panel(page).getByRole('button', { name: 'Vincular como transferencia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Vincular como transferencia' });
    await expect(dialog.getByRole('button', { name: /TRASPASO DE CUENTA/ })).toBeVisible();

    // Meanwhile, on another device: one is reconciled and the other deleted
    await api.call('PUT', `/accounts/${savings.id}/reconcile`, { transactionIds: [reconciled.id] });
    await api.call('DELETE', `/transactions/${gone.id}`);

    // A refusal with a code reads as its Spanish sentence
    await dialog.getByRole('button', { name: /TRASPASO DE CUENTA/ }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'No se puede modificar una transacción conciliada',
    );
    await expect(dialog).not.toContainText('Cannot modify a reconciled transaction');

    // One without a code reads as the generic sentence, never as the server's English
    await dialog.getByRole('button', { name: /OTRO DEPOSITO/ }).click();
    await expect(dialog.getByRole('alert')).toHaveText('No se pudo completar la acción');
    await expect(dialog).not.toContainText('Not found');
  });

  test('las sugerencias de transferencia se revisan y se confirman', async ({ page, api }) => {
    const pesos = await api.createAccount('Cuenta pesos', 10_000_000);
    const dollars = await api.createAccount('Caja dólares', 0, 'savings', { currency: 'USD' });
    const savings = await api.createAccount('Caja de ahorro', 0, 'savings');
    await api.call('PUT', `/exchange-rates/${isoDay(-10)}`, { rate: 40 });
    const add = (accountId: string, amount: number, payeeName: string) =>
      api.createTransaction({ accountId, date: isoDay(), amount, payeeName });
    await add(pesos.id, -4_050_000, 'COMPRA MONEDA EXTRANJERA');
    const credited = await add(dollars.id, 100_000, 'CREDITO POR COMPRA USD');
    await add(pesos.id, -250_000, 'TRASPASO A CAJA');
    await add(savings.id, 250_000, 'TRASPASO DE CUENTA');

    await open(page, `/accounts/${pesos.id}`);
    const suggestions = page.getByRole('region', { name: 'Posibles transferencias' });
    await expect(suggestions).toContainText('2 posibles transferencias');
    await suggestions.getByRole('button', { name: 'Revisar' }).click();
    const across = suggestions
      .getByTestId('transfer-suggestion')
      .filter({ hasText: 'COMPRA MONEDA EXTRANJERA' });
    await expect(across).toContainText('Tipo de cambio: $ 40.50 por US$ 1');
    await expect(suggestions).not.toContainText(ENGLISH);

    await suggestions
      .getByRole('button', { name: /^No es una transferencia: TRASPASO A CAJA y/ })
      .click();
    await expect(suggestions).toContainText('1 posible transferencia');
    await across.getByRole('button', { name: /^Vincular como transferencia/ }).click();
    await expect(suggestions).toBeHidden();
    const [pesosSide] = await api.transactions(`?account_id=${pesos.id}&search=COMPRA`);
    expect(pesosSide.transferTransactionId).toBe((credited as { id: string }).id);

    // A dollar amount in a pesos total says what it counts as, on hover and in the details
    await open(page, '/transactions');
    const credit = row(page, 'CREDITO POR COMPRA USD');
    await expect(credit.getByText('US$1,000')).toHaveAttribute(
      'title',
      /^\$40,000 al tipo de cambio del \d{1,2} [a-z]{3} \d{4}$/,
    );
  });
});

test.describe('importar', () => {
  const BANK_CSV =
    'Fecha,Concepto,Importe\r\n' +
    '15/01/2025,Café de la esquina,"-4,50"\r\n' +
    '16/01/2025,Sueldo,"2.500,00"\r\n' +
    '17/01/2025,Ferretería,"-89,99"\r\n';

  async function importFile(page: Page, name: string, buffer: Buffer) {
    await page.getByRole('button', { name: 'Importar CSV' }).click();
    const dialog = page.getByRole('dialog', { name: 'Importar transacciones' });
    await expect(dialog).toContainText('Arrastrá y soltá un archivo CSV o de Excel');
    await dialog
      .getByLabel('Archivo CSV o de Excel')
      .setInputFiles({ name, mimeType: 'text/csv', buffer });
    return dialog;
  }

  test('importa un archivo CSV', async ({ page, api }) => {
    const { checking } = await setup(api);
    await open(page, `/accounts/${checking.id}`);
    const dialog = await importFile(page, 'movimientos.csv', Buffer.from(BANK_CSV, 'utf8'));

    await expect(dialog).toContainText('Asigná cada columna a un campo. Se encontraron 3 filas.');
    // The file's own headers are recognized whatever the App Language
    await expect(dialog.getByRole('combobox', { name: 'Columna Fecha' })).toHaveValue('date');
    await expect(dialog.getByRole('combobox', { name: 'Columna Concepto' })).toHaveValue('payee');
    await expect(dialog.getByRole('combobox', { name: 'Columna Importe' })).toHaveValue('amount');
    await expect(dialog.getByRole('combobox', { name: 'Fechas' })).toHaveValue('day-first');
    await expect(dialog.getByRole('combobox', { name: 'Decimales' })).toHaveValue('comma');
    await expect(dialog).toContainText('La primera fila se lee como 2025-01-15, -$4.50.');
    await expect(dialog).not.toContainText(ENGLISH);

    // Read month first, 15/01 and the others are no dates: the dialog says which rows
    await dialog.getByRole('combobox', { name: 'Fechas' }).selectOption('month-first');
    await expect(dialog.getByRole('alert')).toContainText(
      '3 filas no se pueden leer y no se van a importar. Revisá las opciones de Fechas y Decimales.',
    );
    await expect(dialog.getByRole('alert')).toContainText(
      'Fila 1: No se puede leer la fecha "15/01/2025"',
    );
    await dialog.getByRole('combobox', { name: 'Fechas' }).selectOption('day-first');

    await dialog.getByRole('button', { name: 'Vista previa' }).click();
    await expect(dialog).toContainText(
      'Se encontraron 3 transacciones. Se detectaron 0 duplicados. Se van a importar 3.',
    );
    await expect(dialog).not.toContainText(ENGLISH);
    await dialog.getByRole('checkbox', { name: 'Importar Ferretería del 2025-01-17' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Importar Sueldo del 2025-01-16' }).uncheck();
    await dialog.getByRole('button', { name: 'Importar 1 transacción' }).click();
    await expect(dialog).toContainText('Importación completa');
    await expect(dialog).toContainText('1 importada, 0 omitidas');
    await dialog.getByRole('button', { name: 'Listo' }).click();
    expect(await api.balance(checking.id)).toBe(100_000 - 450);
  });

  test('importa un archivo de Excel, y explica uno que no se puede leer', async ({ page, api }) => {
    const { savings } = await setup(api);
    await open(page, `/accounts/${savings.id}`);
    // A zip that isn't a workbook
    const broken = xlsx([['Fecha']]).subarray(0, 40);
    let dialog = await importFile(page, 'roto.xlsx', Buffer.from(broken));
    await expect(dialog).toContainText('Este archivo de Excel está dañado y no se puede leer.');
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

    dialog = await importFile(
      page,
      'Estado_De_Cuenta.xlsx',
      xlsx([
        ['Fecha', 'Concepto', 'Débito', 'Crédito', 'Saldo'],
        ['13/05/2026', 'COMPRA FARMASHOP', 610, '', 25627.1],
        ['17/05/2026', 'REDIVA FARMASHOP', '', 45.3, 25672.4],
      ]),
    );
    await expect(dialog.getByRole('combobox', { name: 'Columna Débito' })).toHaveValue('outflow');
    await dialog.getByRole('button', { name: 'Vista previa' }).click();
    await dialog.getByRole('button', { name: 'Importar 2 transacciones' }).click();
    await expect(dialog).toContainText('2 importadas, 0 omitidas');
    expect(await api.balance(savings.id)).toBe(500_000 - 61_000 + 4_530);
  });
});
