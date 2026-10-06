import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// A refusal the user can act on answers `{ error, code, params? }` (utils/refusals.ts): the
// English sentence as always, plus a code the client says in the App Language. Every code on
// the list is sent here by the route that refuses with it; the last test holds the two equal.

// Server mode is read from the environment when modules load, so set it first (sign-in)
process.env.FLYBUDGET_SERVER_MODE = 'true';

// Nothing here reaches a bank: the network calls answer what each test says
const bank = vi.hoisted(() => ({
  safeFetch: (() => Promise.reject(new Error('unset'))) as (...args: unknown[]) => unknown,
  startHostedLink: (): Promise<unknown> => Promise.reject(new Error('unset')),
}));
vi.mock('../services/safeFetch.js', async (original) => ({
  ...(await original<typeof import('../services/safeFetch.js')>()),
  safeFetch: (...args: unknown[]) => bank.safeFetch(...args),
}));
vi.mock('../services/plaidHostedLink.js', async (original) => ({
  ...(await original<typeof import('../services/plaidHostedLink.js')>()),
  startHostedLink: () => bank.startHostedLink(),
}));
vi.mock('../services/plaidService.js', async (original) => ({
  ...(await original<typeof import('../services/plaidService.js')>()),
  removeItem: () => Promise.reject(new Error('Plaid is down')),
}));
vi.mock('../services/simplefinSyncService.js', () => ({
  syncSimplefinConnection: () => Promise.reject(new Error('boom')),
  syncAllSimplefinConnections: () => Promise.reject(new Error('boom')),
}));
vi.mock('../services/plaidSyncService.js', () => ({
  syncPlaidItem: () => Promise.reject(new Error('boom')),
  syncAllItems: () => Promise.reject(new Error('boom')),
}));

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { plaidItems } = await import('../db/schema.js');
const { bankRateLimit, errorHandler, exchangeRateRefreshLimit } =
  await import('../middleware/security.js');
const { UnsafeUrlError } = await import('../services/safeFetch.js');
const { ratesDisabledSource } = await import('../services/exchangeRateSource.js');
const { setupCode } = await import('../auth/setupCode.js');
const { REFUSAL_CODES, REFUSALS } = await import('../utils/refusals.js');
const { accountsRouter } = await import('./accounts.js');
const { authRouter } = await import('./auth.js');
const { categoriesRouter } = await import('./categories.js');
const { dashboardsRouter } = await import('./dashboards.js');
const { createExchangeRatesRouter } = await import('./exchangeRates.js');
const { exportRouter } = await import('./export.js');
const { goalsRouter } = await import('./goals.js');
const { plaidRouter } = await import('./plaid.js');
const { rulesRouter } = await import('./rules.js');
const { schedulesRouter } = await import('./schedules.js');
const { simplefinRouter } = await import('./simplefin.js');
const { transactionsRouter } = await import('./transactions.js');

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use((req, res, next) =>
    req.path === '/api/export/restore' ? next() : express.json({ limit: '10mb' })(req, res, next),
  );
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/dashboards', dashboardsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/transactions', transactionsRouter);
  // The source is a personal API and is never called from tests: this one is "down"
  app.use(
    '/api/exchange-rates',
    createExchangeRatesRouter(() => Promise.reject(new Error('down'))),
  );
  app.use('/api/rates-off', createExchangeRatesRouter(ratesDisabledSource));
  app.post('/api/limited-rates/refresh', exchangeRateRefreshLimit, (_req, res) => res.json({}));
  app.use('/api/plaid', plaidRouter);
  app.use('/api/simplefin', simplefinRouter);
  app.post('/api/limited-bank', bankRateLimit, (_req, res) => res.json({}));
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const seen = new Set<string>();
/** Every status a coded refusal was answered with */
const statuses = new Set<number>();

const send = async (method: string, path: string, body?: unknown, cookie?: string) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const answer = { status: res.status, body: text ? JSON.parse(text) : null, res };
  if (answer.body?.code) {
    seen.add(answer.body.code);
    statuses.add(answer.status);
  }
  return answer;
};

type Answer = Awaited<ReturnType<typeof send>>;

/** The answer is this refusal: its status, code and params, next to an English sentence */
function expectRefusal(
  answer: Answer,
  status: number,
  code: string,
  params?: Record<string, string | number>,
) {
  expect(answer.body).toMatchObject({ code });
  expect(answer.status).toBe(status);
  expect(typeof answer.body.error).toBe('string');
  expect(answer.body.error.length).toBeGreaterThan(0);
  expect(answer.body.params).toEqual(params);
}

let named = 0;
const newAccount = async (currency: 'UYU' | 'USD' = 'UYU') =>
  (await send('POST', '/accounts', { name: `Account ${++named}`, type: 'checking', currency })).body
    .id as string;

const newTransaction = async (accountId: string, amount: number, extra: object = {}) =>
  (
    await send('POST', '/transactions', {
      accountId,
      date: '2025-03-10',
      amount,
      payeeName: 'Shop',
      ...extra,
    })
  ).body as { id: string; children?: { id: string }[] };

const reconcile = (accountId: string, id: string) =>
  send('PUT', `/accounts/${accountId}/reconcile`, { transactionIds: [id] });

describe('signing in', () => {
  const good = 'a long enough password';
  let cookie: string | undefined;

  it('refuses a password of the wrong length, with the lengths allowed', async () => {
    const answer = await send('POST', '/auth/setup', { password: 'short', setupCode: setupCode() });
    expectRefusal(answer, 400, 'password_length', { min: 8, max: 256 });
    expect(answer.body.error).toBe('Password must be 8-256 characters');
  });

  it('refuses a wrong setup code', async () => {
    const answer = await send('POST', '/auth/setup', { password: good, setupCode: 'nope' });
    expectRefusal(answer, 403, 'incorrect_setup_code');
    expect(answer.body.error).toBe('Incorrect setup code');
  });

  it('refuses a second password', async () => {
    const first = await send('POST', '/auth/setup', { password: good, setupCode: setupCode() });
    expect(first.status).toBe(204);
    cookie = first.res.headers.get('set-cookie')?.split(';')[0];
    expectRefusal(
      await send('POST', '/auth/setup', { password: good, setupCode: setupCode() }),
      409,
      'password_already_set',
    );
  });

  it('refuses a wrong password', async () => {
    const answer = await send('POST', '/auth/login', { password: 'not the password' });
    expectRefusal(answer, 401, 'incorrect_password');
    expect(answer.body.error).toBe('Incorrect password');
  });

  it('refuses a password change with the wrong current password, or a new one too short', async () => {
    expectRefusal(
      await send(
        'POST',
        '/auth/change-password',
        { currentPassword: 'not the password', newPassword: 'another long password' },
        cookie,
      ),
      401,
      'incorrect_current_password',
    );
    const short = await send(
      'POST',
      '/auth/change-password',
      { currentPassword: good, newPassword: 'short' },
      cookie,
    );
    expectRefusal(short, 400, 'password_length', { min: 8, max: 256 });
    expect(short.body.error).toBe('New password must be 8-256 characters');
  });

  it('refuses after too many failed attempts', async () => {
    let last: Answer | undefined;
    // Over the longest password allowed: refused before any hashing
    for (let i = 0; i < 12; i++) {
      last = await send('POST', '/auth/login', { password: 'x'.repeat(300) });
    }
    expectRefusal(last!, 429, 'too_many_attempts');
  });

  it('a request that needs a session carries no code', async () => {
    const answer = await send('POST', '/auth/change-password', {
      currentPassword: good,
      newPassword: 'another long password',
    });
    expect(answer.status).not.toBe(204);
    expect(answer.body.code).not.toBe('incorrect_current_password');
  });
});

describe('rate limits', () => {
  it('refuses bank requests past the limit', async () => {
    let last: Answer | undefined;
    for (let i = 0; i < 21; i++) last = await send('POST', '/limited-bank', {});
    expectRefusal(last!, 429, 'bank_rate_limit');
  });

  it('refuses exchange rate refreshes past the limit', async () => {
    let last: Answer | undefined;
    for (let i = 0; i < 11; i++) last = await send('POST', '/limited-rates/refresh', {});
    expectRefusal(last!, 429, 'rates_refresh_limit');
  });
});

describe("an account's currency", () => {
  it('is locked by transactions', async () => {
    const account = await newAccount();
    await newTransaction(account, -500);
    expectRefusal(
      await send('PUT', `/accounts/${account}`, { currency: 'USD' }),
      409,
      'currency_locked_transactions',
    );
  });

  it('is locked by a recurring item', async () => {
    const account = await newAccount();
    await send('POST', '/schedules', {
      name: 'Rent',
      accountId: account,
      amount: -100_000,
      recurrenceType: 'monthly',
      startDate: '2026-01-10',
    });
    expectRefusal(
      await send('PUT', `/accounts/${account}`, { currency: 'USD' }),
      409,
      'currency_locked_recurring',
    );
  });

  it('is locked by a goal', async () => {
    const account = await newAccount();
    await send('POST', '/goals', { name: 'Trip', targetAmount: 500_000, accountId: account });
    expectRefusal(
      await send('PUT', `/accounts/${account}`, { currency: 'USD' }),
      409,
      'currency_locked_goal',
    );
  });
});

describe('transactions', () => {
  it('refuses to edit or delete a reconciled transaction', async () => {
    const account = await newAccount();
    const { id } = await newTransaction(account, -500);
    await reconcile(account, id);
    expectRefusal(
      await send('PUT', `/transactions/${id}`, { notes: 'x' }),
      403,
      'transaction_reconciled',
    );
    expectRefusal(await send('DELETE', `/transactions/${id}`), 403, 'transaction_reconciled');
  });

  it('refuses a split whose parts do not add up', async () => {
    const account = await newAccount();
    const answer = await send('POST', '/transactions', {
      accountId: account,
      date: '2025-03-10',
      amount: -500,
      payeeName: 'Shop',
      splits: [{ categoryId: null, amount: -100 }],
    });
    expectRefusal(answer, 400, 'split_total_mismatch');
  });

  it("refuses to change a split's amount, or a part's account, date or amount", async () => {
    const account = await newAccount();
    const split = await newTransaction(account, -500, {
      splits: [
        { categoryId: null, amount: -200 },
        { categoryId: null, amount: -300 },
      ],
    });
    expectRefusal(
      await send('PUT', `/transactions/${split.id}`, { amount: -600 }),
      400,
      'split_edit_parts',
    );
    expectRefusal(
      await send('PUT', `/transactions/${split.children![0].id}`, { amount: -250 }),
      400,
      'split_amount_fixed',
    );
  });

  it('refuses to move a transaction to an account of the other currency', async () => {
    const pesos = await newAccount();
    const dollars = await newAccount('USD');
    const { id } = await newTransaction(pesos, -500);
    expectRefusal(
      await send('PUT', `/transactions/${id}`, { accountId: dollars }),
      400,
      'account_other_currency',
    );
  });
});

describe('transfers', () => {
  const transfer = async (from: string, to: string, extra: object = {}) =>
    send('POST', '/transactions/transfer', {
      fromAccountId: from,
      toAccountId: to,
      date: '2025-03-10',
      amount: 4_000_000,
      ...extra,
    });

  it('needs the amount arriving between currencies, and one amount within a currency', async () => {
    const pesos = await newAccount();
    const dollars = await newAccount('USD');
    const morePesos = await newAccount();
    expectRefusal(await transfer(pesos, dollars), 400, 'transfer_needs_arriving_amount');
    expectRefusal(await transfer(pesos, morePesos, { toAmount: 1 }), 400, 'transfer_same_amount');
  });

  it("keeps a transfer's sides in their accounts, without a category and with their direction", async () => {
    const pesos = await newAccount();
    const dollars = await newAccount('USD');
    const other = await newAccount();
    const [leaving, arriving] = (await transfer(pesos, dollars, { toAmount: 100_000 })).body;
    expectRefusal(
      await send('PUT', `/transactions/${leaving.id}`, { accountId: other }),
      400,
      'transfer_no_category',
    );
    expectRefusal(
      await send('PUT', `/transactions/${leaving.id}`, { amount: 5 }),
      400,
      'transfer_side_leaving',
    );
    expectRefusal(
      await send('PUT', `/transactions/${arriving.id}`, { amount: -5 }),
      400,
      'transfer_side_arriving',
    );
  });

  it('refuses to unlink what is not a transfer', async () => {
    const { id } = await newTransaction(await newAccount(), -500);
    expectRefusal(await send('POST', `/transactions/${id}/unlink-transfer`), 400, 'not_a_transfer');
  });

  it('says why two transactions cannot be linked as a transfer', async () => {
    const from = await newAccount();
    const to = await newAccount();
    const link = (id: string, otherTransactionId: string) =>
      send('POST', `/transactions/${id}/link-transfer`, { otherTransactionId });
    const out = await newTransaction(from, -500);
    const into = await newTransaction(to, 500);

    expectRefusal(
      await link(out.id, (await newTransaction(from, 500)).id),
      400,
      'link_different_accounts',
    );
    expectRefusal(
      await link(out.id, (await newTransaction(to, -500)).id),
      400,
      'link_outflow_and_inflow',
    );
    expectRefusal(await link(out.id, (await newTransaction(to, 700)).id), 400, 'link_same_amount');
    const split = await newTransaction(to, 500, {
      splits: [
        { categoryId: null, amount: 200 },
        { categoryId: null, amount: 300 },
      ],
    });
    expectRefusal(await link(out.id, split.id), 400, 'link_split');

    const reconciled = await newTransaction(to, 500);
    await reconcile(to, reconciled.id);
    expectRefusal(await link(out.id, reconciled.id), 403, 'transaction_reconciled');

    expect((await link(out.id, into.id)).status).toBe(200);
    expectRefusal(
      await link(out.id, (await newTransaction(to, 500)).id),
      400,
      'link_already_transfer',
    );
  });
});

describe('importing', () => {
  it('refuses a file with too many rows, with the most allowed', async () => {
    const account = await newAccount();
    const rows = Array.from({ length: 100_001 }, (_, i) => ({
      date: '2025-03-10',
      amount: -1,
      importedId: `r${i}`,
    }));
    for (const step of ['preview', 'confirm']) {
      expectRefusal(
        await send('POST', `/transactions/import/${step}`, { accountId: account, rows }),
        400,
        'import_too_many_rows',
        { max: 100_000 },
      );
    }
  });
});

describe('restoring a backup', () => {
  const restore = (file: unknown) => send('POST', '/export/restore', file);

  it('refuses a file that is not a backup, or one from a newer version', async () => {
    expectRefusal(await restore({ hello: 'world' }), 400, 'not_a_backup');
    expectRefusal(
      await restore({ format: 'flybudget-backup', version: 99 }),
      400,
      'backup_newer_version',
    );
  });

  it('names the row and table that are not valid', async () => {
    const answer = await restore({
      format: 'flybudget-backup',
      version: 2,
      accounts: [
        { id: 'a', name: 'A', type: 'checking', startingBalance: 0 },
        { id: 'b', name: 'B', type: 'checking', startingBalance: 'lots' },
      ],
    });
    expectRefusal(answer, 400, 'backup_row_invalid', { row: 2, table: 'accounts' });
    expect(answer.body.error).toBe('Row 2 of "accounts" has an invalid "startingBalance"');
  });

  it('refuses a backup whose rows point at rows that are not in it', async () => {
    expectRefusal(
      await restore({
        format: 'flybudget-backup',
        version: 2,
        transactions: [{ id: 't', accountId: 'missing', date: '2025-01-01', amount: 5 }],
      }),
      400,
      'backup_inconsistent',
    );
  });
});

describe('SimpleFIN', () => {
  const token = (claimUrl: string) => Buffer.from(claimUrl).toString('base64');
  const setup = (setupToken: string) => send('POST', '/simplefin/setup', { setupToken });
  const answers = (...responses: (Response | Error)[]) => {
    bank.safeFetch = () => {
      const next = responses.shift() ?? new Error('unexpected request');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    };
  };
  const claimed = () => new Response('https://user:pass@bridge.example.com/simplefin');
  const good = token('https://bridge.example.com/claim/abc');

  it('refuses a setup token that is not one', async () => {
    expectRefusal(await setup('not a token!'), 400, 'simplefin_invalid_token');
    expectRefusal(await setup(token('http://10.0.0.1/claim')), 400, 'simplefin_invalid_token');
  });

  it('refuses a setup token that was already used', async () => {
    answers(new Response('', { status: 403 }));
    expectRefusal(await setup(good), 400, 'simplefin_token_used');
  });

  it('refuses when the bridge hands back something that is not an access URL', async () => {
    answers(new Response('not a url'));
    expectRefusal(await setup(good), 500, 'simplefin_invalid_url');
  });

  it('says when the subscription has lapsed or access was revoked', async () => {
    answers(claimed(), new Response('', { status: 402 }));
    expectRefusal(await setup(good), 500, 'simplefin_subscription_required');
    answers(claimed(), new Response('', { status: 403 }));
    expectRefusal(await setup(good), 500, 'simplefin_access_denied');
  });

  it('says when SimpleFIN answers something unreadable', async () => {
    answers(claimed(), new Response('<html>'));
    expectRefusal(await setup(good), 500, 'simplefin_bad_response');
    answers(claimed(), new Response('{"accounts": "none"}'));
    expectRefusal(await setup(good), 500, 'simplefin_bad_response');
  });

  it('says when the address is one FlyBudget will not connect to', async () => {
    answers(new UnsafeUrlError('Refusing to connect to a non-public address'));
    expectRefusal(await setup(good), 500, 'bank_address_refused');
  });

  it('says when SimpleFIN cannot be reached, without the reason', async () => {
    answers(new Error('getaddrinfo ENOTFOUND /secret/path'));
    const answer = await setup(good);
    expectRefusal(answer, 500, 'simplefin_unreachable');
    expect(answer.body.error).toBe('Could not reach SimpleFIN. Try again later.');
  });

  it('says when a sync fails', async () => {
    expectRefusal(await send('POST', '/simplefin/sync-all'), 500, 'sync_failed');
  });
});

describe('Plaid', () => {
  it('refuses while Plaid is not configured', async () => {
    expectRefusal(await send('POST', '/plaid/hosted-link'), 409, 'plaid_not_configured');
  });

  it('says when connecting, syncing or disconnecting fails', async () => {
    await send('POST', '/plaid/configure', {
      clientId: 'client-id-0123456789',
      secret: 'secret-0123456789',
      environment: 'sandbox',
    });
    bank.startHostedLink = () => Promise.reject(new Error('no Hosted Link URL'));
    expectRefusal(await send('POST', '/plaid/hosted-link'), 500, 'plaid_link_failed');
    expectRefusal(await send('POST', '/plaid/sync-all'), 500, 'sync_failed');

    db.insert(plaidItems)
      .values({
        id: 'item-1',
        plaidItemId: 'plaid-item-1',
        institutionId: 'ins_1',
        institutionName: 'Bank',
        accessToken: 'access-token',
      })
      .run();
    const answer = await send('DELETE', '/plaid/items/item-1');
    expectRefusal(answer, 500, 'plaid_revoke_failed');
    expect(JSON.stringify(answer.body)).not.toContain('access-token');
  });
});

describe('exchange rates', () => {
  it('says when a refresh fails, and when fetching is switched off', async () => {
    expectRefusal(await send('POST', '/exchange-rates/refresh'), 500, 'rates_refresh_failed');
    const off = await send('POST', '/rates-off/refresh');
    expectRefusal(off, 500, 'rates_fetching_off');
    expect(off.body.error).toBe(
      'Fetching exchange rates is switched off (FLYBUDGET_EXCHANGE_RATES=off)',
    );
  });

  it('refuses a rate for a day still to come', async () => {
    expectRefusal(
      await send('PUT', '/exchange-rates/2999-01-01', { rate: 40 }),
      400,
      'rate_date_in_future',
    );
  });
});

describe('rules', () => {
  const rule = (value: string) => ({
    conditionsOp: 'and',
    conditions: [{ field: 'payee_name', op: 'regex', value }],
    actions: [{ type: 'set_notes', value: 'x' }],
  });

  it('refuses a regex that does not compile', async () => {
    const answer = await send('POST', '/rules', rule('('));
    expectRefusal(answer, 400, 'rule_regex_invalid');
    expectRefusal(
      await send('POST', '/rules/test', { conditionsOp: 'and', conditions: rule('(').conditions }),
      400,
      'rule_regex_invalid',
    );
  });

  it('refuses a regex that is too long, with the most allowed', async () => {
    expectRefusal(await send('POST', '/rules', rule('a'.repeat(201))), 400, 'rule_regex_too_long', {
      max: 200,
    });
  });

  it('other invalid rules still answer with the fields that are wrong', async () => {
    const answer = await send('POST', '/rules', { ...rule('a'), conditionsOp: 'maybe' });
    expect(answer.status).toBe(400);
    expect(answer.body.code).toBeUndefined();
    expect(typeof answer.body.error).toBe('object');
  });
});

describe('the rest', () => {
  it('refuses to delete the last dashboard', async () => {
    const [only] = (await send('GET', '/dashboards')).body;
    expectRefusal(await send('DELETE', `/dashboards/${only.id}`), 400, 'last_dashboard');
  });

  it("refuses to move a deleted category's transactions to itself", async () => {
    const group = (await send('POST', '/categories/groups', { name: 'Things' })).body;
    const category = (await send('POST', '/categories', { name: 'Stuff', groupId: group.id })).body;
    expectRefusal(
      await send('DELETE', `/categories/${category.id}?reassignTo=${category.id}`),
      400,
      'pick_another_category',
    );
  });

  it('keeps a recurring item in one currency', async () => {
    const pesos = await newAccount();
    const dollars = await newAccount('USD');
    const item = {
      name: 'Savings',
      accountId: pesos,
      amount: -1_000,
      recurrenceType: 'monthly',
      startDate: '2026-01-10',
    };
    expectRefusal(
      await send('POST', '/schedules', { ...item, transferAccountId: dollars }),
      400,
      'recurring_transfer_other_currency',
    );
    const saved = (await send('POST', '/schedules', item)).body;
    expectRefusal(
      await send('PUT', `/schedules/${saved.id}`, { transferAccountId: dollars }),
      400,
      'recurring_transfer_other_currency',
    );

    const occurrences = (
      await send('GET', `/schedules/occurrences?from=2026-01-01&to=2026-01-31`)
    ).body.filter((o: { scheduleId: string }) => o.scheduleId === saved.id);
    const inDollars = await newTransaction(dollars, -1_000);
    expectRefusal(
      await send('POST', `/schedules/occurrences/${occurrences[0].id}/match`, {
        transactionId: inDollars.id,
      }),
      400,
      'recurring_other_currency',
    );
  });

  it('refuses to mark paid a recurring item with no account, or with nothing pending', async () => {
    const item = (
      await send('POST', '/schedules', {
        name: 'Unassigned',
        amount: -1_000,
        recurrenceType: 'monthly',
        startDate: '2026-01-10',
      })
    ).body;
    expectRefusal(
      await send('POST', `/schedules/${item.id}/mark-paid`, { date: '2026-01-10' }),
      400,
      'recurring_no_account',
    );

    const once = (
      await send('POST', '/schedules', {
        name: 'Once',
        accountId: await newAccount(),
        amount: -1_000,
        recurrenceType: 'once',
        startDate: '2026-01-10',
      })
    ).body;
    await send('POST', `/schedules/${once.id}/mark-paid`, { date: '2026-01-10' });
    expectRefusal(
      await send('POST', `/schedules/${once.id}/mark-paid`, { date: '2026-01-10' }),
      400,
      'recurring_nothing_pending',
    );
  });
});

describe('what never carries a code', () => {
  it('the health check stays exactly {"status":"ok"}', async () => {
    const res = await fetch(`${base}/health`);
    expect(await res.text()).toBe('{"status":"ok"}');
  });

  it('something missing, or a body that is not valid', async () => {
    const missing = await send('PUT', '/transactions/nope', { notes: 'x' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Not found' });
    const invalid = await send('POST', '/accounts', { name: 5 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBeUndefined();
  });
});

describe('the list of codes', () => {
  it('is exactly what the routes above answered with', () => {
    expect([...seen].sort()).toEqual([...REFUSAL_CODES].sort());
  });

  // The app reads 502-504 as "server unreachable" (client/src/utils/connection.ts) and would
  // never show the sentence: a bank or source that fails answers 500
  it('never answers with a gateway status', () => {
    expect([...statuses].filter((s) => s >= 502 && s <= 504)).toEqual([]);
  });

  it('names its codes and params in snake_case and camelCase', () => {
    for (const code of REFUSAL_CODES) {
      expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/);
      for (const param of REFUSALS[code]) expect(param).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });
});
