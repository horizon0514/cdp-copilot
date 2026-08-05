import { cdpSend, type CdpConnection } from './connection';

export interface WaitForTextOptions {
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
}

/**
 * Poll until any of the texts appear in document.body.innerText.
 * Tolerates mid-navigation evaluate failures instead of aborting the wait.
 */
export async function waitForText(
  cdp: CdpConnection,
  texts: string[],
  options: WaitForTextOptions = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollMs = options.pollMs ?? 200;
  const deadline = Date.now() + timeoutMs;
  const expression =
    `(() => { const t = document.body && document.body.innerText || ''; ` +
    `return ${JSON.stringify(texts)}.some(s => t.includes(s)); })()`;

  while (Date.now() < deadline && !options.signal?.aborted) {
    try {
      const { result, exceptionDetails } = await cdpSend(cdp, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      if (!exceptionDetails && result?.value === true) return true;
    } catch {
      // Document may be unloading; keep polling until timeout.
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}
