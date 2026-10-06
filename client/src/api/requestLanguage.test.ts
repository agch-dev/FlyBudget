import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../i18n';
import { apiFetch } from './client';
import { withLanguage } from './requestLanguage';

// Every request tells the server the App Language of this device, so the names the app
// supplies (Default Categories, the "Overview" dashboard) come back in it.

// The two parts of apiFetch that need a browser: the API's address and the connection banner
vi.mock('./base', () => ({ API_BASE: '/api' }));
vi.mock('../store/connectionStore', () => ({
  reportNetworkFailure: () => {},
  reportServerReachable: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

/** A server that answers `{}` and records what it was sent */
function serverSpy() {
  const sent: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return sent;
}

const languageOf = (init: RequestInit) => new Headers(init.headers).get('X-FlyBudget-Language');

describe('apiFetch', () => {
  it('sends the App Language with every request, and follows a switch', async () => {
    const sent = serverSpy();
    await apiFetch('/categories');
    setLanguage('es');
    await apiFetch('/categories');
    await apiFetch('/categories', { method: 'POST', body: '{}' });
    expect(sent.map((s) => s.url)).toEqual([
      '/api/categories',
      '/api/categories',
      '/api/categories',
    ]);
    expect(sent.map((s) => languageOf(s.init))).toEqual(['en', 'es', 'es']);
    expect(new Headers(sent[2].init.headers).get('Content-Type')).toBe('application/json');
    expect(sent[2].init.method).toBe('POST');
  });
});

describe('withLanguage (file downloads, which are plain navigations)', () => {
  it('adds the App Language to an address, after any query it has', () => {
    expect(withLanguage('/api/export/transactions/csv')).toBe(
      '/api/export/transactions/csv?lang=en',
    );
    setLanguage('es');
    expect(withLanguage('/api/export/transactions/csv?from=2026-01-01&to=2026-01-31')).toBe(
      '/api/export/transactions/csv?from=2026-01-01&to=2026-01-31&lang=es',
    );
  });
});
