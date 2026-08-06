import { z } from 'zod';
import { HOSTED_BASE_URL } from '../storage/schema';

/**
 * The hosted account session, and the one rule that shapes it: an access token
 * lasts an hour, while a single agent turn can run for minutes across a hundred
 * requests. So nothing may capture a token — every request asks for one, and
 * this module decides whether the cached one still has life in it.
 *
 * Only the refresh token is durable. It lives in `chrome.storage.local`
 * alongside the BYOK keys it is replacing, with the same exposure: readable by
 * anything with access to the browser profile, never synced to a Google account.
 */

const STORAGE_KEY = 'pagehand:session';

const SessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Unix seconds. */
  expiresAt: z.number().int().positive(),
  email: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

/** Refresh this far ahead of expiry, so a token can't die mid-flight on a slow
 * step. Cheap: a refresh is one request, a failed turn is many. */
const REFRESH_MARGIN_SECONDS = 120;

export async function getSession(): Promise<Session | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const parsed = SessionSchema.safeParse(stored[STORAGE_KEY]);
  return parsed.success ? parsed.data : null;
}

export async function saveSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: SessionSchema.parse(session) });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

function expired(session: Session, marginSeconds = REFRESH_MARGIN_SECONDS): boolean {
  return session.expiresAt - marginSeconds <= Math.floor(Date.now() / 1000);
}

/**
 * Where the refresh happens. Pagehand's own API proxies it rather than the
 * extension calling Supabase directly, so the extension needs no Supabase
 * credentials, no second host permission, and no knowledge that Supabase is
 * what we happen to use.
 */
async function refresh(session: Session): Promise<Session | null> {
  try {
    const res = await fetch(`${HOSTED_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!res.ok) {
      // A rejected refresh token is terminal — it has been revoked, rotated
      // past, or the account is gone. Keeping it would mean retrying a dead
      // credential on every step for the rest of the turn.
      if (res.status === 401) await clearSession();
      return null;
    }
    const next = SessionSchema.parse(await res.json());
    await saveSession(next);
    return next;
  } catch {
    // Network failure, not a credential problem: leave the session in place so
    // it can be retried when connectivity returns.
    return null;
  }
}

/** In-flight refresh, shared so a burst of parallel steps triggers one call and
 * doesn't race rotating refresh tokens against each other. */
let inFlight: Promise<Session | null> | null = null;

/** A usable access token, refreshed if it is close to expiring. */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (!expired(session)) return session.accessToken;

  inFlight ??= refresh(session).finally(() => {
    inFlight = null;
  });
  return (await inFlight)?.accessToken ?? null;
}

export async function isSignedIn(): Promise<boolean> {
  return (await getSession()) !== null;
}
