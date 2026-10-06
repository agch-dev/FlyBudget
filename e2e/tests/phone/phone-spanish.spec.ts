import type { Page } from '@playwright/test';
import { test, expect, open } from '../fixtures';
import { OTHER_SETTINGS_TABS, screenshot, seedEveryPage, sidewaysOverflow } from './pages';

// Every page of phone.spec.ts again with the App Language set to Spanish: longer words must
// still fit a phone (the same sideways checks), the screenshots are saved as phone-es-*.png,
// and a page fails when it still shows one of the app's English headings, buttons or labels.

test.use({ language: 'es' });

/**
 * Text the app writes in English that must not show in Spanish: page titles, tab names and
 * common buttons. Nothing here may also be stored data the test creates or the default
 * categories (Income, Savings, Uncategorized, Other…), which stay in English.
 */
const ENGLISH = [
  // Page titles and the Settings tabs
  'Dashboard',
  'Accounts',
  'Transactions',
  'Budget',
  'Recurring',
  'Reports',
  'Cash Flow',
  'Goals',
  'Payees',
  'Rules',
  'Settings',
  'Categories',
  'Connected Banks',
  'Preferences',
  'Exchange rates',
  'Server',
  // Buttons and labels
  'Save',
  'Cancel',
  'Delete',
  'Edit',
  'Close',
  'Add account',
  'Add Account',
  'Add Transaction',
  'Add transaction',
  'Add Group',
  'Add Category',
  'Add widget',
  'Edit layout',
  'Open menu',
  'Export CSV',
  'Refresh',
  'Reconcile',
  'Import',
  'Learn more',
  'Search',
  'Today',
  'Previous month',
  'Next month',
  'Download Backup',
  'Restore Backup',
  'Source code',
  'Viewing currency',
  'Date Format',
  'Theme',
];

/** The English words above that the page shows: as text, or as an accessible name, title or placeholder */
async function englishOnPage(page: Page) {
  return page.evaluate((english) => {
    const words = new Set(english);
    const found = new Set<string>();
    const visible = (el: Element) => el.checkVisibility({ visibilityProperty: true });
    const selector =
      'h1, h2, h3, h4, h5, h6, button, a, label, th, legend, [role="tab"], [role="radio"], [role="menuitem"]';
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el)) continue;
      // The element's own words, without an icon's or a badge's
      const text = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim();
      if (text && words.has(text)) found.add(`"${text}" (${el.tagName.toLowerCase()})`);
    }
    for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
      if (!visible(el)) continue;
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        const value = el.getAttribute(attr)?.trim();
        if (value && words.has(value)) found.add(`${attr}="${value}"`);
      }
    }
    return [...found];
  }, ENGLISH);
}

test('every page fits a phone screen in Spanish', async ({ page, api }, testInfo) => {
  test.setTimeout(180_000);
  const routes = [...(await seedEveryPage(api)), ...OTHER_SETTINGS_TABS];

  const overflowing: string[] = [];
  const english: string[] = [];
  for (const [name, route] of routes) {
    await open(page, route);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await screenshot(page, testInfo, name, 'phone-es');
    const overflow = await sidewaysOverflow(page);
    if (overflow.length) overflowing.push(`${route}: ${overflow.join('; ')}`);
    const words = await englishOnPage(page);
    if (words.length) english.push(`${route}: ${words.join(', ')}`);
  }
  expect.soft(overflowing, 'pages that scroll sideways on a phone').toEqual([]);
  expect(english, 'pages that still show English').toEqual([]);
});

test('the welcome screen fits a phone screen in Spanish', async ({ page }, testInfo) => {
  await open(page, '/dashboard');
  await expect(
    page.getByRole('heading', { name: '¡Te damos la bienvenida a FlyBudget!' }),
  ).toBeVisible();
  await screenshot(page, testInfo, 'welcome', 'phone-es');
  expect(await sidewaysOverflow(page)).toEqual([]);
  expect(await englishOnPage(page)).toEqual([]);
});

test.describe('the check for English', () => {
  test.use({ language: 'en' });

  // Without this, a check that never matches anything would pass every Spanish page
  test('finds the English words when the app is in English', async ({ page, api }) => {
    await api.createAccount('Everyday Checking', 100_000);
    await open(page, '/settings?tab=preferences');
    await expect(page.getByRole('main')).toBeVisible();
    expect(await englishOnPage(page)).toEqual(
      expect.arrayContaining([
        '"Settings" (h1)',
        '"Preferences" (button)',
        '"Theme" (h3)',
        'aria-label="Open menu"',
      ]),
    );
  });
});
