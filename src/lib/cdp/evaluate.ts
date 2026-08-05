import { cdpSend, type CdpConnection } from './connection';

export interface EvaluateOptions {
  /** Await a returned Promise before resolving. Default true. */
  awaitPromise?: boolean;
  /** Return a JSON-serializable copy instead of a remote object. Default true. */
  returnByValue?: boolean;
  /** Mark the call as triggered by a user gesture (clipboard, popups, …). */
  userGesture?: boolean;
}

/**
 * Evaluate a function declaration in the page and return its result.
 * Mirrors `(fn)(...args)` so a bare declaration actually runs.
 */
export async function evaluateFunction<T = unknown>(
  cdp: CdpConnection,
  fn: string,
  args: unknown[] = [],
  options: EvaluateOptions = {},
): Promise<T> {
  const {
    awaitPromise = true,
    returnByValue = true,
    userGesture = false,
  } = options;

  const expression = `(${fn})(...${JSON.stringify(args)})`;
  const { result, exceptionDetails } = await cdpSend(cdp, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    userGesture,
  });

  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return (result?.value ?? null) as T;
}
