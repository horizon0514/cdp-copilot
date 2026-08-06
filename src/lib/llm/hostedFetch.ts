/**
 * Authentication for the hosted path.
 *
 * `createOpenAI({ apiKey })` captures the key once, at construction. That is
 * fine for a provider key that never changes and fatal for a session token: a
 * turn runs up to 100 requests over several minutes, so a token that was valid
 * when the model was built can expire midway and 401 the rest of the turn.
 *
 * So the token is resolved per request through a custom `fetch`, which also
 * gives `session.ts` the chance to refresh it just before it lapses.
 */
import { getAccessToken } from '../auth/session';

export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to use the hosted model.');
  }
}

export function createHostedFetch(): typeof fetch {
  return async (input, init) => {
    const token = await getAccessToken();
    // Thrown rather than sent unauthenticated: a 401 surfaced from the proxy
    // reads like an outage, while this says what to do about it.
    if (!token) throw new NotSignedInError();

    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}
