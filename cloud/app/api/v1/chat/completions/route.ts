import { after } from 'next/server';
import { AuthError, authenticate } from '@/lib/auth';
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

export async function POST(request: Request): Promise<Response> {
  let caller;
  try {
    caller = await authenticate(request);
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
    return Response.json(
      { error: { message: err.message, type: 'invalid_request_error', code: err.code } },
      { status: err.status },
    );
  }

  return proxyChatCompletion(request, {
    userId: caller.userId,
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
