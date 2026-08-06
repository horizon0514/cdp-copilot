/**
 * Exchanges a refresh token for a fresh session.
 *
 * Proxied rather than called from the extension directly so the extension holds
 * no Supabase credentials, needs no second host permission, and does not encode
 * which auth vendor we happen to use — swapping it later touches this file and
 * nothing shipped to users.
 */
export async function POST(request: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: { message: 'Auth is not configured.' } }, { status: 500 });
  }

  let refreshToken: unknown;
  try {
    ({ refresh_token: refreshToken } = (await request.json()) as { refresh_token?: unknown });
  } catch {
    return Response.json({ error: { message: 'Invalid JSON.' } }, { status: 400 });
  }
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return Response.json({ error: { message: 'Missing refresh_token.' } }, { status: 400 });
  }

  const upstream = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!upstream.ok) {
    // 401 specifically tells the client to stop retrying and sign in again;
    // anything else is worth another attempt later.
    return Response.json(
      { error: { message: 'Could not refresh the session.' } },
      { status: upstream.status === 400 || upstream.status === 401 ? 401 : 502 },
    );
  }

  const data = (await upstream.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    user?: { email?: string };
  };
  if (!data.access_token || !data.refresh_token || !data.expires_at) {
    return Response.json({ error: { message: 'Upstream returned no session.' } }, { status: 502 });
  }

  // Reshaped into the extension's own vocabulary — it should not have to parse
  // a vendor's payload.
  return Response.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    ...(data.user?.email ? { email: data.user.email } : {}),
  });
}
