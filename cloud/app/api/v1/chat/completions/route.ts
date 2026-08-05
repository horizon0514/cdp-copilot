import { after } from 'next/server';
import { proxyChatCompletion } from '@/lib/proxy';
import { toMicroUsd } from '@/lib/usage';

/**
 * The platform default is well under 60s, and a step carrying a large snapshot
 * to a slow model will hit it. 60 is the Hobby ceiling; going past it needs Pro.
 * See PLAN-subscription §6.1.
 *
 * This budget also covers the `after()` callback below, which is why the usage
 * read starts while the stream is still flowing rather than after it closes.
 *
 * No `runtime` export: nodejs is the default and the edge runtime is deprecated
 * in Next 16, which asks that the export be removed rather than set.
 */
export const maxDuration = 60;

/** Phase 1a runs with no auth at all — every request bills to the same stub.
 * Replaced by local Supabase JWT verification in Phase 1b (§4.3). */
const STUB_USER_ID = 'dev-user';

export async function POST(request: Request): Promise<Response> {
  return proxyChatCompletion(request, {
    userId: STUB_USER_ID,
    keepAlive: (work) => after(() => work),
    onUsage: (usage, meta) => {
      // Phase 1a: prove the usage frame — and the cost the whole ledger design
      // now rests on — actually arrives. The debit itself (§4.4) lands in
      // Phase 2; until then this log is the entire point of teeing the stream.
      const micros = toMicroUsd(usage);
      console.log(
        '[usage]',
        meta.model,
        meta.userId,
        micros === null ? 'COST MISSING' : `${micros} µUSD`,
        usage ?? 'USAGE MISSING',
      );
    },
  });
}

/** Extension pages get a CORS bypass for granted host permissions, so this
 * shouldn't be needed — but a missing preflight answer fails in a way that
 * looks like a network error, which is an afternoon nobody should spend.
 * Auth here is a bearer token, never a cookie, so CORS isn't a trust boundary. */
export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': request.headers.get('origin') ?? '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '86400',
    },
  });
}
