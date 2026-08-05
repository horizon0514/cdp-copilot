/**
 * Authentication for the hosted path.
 *
 * `createOpenAI({ apiKey })` captures the key once, at construction. That is
 * fine for a provider key that never changes and fatal for a session token: a
 * turn runs up to 100 requests over several minutes, so a token that was valid
 * when the model was built can expire midway and 401 the rest of the turn.
 *
 * So the token is resolved per request through a custom `fetch` instead. Phase
 * 1a has no auth at all and this is a stub; Phase 1b makes `resolveToken` read
 * the Supabase session from `chrome.storage.local` and refresh it when it is
 * close to expiry. The shape stays the same either way.
 */

const PHASE_1A_STUB_TOKEN = 'dev';

async function resolveToken(): Promise<string> {
  return PHASE_1A_STUB_TOKEN;
}

export function createHostedFetch(): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${await resolveToken()}`);
    return fetch(input, { ...init, headers });
  };
}
