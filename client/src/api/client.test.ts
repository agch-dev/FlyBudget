import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../i18n';

// What `apiFetch` makes of a refused request. The page's `window` and `fetch` are stood in
// for; the server's answers are the ones its routes send (`{ error, code?, params? }`).

const events: string[] = [];
let answer: () => Response = () => new Response('{}');

let client: typeof import('./client');
let connection: typeof import('../store/connectionStore');

beforeAll(async () => {
  vi.stubGlobal('window', {
    addEventListener: () => {},
    dispatchEvent: (event: Event) => events.push(event.type),
  });
  vi.stubGlobal('document', {
    addEventListener: () => {},
    documentElement: {},
    visibilityState: 'visible',
  });
  vi.stubGlobal('fetch', () => Promise.resolve(answer()));
  client = await import('./client');
  connection = await import('../store/connectionStore');
});
afterEach(() => {
  events.length = 0;
  vi.restoreAllMocks();
  connection.reportServerReachable();
});

const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), {
    status,
    statusText: 'Refused',
    headers: { 'Content-Type': 'application/json' },
  });

async function refused(path = '/transactions/t1', method = 'PUT') {
  const failure = await client.apiFetch(path, { method }).catch((err: unknown) => err);
  expect(failure).toBeInstanceOf(client.ApiError);
  return failure as InstanceType<typeof client.ApiError>;
}

const RECONCILED = {
  error: 'Cannot modify a reconciled transaction',
  code: 'transaction_reconciled',
};

describe('a refused request', () => {
  it('carries the code and params the server sent', async () => {
    answer = json(400, {
      error: 'New password must be 8-256 characters',
      code: 'password_length',
      params: { min: 8, max: 256 },
    });
    const err = await refused('/auth/change-password', 'POST');
    expect(err.status).toBe(400);
    expect(err.code).toBe('password_length');
    expect(err.params).toEqual({ min: 8, max: 256 });
    expect(err.message).toBe('New password must be 8-256 characters');
  });

  it("reads in English as the server's sentence, coded or not", async () => {
    answer = json(403, RECONCILED);
    expect((await refused()).message).toBe('Cannot modify a reconciled transaction');
    answer = json(404, { error: 'Not found' });
    const missing = await refused();
    expect(missing.message).toBe('Not found');
    expect(missing.code).toBeUndefined();
  });

  it('reads in English as before when the server sent no sentence', async () => {
    answer = json(400, { error: { fieldErrors: { name: ['Required'] } } });
    expect((await refused()).message).toBe('Some of the values entered are invalid');
    answer = json(418, {});
    expect((await refused()).message).toBe('Refused');
  });

  it('reads in Spanish as the sentence of its code, with nothing in the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLanguage('es');
    answer = json(403, RECONCILED);
    expect((await refused()).message).toBe('No se puede modificar una transacción conciliada');
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads in Spanish as one generic sentence without a code, the server's detail in the console", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLanguage('es');
    for (const body of [
      { error: 'Not found' },
      { error: { fieldErrors: { name: ['Required'] } } },
      { error: 'From a newer server', code: 'not_known_yet' },
      {},
    ]) {
      answer = json(400, body);
      expect((await refused()).message).toBe('No se pudo completar la acción');
    }
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn.mock.calls[0]).toEqual(['PUT /transactions/t1 answered 400:', 'Not found']);
  });

  it('ignores a code or params that are not what the server sends', async () => {
    answer = json(400, { error: 'Odd', code: 7, params: { nested: { a: 1 } } });
    const err = await refused();
    expect(err.code).toBeUndefined();
    expect(err.params).toBeUndefined();
    expect(err.message).toBe('Odd');
  });
});

describe('codes do not change what an answer means', () => {
  it('a 401 still asks for a login, except on the sign-in routes', async () => {
    answer = json(401, { error: 'Login required' });
    await refused('/accounts', 'GET');
    expect(events).toEqual([client.AUTH_REQUIRED_EVENT]);

    events.length = 0;
    answer = json(401, { error: 'Incorrect password', code: 'incorrect_password' });
    expect((await refused('/auth/login', 'POST')).code).toBe('incorrect_password');
    expect(events).toEqual([]);
  });

  it('a 502-504 is still "server unreachable", whatever its body says', async () => {
    for (const status of [502, 503, 504]) {
      answer = json(status, { error: 'Sync failed', code: 'sync_failed' });
      const failure = await client.apiFetch('/plaid/sync-all').catch((err: unknown) => err);
      expect(failure).toBeInstanceOf(client.NetworkError);
      expect(connection.useConnectionStore.getState().status).toBe('reconnecting');
      connection.reportServerReachable();
    }
  });

  it('a refusal means the server is there', async () => {
    connection.reportNetworkFailure();
    answer = json(403, RECONCILED);
    await refused();
    expect(connection.useConnectionStore.getState().status).toBe('connected');
  });
});
