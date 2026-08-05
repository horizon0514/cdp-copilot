import type { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping.js';

/**
 * Minimal CDP transport. Anything that can send commands and subscribe to
 * events — chrome.debugger, a Puppeteer CDPSession, chrome-remote-interface —
 * can back the helpers in this module.
 */
export interface CdpConnection {
  send<T = unknown>(method: string, params?: object): Promise<T>;
  on(method: string, handler: (params: unknown) => void): () => void;
}

/** Typed CDP command helper over an untyped transport. */
export async function cdpSend<M extends keyof ProtocolMapping.Commands>(
  cdp: CdpConnection,
  method: M,
  ...args: ProtocolMapping.Commands[M]['paramsType']
): Promise<ProtocolMapping.Commands[M]['returnType']> {
  return cdp.send(method, args[0] as object | undefined);
}

/** Resolves on the next matching event, or rejects on timeout. */
export function onceEvent<M extends keyof ProtocolMapping.Events>(
  cdp: CdpConnection,
  method: M,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    match?: (event: ProtocolMapping.Events[M][0]) => boolean;
  } = {},
): Promise<ProtocolMapping.Events[M][0]> {
  const { timeoutMs = 30_000, signal, match } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${method} after ${timeoutMs}ms`));
    }, timeoutMs);

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const unsubscribe = cdp.on(method, (params) => {
      const event = params as ProtocolMapping.Events[M][0];
      if (match && !match(event)) return;
      cleanup();
      resolve(event);
    });

    const cleanup = () => {
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
