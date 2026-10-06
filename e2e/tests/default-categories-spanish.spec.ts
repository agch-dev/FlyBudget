import type { Page } from '@playwright/test';
import { test, expect, open } from './fixtures';

// Default Categories (GLOSSARY.md): the categories and groups the app supplies read in the
// App Language of the device, and a category the user renamed reads as they typed it.

test.use({ language: 'es' });

const language = (page: Page) =>
  page.getByRole('radiogroup', { name: /^(App language|Idioma de la app)$/ });

async function switchTo(page: Page, name: 'English' | 'Español') {
  await open(page, '/settings?tab=preferences');
  await language(page).getByRole('radio', { name }).click();
  await expect(language(page).getByRole('radio', { name })).toBeChecked();
}

test('a new budget shows its categories in Spanish, wherever they are named', async ({
  page,
  api,
}) => {
  await api.createAccount('Itaú Sueldo', 100_000);
  // The database keeps the English spelling
  expect((await api.category('Groceries')).id).toBe('default-category-groceries');

  await open(page, '/settings');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Editar Supermercado' })).toBeVisible();
  await expect(main).toContainText('Comida y restaurantes');
  await expect(main).toContainText('Facturas y servicios');
  await expect(main).not.toContainText(/Groceries|Food & Dining|Restaurants|Paychecks|Housing/);

  await open(page, '/budget');
  await expect(main).toContainText('Supermercado');
  await expect(main).toContainText('Alquiler / Hipoteca');
  await expect(main).not.toContainText(/Groceries|Rent \/ Mortgage/);

  await open(page, '/reports');
  await expect(page.getByRole('button', { name: 'Vista general' })).toBeVisible();
});

test('a renamed category reads as typed in both languages, and translates again when named back', async ({
  page,
  api,
}) => {
  await api.createAccount('Itaú Sueldo', 100_000);
  await open(page, '/settings');
  const main = page.getByRole('main');

  // Rename it: now the user's own name
  await main.getByRole('button', { name: 'Editar Supermercado' }).click();
  const editar = page.getByRole('dialog', { name: 'Editar categoría' });
  await expect(editar.getByRole('textbox', { name: 'Nombre de la categoría' })).toHaveValue(
    'Supermercado',
  );
  await editar.getByRole('textbox', { name: 'Nombre de la categoría' }).fill('Feria del barrio');
  await editar.getByRole('button', { name: 'Guardar' }).click();
  await expect(main.getByRole('button', { name: 'Editar Feria del barrio' })).toBeVisible();

  // In English it reads as typed, and the defaults around it read in English, with no reload
  await switchTo(page, 'English');
  await open(page, '/settings');
  await expect(main.getByRole('button', { name: 'Edit Feria del barrio' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Edit Restaurants' })).toBeVisible();
  await expect(main).toContainText('Food & Dining');
  await expect(main).not.toContainText(/Restaurantes|Comida y restaurantes/);

  // Named back with a supplied name (the Spanish one, typed on a device in English): a
  // Default Category again
  await main.getByRole('button', { name: 'Edit Feria del barrio' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Category' });
  await edit.getByRole('textbox', { name: 'Category name' }).fill('Supermercado');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(main.getByRole('button', { name: 'Edit Groceries' })).toBeVisible();
  expect((await api.category('Groceries')).id).toBe('default-category-groceries');

  await switchTo(page, 'Español');
  await open(page, '/settings');
  await expect(main.getByRole('button', { name: 'Editar Supermercado' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Editar Restaurantes' })).toBeVisible();
});

test('saving the edit dialog without touching the name keeps the category a default', async ({
  page,
  api,
}) => {
  await api.createAccount('Itaú Sueldo', 100_000);
  await open(page, '/settings');
  await page.getByRole('main').getByRole('button', { name: 'Editar Estacionamiento' }).click();
  const editar = page.getByRole('dialog', { name: 'Editar categoría' });
  await editar.getByRole('button', { name: 'Guardar' }).click();
  await expect(editar).toBeHidden();
  await expect.poll(() => api.category('Parking')).toBeTruthy();
});
