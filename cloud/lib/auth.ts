/**
 * Who is calling the proxy.
 *
 * Supabase signs tokens with an asymmetric key (ES256) and publishes the public
 * half at a JWKS endpoint, so there is no shared secret for us to hold, leak, or
 * rotate — and key rotation on their side needs no deploy on ours.
 *
 * Verification still happens in-process. `createRemoteJWKSet` fetches the key
 * set once and caches it, refetching only when a token arrives signed by a key
 * it hasn't seen. That matters here more than it usually would: one agent turn
 * is up to a hundred sequential model steps, so anything per-request that
 * touches the network is paid a hundred times, on the hot path.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface Caller {
  userId: string;
  email: string;
}

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url.replace(/\/$/, '');
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function keySet() {
  jwks ??= createRemoteJWKSet(new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`));
  return jwks;
}

/**
 * Phase 1b ships to a hand-picked list rather than the world: the proxy spends
 * real money per request and has no quota enforcement yet, so "signed in" alone
 * is not yet a reason to serve someone. Removed once §4.4's balances land.
 */
function allowedEmails(): Set<string> | null {
  const raw = process.env.ALLOWED_EMAILS?.trim();
  if (!raw) return null;
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function authenticate(request: Request): Promise<Caller> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError(401, 'missing_token', 'Sign in to use the hosted model.');

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, keySet(), {
      // Pinning both stops a token minted by some other Supabase project — or
      // for a different audience within this one — from passing as ours.
      issuer: `${supabaseUrl()}/auth/v1`,
      audience: 'authenticated',
    }));
  } catch {
    // Covers expired as well as forged: the client's answer to both is the
    // same — refresh the session and retry — so they need not be distinguished.
    throw new AuthError(401, 'invalid_token', 'Your session expired. Sign in again.');
  }

  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!userId) throw new AuthError(401, 'invalid_token', 'Token carries no subject.');

  const allowed = allowedEmails();
  if (allowed && !allowed.has(email)) {
    throw new AuthError(403, 'not_in_preview', 'Hosted mode is in private preview.');
  }

  return { userId, email };
}
