import { test as base, expect } from '@playwright/test';
import { pinLanguage } from '../language';

// The demo with the App Language set to Spanish: its worker gets the language of each request
// like a real server, so the sample budget's groups and categories read in Spanish. Its
// payees, accounts and notes stay English.

const test = base.extend({
  context: async ({ context }, use) => {
    await pinLanguage(context, 'es', 'sessionStorage');
    await use(context);
  },
});

test('the demo budget names its groups and categories in Spanish', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/demo/#/budget');
  const main = page.getByRole('main');
  await expect(main.getByText('Seguro de inquilino')).toBeVisible();
  await expect(main.getByText('Biscuit (perro)')).toBeVisible();
  await expect(main.getByText('Metas de ahorro')).toBeVisible();
  await expect(main).not.toContainText(/Renters Insurance|Biscuit \(dog\)|Savings Goals|Groceries/);

  await page.evaluate(() => (location.hash = '#/transactions'));
  await expect(main.getByText('Maple Court Apartments').first()).toBeVisible();

  await page.evaluate(() => (location.hash = '#/reports'));
  await expect(page.getByRole('button', { name: 'Vista general' })).toBeVisible();
  // The demo's own dashboard is stored data: it reads as written
  await expect(page.getByRole('button', { name: 'Year in review' })).toBeVisible();

  expect(errors, 'console errors').toEqual([]);
});
