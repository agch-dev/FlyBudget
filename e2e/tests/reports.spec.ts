import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, open, isoDay, type Api } from './fixtures';

// Reports: the built-in dashboard, the custom report builder, and saving a report.

async function seed(api: Api) {
  const checking = await api.createAccount('Checking', 100_000);
  const savings = await api.createAccount('Savings', 0, 'savings');
  const groceries = await api.category('Groceries');
  const paychecks = await api.category('Paychecks');
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: 200_000,
    payeeName: 'Employer',
    categoryId: paychecks.id,
  });
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -4_250,
    payeeName: 'Market',
    categoryId: groceries.id,
  });
  // A split: $6 groceries + $4 uncategorized
  await api.createTransaction({
    accountId: checking.id,
    date: isoDay(),
    amount: -1_000,
    payeeName: 'Corner Shop',
    splits: [
      { categoryId: groceries.id, amount: -600 },
      { categoryId: null, amount: -400 },
    ],
  });
  // Moving money between accounts is neither income nor spending
  await api.call('POST', '/transactions/transfer', {
    fromAccountId: checking.id,
    toAccountId: savings.id,
    date: isoDay(),
    amount: 50_000,
  });
}

test.describe('reports', () => {
  test('the overview dashboard summarizes income and spending', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports');
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    const main = page.getByRole('main');
    // A new budget's reports start on this month
    await expect(main.getByRole('button', { name: '1M', pressed: true })).toBeVisible();
    // Every dollar spent, uncategorized included; no transfer, no double-counted split
    await expect(main).toContainText(/\$2,000\s*Total Income/);
    await expect(main).toContainText(/\$52\.50\s*Total Expenses/);
    for (const widget of [
      'Net Worth',
      'Income & Expenses',
      'Spending by Category',
      'Spending Trends',
      'Transaction Calendar',
    ]) {
      await expect(main.getByText(widget, { exact: true })).toBeVisible();
    }
  });

  test('a dollar account counts in every report, in pesos at the rate of each date', async ({
    page,
    api,
  }) => {
    await seed(api);
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

    // US$ 1,000 received and US$ 50 spent at 40 pesos per dollar, on top of the pesos ones
    await open(page, '/reports');
    const main = page.getByRole('main');
    await expect(main).toContainText(/\$42,000\s*Total Income/);
    await expect(main).toContainText(/\$2,052\.50\s*Total Expenses/);

    await open(page, '/reports/custom');
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('category');
    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: 'Groceries $2,048.50' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('account');
    await expect(table.getByRole('row', { name: 'Dollar savings $2,000' })).toBeVisible();
  });

  test('builds, saves and reopens a custom report', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports');
    await page.getByRole('link', { name: 'Custom Report' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Custom Report' })).toBeVisible();

    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('combobox', { name: 'Group by' }).selectOption('category');
    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: 'Groceries $48.50' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Uncategorized $4' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Total $52.50' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Group by' }).selectOption('payee');
    await expect(table.getByRole('row', { name: 'Market $42.50' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Corner Shop $10' })).toBeVisible();

    await page.getByRole('button', { name: 'Save' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save Report' });
    await dialog.getByRole('textbox', { name: 'Report name' }).fill('Spending by payee');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Spending by payee' })).toBeVisible();

    const [saved] = await api.call<any[]>('GET', '/custom-reports');
    expect(saved).toMatchObject({
      name: 'Spending by payee',
      config: { chartType: 'table', groupBy: 'payee', balanceType: 'expense' },
    });

    // It's on the dashboard now, and opens from there
    await open(page, '/reports');
    await expect(page.getByRole('main').getByText('Spending by payee')).toBeVisible();
    await open(page, `/reports/custom/${saved.id}`);
    await expect(page.getByRole('table').getByRole('row', { name: 'Market $42.50' })).toBeVisible();
  });

  test('switching the report to income shows income', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports/custom');
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('button', { name: 'Income', exact: true }).click();
    await expect(
      page.getByRole('table').getByRole('row', { name: 'Paychecks $2,000' }),
    ).toBeVisible();
  });

  test('a new dashboard can be added', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports');
    await page.getByRole('button', { name: 'New dashboard' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('Taxes');
    await dialog.getByRole('button', { name: /Create|Save|Add/ }).click();
    await expect(page.getByRole('button', { name: 'Taxes' })).toBeVisible();
    await expect
      .poll(async () => (await api.call<any[]>('GET', '/dashboards')).map((d) => d.name))
      .toEqual(['Overview', 'Taxes']);
  });
});

/** Clicks an export button and returns the file it saves: its name and its text. */
async function exported(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), 'utf8'),
  };
}

/** Switches the App Language the way Settings does, then reloads. */
async function switchLanguage(page: Page, language: 'en' | 'es') {
  await page.evaluate((language) => {
    const saved = JSON.parse(localStorage.getItem('budget-preferences')!);
    saved.state.language = language;
    localStorage.setItem('budget-preferences', JSON.stringify(saved));
  }, language);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

test.describe('reports in Spanish', () => {
  test.use({ language: 'es' });

  const month = () => new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date());

  test('the dashboard is in Spanish', async ({ page, api }) => {
    await seed(api);
    await open(page, '/dashboard');
    const main = page.getByRole('main');
    for (const heading of [
      'Flujo de fondos',
      'Presupuesto',
      'Próximos pagos',
      'Gastos por categoría',
      'Transacciones recientes',
    ]) {
      await expect(main.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(main.getByText('Patrimonio neto', { exact: true })).toBeVisible();
    await expect(main.getByText('Primeros pasos con FlyBudget')).toBeVisible();
    await expect(main.getByText('Disponible para gastar')).toBeVisible();
    await expect(main.getByRole('combobox', { name: 'Comparar gastos' })).toHaveValue(
      'month_vs_last_month',
    );
    await expect(main.getByText(/Gastos \$52\.50 este mes/)).toBeVisible();
    // The month by its Spanish name
    await expect(
      main.getByRole('link', { name: new RegExp(`^${month()} de \\d{4}$`) }),
    ).toBeVisible();
    for (const english of ['Net Worth', 'Cash Flow', 'Upcoming Bills', 'View all']) {
      await expect(main.getByText(english, { exact: true })).toHaveCount(0);
    }
  });

  test('the report dashboards are in Spanish, stored names as written', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();
    // The dashboard the app creates is named in the App Language
    await expect(page.getByRole('button', { name: 'Vista general' })).toBeVisible();
    await expect(main).toContainText(/\$2,000\s*Ingresos totales/);
    await expect(main).toContainText(/\$52\.50\s*Gastos totales/);
    for (const widget of [
      'Patrimonio neto',
      'Ingresos y gastos',
      'Gastos por categoría',
      'Tendencias de gastos',
      'Calendario de transacciones',
    ]) {
      await expect(main.getByText(widget, { exact: true }).first()).toBeVisible();
    }
    await expect(main.getByText('Este mes', { exact: true }).first()).toBeVisible();
    // The calendar: Spanish month name and weekday letters, still Sunday first
    await expect(main.getByText(new RegExp(`^${month()} de \\d{4}$`))).toBeVisible();
    await expect(main.getByText('D', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Agregar widget' }).click();
    await expect(page.getByText('Entradas y salidas de cada día')).toBeVisible();
    await page.keyboard.press('Escape');

    // A full view: stat cards, table headers and the calendar's day list
    await main.getByText('Calendario de transacciones', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Guardar en el widget' })).toBeVisible();
    await expect(main.getByText('Promedio diario de salidas')).toBeVisible();
    for (const column of ['Fecha', 'Transacciones', 'Entradas', 'Salidas', 'Neto']) {
      await expect(main.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
    await main.getByRole('row').nth(1).click();
    await expect(main.getByRole('columnheader', { name: 'Beneficiario' })).toBeVisible();
  });

  test('the custom report builder is in Spanish', async ({ page, api }) => {
    await seed(api);
    await open(page, '/reports/custom');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reporte personalizado' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Tabla' }).click();
    await page.getByRole('combobox', { name: 'Agrupar por' }).selectOption('category');
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'Monto' })).toBeVisible();
    // What has no category is named by the app, and so is a default category
    await expect(table.getByRole('row', { name: 'Sin categoría $4' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Supermercado $48.50' })).toBeVisible();

    await page.getByRole('button', { name: 'Guardar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Guardar reporte' });
    await dialog.getByRole('textbox', { name: 'Nombre del reporte' }).fill('Por categoría');
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Por categoría' })).toBeVisible();
  });
});

test('exported CSV files follow the App Language', async ({ page, api }) => {
  await seed(api);
  const files: Record<string, string[]> = { en: [], es: [] };
  const names: Record<string, string[]> = { en: [], es: [] };
  for (const [language, exportCsv, exportReport] of [
    ['en', 'Export CSV', 'Export'],
    ['es', 'Exportar CSV', 'Exportar'],
  ] as const) {
    await open(page, '/reports');
    await switchLanguage(page, language);
    const widgets: any[] = await api.call(
      'GET',
      `/dashboards/${(await api.call<any[]>('GET', '/dashboards'))[0].id}/widgets`,
    );
    // Spending by category has an uncategorized row, which the app names
    for (const type of ['summary', 'spending', 'spending-trends', 'calendar']) {
      await open(page, `/reports/widget/${widgets.find((w) => w.type === type).id}`);
      const file = await exported(page, exportCsv);
      files[language].push(file.text);
      names[language].push(file.name);
    }
    await open(page, '/reports/custom');
    await expect(page.getByRole('button', { name: exportReport, exact: true })).toBeEnabled();
    const file = await exported(page, exportReport);
    files[language].push(file.text);
    names[language].push(file.name);
  }
  const headers = (language: string) => files[language].map((text) => text.split('\n')[0]);
  expect(headers('en')).toEqual([
    'month,income_cents,expenses_cents,net_cents,transactions,currency',
    'category,group,spent_cents,monthly_average_cents,currency',
    'month,category,spent_cents,currency',
    'date,transactions,money_in_cents,money_out_cents,net_cents,currency',
    'name,amount_cents,currency',
  ]);
  expect(headers('es')).toEqual([
    'mes,ingresos_centavos,gastos_centavos,neto_centavos,transacciones,moneda',
    'categoría,grupo,gastado_centavos,promedio_mensual_centavos,moneda',
    'mes,categoría,gastado_centavos,moneda',
    'fecha,transacciones,entradas_centavos,salidas_centavos,neto_centavos,moneda',
    'nombre,monto_centavos,moneda',
  ]);
  // Spending by category has an uncategorized row, which the app names
  expect(files.en[1]).toContain('Uncategorized,');
  expect(files.es[1]).toContain('Sin categoría,');
  expect(names.en[0]).toMatch(/^report-summary-\d{4}-\d{2}-to-\d{4}-\d{2}\.csv$/);
  expect(names.es[0]).toMatch(/^reporte-resumen-\d{4}-\d{2}-a-\d{4}-\d{2}\.csv$/);
  expect(names.es[4]).toMatch(/^reporte-personalizado-.*\.csv$/);
  // Under the header, only the names the app supplies differ: months, dates and amounts don't
  const body = (text: string) => text.split('\n').slice(1).join('\n');
  expect(body(files.es[0])).toBe(body(files.en[0]));
  expect(body(files.es[3])).toBe(body(files.en[3]));
});
