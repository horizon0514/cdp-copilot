/**
 * Sends a sign-in link, so the extension can collect the email itself.
 *
 * Without this the side panel has to open a tab just to show a text field, and
 * the emailed link then opens a second one — two tabs for one sign-in, the
 * first of them stranded on "check your email" forever. Asking in the panel
 * leaves exactly one tab, opened at the moment it is actually needed.
 *
 * Proxied for the same reason as the refresh route: the extension holds no
 * Supabase credentials and encodes no knowledge of which auth vendor we use.
 */

/** Where the emailed link lands. It must be an origin Supabase allows and the
 * extension can talk to — see `externally_connectable` in the manifest. */
const RETURN_PATH = '/auth/extension';

function siteUrl(request: Request): string {
  // Follows the deployment it is running on, so a preview build's links come
  // back to that preview rather than to production.
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: { message: 'Auth is not configured.' } }, { status: 500 });
  }

  let email: unknown;
  try {
    ({ email } = (await request.json()) as { email?: unknown });
  } catch {
    return Response.json({ error: { message: 'Invalid JSON.' } }, { status: 400 });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return Response.json({ error: { message: 'Enter a valid email address.' } }, { status: 400 });
  }

  const redirectTo = `${siteUrl(request)}${RETURN_PATH}`;
  const upstream = await fetch(
    `${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ email: email.trim(), create_user: true }),
    },
  );

  if (!upstream.ok) {
    // Rate limiting is the one failure worth naming: the built-in mail service
    // allows only a handful of messages an hour, and a silent failure there
    // looks like the email simply never arrives.
    const detail = (await upstream.json().catch(() => null)) as { msg?: string } | null;
    return Response.json(
      {
        error: {
          message:
            upstream.status === 429
              ? 'Too many sign-in emails just now. Wait a minute and try again.'
              : (detail?.msg ?? 'Could not send the sign-in email.'),
        },
      },
      { status: upstream.status === 429 ? 429 : 502 },
    );
  }

  return Response.json({ ok: true });
}
