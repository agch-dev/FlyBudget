import { test, expect, open, isoDay } from './fixtures';

// The App Language: English or Spanish, a preference of this device. The other suites run in
// English (the fixtures pin it); these tests switch it, or leave it to the browser's language.

const language = (page: import('@playwright/test').Page) =>
  page.getByRole('radiogroup', { name: /^(App language|Idioma de la app)$/ });

test('switching to Spanish in Settings changes the shell at once and survives a reload', async ({
  page,
  api,
}) => {
  await api.createAccount('Everyday Checking', 123_456);
  await open(page, '/settings?tab=preferences');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(language(page).getByRole('radio', { name: 'English' })).toBeChecked();
  // A reload would lose this
  await page.evaluate(() => ((window as unknown as { sameDocument: boolean }).sameDocument = true));

  await language(page).getByRole('radio', { name: 'Español' }).click();

  const nav = page.getByRole('complementary');
  for (const name of ['Panel', 'Cuentas', 'Transacciones', 'Presupuesto', 'Configuración']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Accounts', exact: true })).toBeHidden();
  // Amounts are written as before
  await expect(nav.getByRole('link', { name: 'Todas las cuentas $1,234.56' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Estado del servidor: En línea/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  expect(
    await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument),
  ).toBe(true);

  await page.reload();
  await expect(nav.getByRole('link', { name: 'Cuentas', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(language(page).getByRole('radio', { name: 'Español' })).toBeChecked();

  await language(page).getByRole('radio', { name: 'English' }).click();
  await expect(nav.getByRole('link', { name: 'Accounts', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('month names follow the language, and a chosen date format is kept', async ({ page, api }) => {
  const checking = await api.createAccount('Everyday Checking', 0);
  await api.createTransaction({
    accountId: checking.id,
    date: `${isoDay().slice(0, 4)}-01-05`,
    amount: -1200,
    payeeName: 'Corner Shop',
  });
  await open(page, '/settings?tab=preferences');
  // An English device writes dates month first until the user chooses
  const format = (name: RegExp) => page.getByRole('button', { name });
  await expect(format(/^MMM d, yyyy Jan 5, 2026$/)).toBeVisible();
  await format(/^yyyy-MM-dd/).click();

  await language(page).getByRole('radio', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Formato de fecha' })).toBeVisible();
  await expect(format(/^d MMM yyyy 5 ene 2026$/)).toBeVisible();
  await expect(format(/^MMM d, yyyy ene 5, 2026$/)).toBeVisible();
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('budget-preferences')!).state);
  expect(await stored()).toMatchObject({ language: 'es', dateFormat: 'yyyy-MM-dd' });

  // Dates on the pages still in English get Spanish month names too
  await open(page, `/accounts/${checking.id}`);
  await page.getByRole('button', { name: 'All Time' }).click();
  await expect(
    page
      .getByRole('main')
      .getByText(/\benero 5, \d{4}/)
      .first(),
  ).toBeVisible();
});

test.describe('a device that has never chosen a language', () => {
  test.use({ language: null });

  test.describe('with a Spanish browser', () => {
    test.use({ locale: 'es-UY' });

    test('opens in Spanish, and writes dates day first', async ({ page, api }) => {
      await api.createAccount('Everyday Checking', 0);
      await open(page, '/settings?tab=preferences');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(
        page.getByRole('complementary').getByRole('link', { name: 'Cuentas', exact: true }),
      ).toBeVisible();
      await expect(language(page).getByRole('radio', { name: 'Español' })).toBeChecked();
      // The selected date format: the one with the border of a chosen option
      await expect(page.getByRole('button', { name: /^d MMM yyyy 5 ene 2026$/ })).toHaveClass(
        /border-brand-500/,
      );
    });

    test('the first-run screen is in Spanish and has the switch', async ({ page }) => {
      await open(page, '/welcome');
      await expect(
        page.getByRole('heading', { name: '¡Te damos la bienvenida a FlyBudget!' }),
      ).toBeVisible();
      for (const name of [
        /Conectar con Plaid/,
        /Conectar con SimpleFIN/,
        /Agregar cuentas a mano/,
      ]) {
        await expect(page.getByRole('button', { name })).toBeVisible();
      }
      await expect(page.getByRole('link', { name: /Leer la guía/ })).toBeVisible();
      // Nothing of the English screen is left
      await expect(page.getByRole('main')).not.toContainText(
        /Welcome|Connect|Add accounts|Skip|Free|Your budget|Compare/,
      );

      await language(page).getByRole('radio', { name: 'English' }).click();
      await expect(page.getByRole('heading', { name: 'Welcome to FlyBudget!' })).toBeVisible();
      await language(page).getByRole('radio', { name: 'Español' }).click();
      await page.getByRole('button', { name: 'Omitir por ahora y recorrer la app' }).click();
      await expect(page).toHaveURL(/#\/dashboard$/);
    });

    test('the reconnect screen is in Spanish and has the switch', async ({ page, api }) => {
      await api.createAccount('Everyday Checking', 150_000);
      await page.route('**/api/**', (route) => route.abort('connectionrefused'));
      await open(page, '/dashboard');

      await expect(
        page.getByRole('heading', { name: 'FlyBudget se está iniciando de nuevo' }),
      ).toBeVisible();
      await expect(page.getByText(/Nuevo intento en \d+ s|Comprobando…/)).toBeVisible();
      await expect(
        page.getByRole('progressbar', { name: 'Tiempo hasta el próximo intento' }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Probar ahora' })).toBeVisible();
      await expect(page.getByText('Tus datos están a salvo en esta computadora.')).toBeVisible();

      await language(page).getByRole('radio', { name: 'English' }).click();
      await expect(
        page.getByRole('heading', { name: 'FlyBudget is starting up again' }),
      ).toBeVisible();

      await page.unroute('**/api/**');
      await expect(page.getByRole('link', { name: 'All accounts $1,500' })).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test.describe('with a browser in any other language', () => {
    test.use({ locale: 'pt-BR' });

    test('opens in English', async ({ page, api }) => {
      await api.createAccount('Everyday Checking', 0);
      await open(page, '/settings?tab=preferences');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(
        page.getByRole('complementary').getByRole('link', { name: 'Accounts', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /^MMM d, yyyy Jan 5, 2026$/ })).toHaveClass(
        /border-brand-500/,
      );
    });
  });
});
