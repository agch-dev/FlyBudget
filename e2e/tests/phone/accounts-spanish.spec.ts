import { test } from '../fixtures';
import { createEditAndCloseAnAccount, reconcileAnAccount } from '../accountsInSpanish';

// The same steps as tests/accounts-spanish.spec.ts, on a phone-sized screen.

test.use({ language: 'es' });

test('creating, editing and closing an account work in Spanish on a phone', async ({
  page,
  api,
}) => {
  await createEditAndCloseAnAccount(page, api);
});

test('reconciling an account works in Spanish on a phone', async ({ page, api }) => {
  await reconcileAnAccount(page, api);
});
