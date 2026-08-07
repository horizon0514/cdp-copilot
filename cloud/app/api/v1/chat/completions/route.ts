import { after } from 'next/server';
import { AuthError, authenticate } from '@/lib/auth';
import { proxyChatCompletion } from '@/lib/proxy';
import { toMicroUsd } from '@/lib/usage';

/**
 * Our own ceiling, not the platform's. With fluid compute the platform allows
 * 300s on every plan including Hobby, so this is a deliberate bound: a single
 * agent step that has not answered in a minute is a step that has gone wrong,
 * and letting it run costs both function time and, if it eventually fails,
 * router tokens we cannot bill.
 *
 * This budget also covers the `after()` callback below — including the
 * generation lookup on the recovery path — which is why the usage read starts
 * while the stream is still flowing rather than after it closes.
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
      //
      // `source` is the number to watch before switching the debit on: `lookup`
      // means a torn-down stream whose cost we recovered, `missing` means
      // tokens we paid for and cannot bill. A non-trivial `missing` rate is the
      // signal that the reconciliation job in §4.4 is needed rather than
      // optional — `after()` is not guaranteed to survive a client disconnect,
      // which is exactly when the lookup path fires.
      const micros = toMicroUsd(usage);
      console.log(
        '[usage]',
        meta.source,
        meta.model,
        meta.userId,
        meta.generationId ?? 'no-generation-id',
        micros === null ? 'COST MISSING' : `${micros} µUSD`,
        usage ?? 'USAGE MISSING',
      );
    },
  });
}
