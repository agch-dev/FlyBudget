import { API_BASE } from './base';
import { reportNetworkFailure, reportServerReachable } from '../store/connectionStore';
import { isUnreachableResponse } from '../utils/connection';
import { currentLanguage, t } from '../i18n';
import { isTranslated, refusalMessage, type ServerRefusal } from './serverErrors';

export const AUTH_REQUIRED_EVENT = 'flybudget:auth-required';

/** The request never reached FlyBudget's server (it's restarting, stopped, or offline). */
export class NetworkError extends Error {
  constructor() {
    super(t('connection:networkError'));
    this.name = 'NetworkError';
  }
}

/**
 * The server answered with an error. The message is safe to show: it is written in the
 * language shown when the request failed. `refusal` is what the server sent (its English
 * sentence, and its code and params when the refusal has one), for anything that keeps an
 * error to show later (`refusalMessage` says it in the language of that moment).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly refusal: ServerRefusal = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get code() {
    return this.refusal.code;
  }

  get params() {
    return this.refusal.params;
  }
}

const isParams = (value: unknown): value is Record<string, string | number> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every((v) => typeof v === 'string' || typeof v === 'number');

/** What a refused request's body says: `{ error, code?, params? }`, each only when well formed */
function readRefusal(body: unknown): ServerRefusal {
  const { error, code, params } = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >;
  return {
    ...(typeof error === 'string' ? { error } : {}),
    ...(typeof code === 'string' ? { code } : {}),
    ...(isParams(params) ? { params } : {}),
  };
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    // Cancelled on purpose (e.g. a query that's no longer needed): not a connection problem
    if ((err as Error)?.name === 'AbortError') throw err;
    reportNetworkFailure();
    throw new NetworkError();
  }
  if (isUnreachableResponse(res.status, res.headers.get('content-type'))) {
    reportNetworkFailure();
    throw new NetworkError();
  }
  // Any real answer (even an error or "login required") means the server is there
  reportServerReachable();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Server mode: the session expired or was signed out elsewhere — show the login screen
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    // The server's messages are English. A refusal the user can act on has a code, which the
    // app says in its own language (serverErrors.ts); validation failures send an object of
    // field errors, not a message
    const refusal = readRefusal(body);
    const message = refusalMessage(
      refusal,
      body?.error ? t('errors.invalidValues') : res.statusText,
    );
    // Outside English, a refusal without a sentence of the app's reads as a generic one:
    // what the server said goes to the console
    if (currentLanguage() !== 'en' && !isTranslated(refusal)) {
      console.warn(
        `${(options?.method ?? 'GET').toUpperCase()} ${path} answered ${res.status}:`,
        body?.error ?? res.statusText,
      );
    }
    throw new ApiError(message, res.status, refusal);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
