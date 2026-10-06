import { test, expect, open, isoDay } from '../fixtures';

// The register on a phone with the App Language set to Spanish: the cards, the entry sheet,
// the full-screen details and an import, and nothing wider than the screen (Spanish text is
// longer than English).

test.use({ language: 'es' });

/** How far the page, or the dialog on top of it, reaches past the right edge of the screen */
const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const widest = [document.documentElement, ...document.querySelectorAll('[role="dialog"]')]
      .map((el) => el.scrollWidth - el.clientWidth)
      .reduce((a, b) => Math.max(a, b), 0);
    return Math.max(widest, document.documentElement.scrollWidth - window.innerWidth);
  });

test('el registro en un teléfono: tarjetas, hoja de carga y detalles', async ({ page, api }) => {
  const checking = await api.createAccount('Cuenta corriente', 100_000);
  await api.createAccount('Caja de ahorro', 0, 'savings');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -1_999,
    payeeName: 'Streamflix',
    notes: 'plan familiar',
  });
  await open(page, `/accounts/${checking.id}`);

  const card = page.getByTestId('transaction-card').filter({ hasText: 'Streamflix' });
  await expect(card).toContainText('Sin categoría');
  await expect(page.getByText('1 transacción', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBe(0);

  // A split, entered in the sheet
  await page.getByRole('button', { name: 'Agregar transacción' }).click();
  const sheet = page.getByRole('dialog', { name: 'Transacción nueva' });
  const form = sheet.getByRole('form', { name: 'Transacción nueva' });
  await form.getByRole('textbox', { name: 'Beneficiario' }).fill('Supermercado');
  await form.getByRole('spinbutton', { name: 'Salida' }).fill('100');
  await form.getByRole('button', { name: 'Dividir transacción' }).click();
  await form.getByRole('spinbutton', { name: 'Monto de la parte 1' }).fill('60');
  await expect(form.getByText('Restan $40')).toBeVisible();
  await form.getByRole('spinbutton', { name: 'Monto de la parte 2' }).fill('40');
  await expect(form.getByText('Completo')).toBeVisible();
  expect(await overflow(page)).toBe(0);
  for (const name of ['Guardar', 'Dividir transacción', 'Cancelar']) {
    const box = (await form.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(Math.round(box.height), name).toBeGreaterThanOrEqual(44);
  }
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByTestId('transaction-card').filter({ hasText: 'Supermercado' }),
  ).toContainText('Dividida (2)');
  await expect(page.getByText('2 transacciones', { exact: true })).toBeVisible();

  // A transfer, then its details full screen
  await page.getByRole('button', { name: 'Agregar transacción' }).click();
  await form
    .getByRole('combobox', { name: 'Categoría' })
    .selectOption({ label: 'Transferencia: Caja de ahorro' });
  await form.getByRole('spinbutton', { name: 'Salida' }).fill('250');
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(sheet).toBeHidden();
  await page.getByTestId('transaction-card').filter({ hasText: 'Caja de ahorro' }).click();
  const details = page.getByRole('complementary', { name: 'Detalles de la transacción' });
  await expect(details).toContainText('A Caja de ahorro');
  await expect(details.getByRole('button', { name: 'Desvincular transferencia' })).toBeVisible();
  expect(Math.round((await details.boundingBox())!.width)).toBe(page.viewportSize()!.width);
  expect(await overflow(page)).toBe(0);
  await details.getByRole('button', { name: 'Eliminar transacción' }).click();
  await page
    .getByRole('dialog', { name: 'Eliminar transacción' })
    .getByRole('button', { name: 'Eliminar' })
    .click();
  await expect(page.getByText('2 transacciones', { exact: true })).toBeVisible();
  expect(await api.balance(checking.id)).toBe(100_000 - 1_999 - 10_000);
});

test('importa un archivo en un teléfono', async ({ page, api }) => {
  const checking = await api.createAccount('Cuenta corriente', 0);
  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'Importar un archivo CSV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar transacciones' });
  await dialog.getByLabel('Archivo CSV o de Excel').setInputFiles({
    name: 'movimientos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Fecha,Concepto,Importe\r\n15/01/2025,Café,"-4,50"\r\n16/01/2025,Sueldo,"2.500,00"\r\n',
    ),
  });
  await expect(dialog).toContainText('Se encontraron 2 filas.');
  expect(await overflow(page)).toBe(0);
  await dialog.getByRole('button', { name: 'Vista previa' }).click();
  await expect(dialog).toContainText('Se van a importar 2.');
  expect(await overflow(page)).toBe(0);
  await dialog.getByRole('button', { name: 'Importar 2 transacciones' }).click();
  await expect(dialog).toContainText('2 importadas, 0 omitidas');
  await dialog.getByRole('button', { name: 'Listo' }).click();
  expect(await api.balance(checking.id)).toBe(249_550);
});
