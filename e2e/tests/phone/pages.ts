import type { Page, TestInfo } from '@playwright/test';
import { isoDay, thisMonth, type Api } from '../fixtures';

// What the phone passes share (phone.spec.ts in English, phone-spanish.spec.ts in Spanish):
// realistic data, the pages to visit, and the check that nothing scrolls sideways.

/** Realistic data for every page; returns the routes to visit, each with a screenshot name */
export async function seedEveryPage(api: Api): Promise<[string, string][]> {
  const checking = await api.createAccount('Everyday Checking', 250_000);
  await api.createAccount('Rainy Day Savings', 1_000_000, 'savings');
  const groceries = await api.category('Groceries');
  for (const [i, payee] of ['Corner Grocery', 'Coffee Corner', 'City Power & Light'].entries()) {
    await api.createTransaction({
      accountId: checking.id,
      date: isoDay(-i),
      amount: -(4_250 + i * 1_000),
      payeeName: payee,
      categoryId: i === 0 ? groceries.id : null,
      notes: i === 2 ? 'Monthly electricity bill with a fairly long note' : undefined,
    });
  }
  await api.call('PUT', `/budget/${thisMonth()}/${groceries.id}`, { budgeted: 50_000 });
  await api.call('POST', '/schedules', {
    name: 'Rent',
    amount: -150_000,
    recurrenceType: 'monthly',
    startDate: isoDay(2),
    accountId: checking.id,
  });
  await api.call('POST', '/rules', {
    conditions: [{ field: 'payee_name', op: 'contains', value: 'grocery' }],
    actions: [{ type: 'set_category', value: groceries.id }],
  });
  await api.call('POST', '/goals', { name: 'Vacation', targetAmount: 200_000 });
  await api.call('PUT', `/exchange-rates/${isoDay(-1)}`, { rate: 40.342 });
  await api.call('PUT', `/exchange-rates/${isoDay(-40)}`, { rate: 39.9 });

  return [
    ['dashboard', '/dashboard'],
    ['accounts', '/accounts'],
    ['account', `/accounts/${checking.id}`],
    ['reconcile', `/accounts/${checking.id}/reconcile`],
    ['transactions', '/transactions'],
    ['budget', '/budget'],
    ['budget-category', `/budget/category/${groceries.id}`],
    ['recurring', '/recurring'],
    ['reports', '/reports'],
    ['custom-report', '/reports/custom'],
    ['cash-flow', '/cash-flow'],
    ['goals', '/goals'],
    ['payees', '/payees'],
    ['rules', '/rules'],
    ['settings', '/settings'],
    ['settings-rates', '/settings?tab=rates'],
  ];
}

/** The Settings tabs the English pass leaves out (it visits Categories and Exchange rates) */
export const OTHER_SETTINGS_TABS: [string, string][] = [
  ['settings-accounts', '/settings?tab=accounts'],
  ['settings-connections', '/settings?tab=connections'],
  ['settings-data', '/settings?tab=data'],
  ['settings-preferences', '/settings?tab=preferences'],
  ['settings-server', '/settings?tab=server'],
];

/**
 * What doesn't fit sideways: the document, and every scrolling area of the page (a page
 * that scrolls up and down must not also scroll sideways), plus content that sticks out
 * past the right edge. Strips that scroll only sideways on purpose (tabs, wide tables in
 * an `overflow-x-auto` box) are fine.
 */
export async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    // The page's own scrolling areas (main, and anything else that scrolls up and down)
    const scrollsDown = (el: Element) =>
      /auto|scroll/.test(getComputedStyle(el).overflowY) &&
      (el.tagName === 'MAIN' || el.scrollHeight > el.clientHeight + 2);
    const sidewaysOnly = (el: Element) =>
      /auto|scroll/.test(getComputedStyle(el).overflowX) && !scrollsDown(el);
    const name = (el: Element) =>
      `<${el.tagName.toLowerCase()}> "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
    const problems: string[] = [];
    const extra = document.documentElement.scrollWidth - window.innerWidth;
    if (extra > 0) problems.push(`document +${extra}px`);
    // Only the content area scrolls up and down, never the window itself
    const below = document.documentElement.scrollHeight - window.innerHeight;
    if (below > 0) problems.push(`document scrolls down +${below}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (scrollsDown(el) && el.scrollWidth > el.clientWidth + 1) {
        problems.push(`${name(el)} scrolls sideways +${el.scrollWidth - el.clientWidth}px`);
      }
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= window.innerWidth + 1) continue;
      let parent = el.parentElement;
      while (parent && !sidewaysOnly(parent)) parent = parent.parentElement;
      if (!parent) problems.push(`${name(el)} ends at ${Math.round(box.right)}px`);
    }
    return problems.slice(0, 4);
  });
}

/** Saves `<prefix>-<name>.png` (CI uploads every `phone-*.png` as `phone-screenshots`) */
export async function screenshot(page: Page, testInfo: TestInfo, name: string, prefix = 'phone') {
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-${name}.png`), fullPage: true });
}
