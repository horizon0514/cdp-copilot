import { cdpSend, onceEvent, type CdpConnection } from './connection';

export type WaitUntil = 'load' | 'domcontentloaded' | 'commit';

export interface NavigateOptions {
  timeoutMs?: number;
  waitUntil?: WaitUntil;
  signal?: AbortSignal;
}

const pageDomainReady = new WeakSet<object>();

async function ensurePageDomain(cdp: CdpConnection): Promise<void> {
  if (pageDomainReady.has(cdp)) return;
  await cdpSend(cdp, 'Page.enable');
  await cdpSend(cdp, 'Page.setLifecycleEventsEnabled', { enabled: true });
  pageDomainReady.add(cdp);
}

function linkAbort(signal: AbortSignal | undefined, local: AbortController): () => void {
  if (!signal) return () => undefined;
  if (signal.aborted) {
    local.abort();
    return () => undefined;
  }
  const onAbort = () => local.abort();
  signal.addEventListener('abort', onAbort);
  return () => signal.removeEventListener('abort', onAbort);
}

function waitForLifecycle(
  cdp: CdpConnection,
  waitUntil: WaitUntil,
  options: { timeoutMs: number; signal?: AbortSignal; frameId?: string },
): Promise<void> {
  if (waitUntil === 'commit') {
    return onceEvent(cdp, 'Page.frameNavigated', {
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      match: (event) =>
        !event.frame.parentId && (!options.frameId || event.frame.id === options.frameId),
    }).then(() => undefined);
  }

  const name = waitUntil === 'load' ? 'load' : 'DOMContentLoaded';
  return onceEvent(cdp, 'Page.lifecycleEvent', {
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    match: (event) =>
      event.name === name && (!options.frameId || event.frameId === options.frameId),
  }).then(() => undefined);
}

async function settleOrAbort(
  pending: Promise<void>,
  local: AbortController,
): Promise<void> {
  try {
    await pending;
  } catch (err) {
    if (local.signal.aborted) return;
    throw err;
  }
}

async function withLifecycleWait<T>(
  cdp: CdpConnection,
  options: NavigateOptions,
  run: () => Promise<T>,
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const waitUntil = options.waitUntil ?? 'load';
  await ensurePageDomain(cdp);

  const local = new AbortController();
  const unlink = linkAbort(options.signal, local);
  const settled = waitForLifecycle(cdp, waitUntil, {
    timeoutMs,
    signal: local.signal,
  });

  try {
    const value = await run();
    await settled;
    return value;
  } catch (err) {
    local.abort();
    await settleOrAbort(settled, local);
    throw err;
  } finally {
    unlink();
  }
}

/**
 * Navigate and wait for a lifecycle milestone.
 * Listener is armed before Page.navigate so a fast load cannot be missed.
 */
export async function navigate(
  cdp: CdpConnection,
  url: string,
  options: NavigateOptions = {},
): Promise<{ frameId?: string; loaderId?: string }> {
  return withLifecycleWait(cdp, options, async () => {
    const result = await cdpSend(cdp, 'Page.navigate', { url });
    if (result.errorText) {
      throw new Error(`Navigation failed: ${result.errorText}`);
    }
    return { frameId: result.frameId, loaderId: result.loaderId };
  });
}

export async function reload(
  cdp: CdpConnection,
  options: NavigateOptions = {},
): Promise<void> {
  await withLifecycleWait(cdp, options, async () => {
    await cdpSend(cdp, 'Page.reload');
  });
}

/** Wait for the next main-frame load after an external navigation. */
export async function waitForNextLoad(
  cdp: CdpConnection,
  options: NavigateOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const waitUntil = options.waitUntil ?? 'load';
  await ensurePageDomain(cdp);
  await waitForLifecycle(cdp, waitUntil, {
    timeoutMs,
    signal: options.signal,
  });
}

/** Traverse session history via CDP and wait for load. Returns false if no entry. */
export async function traverseHistory(
  cdp: CdpConnection,
  delta: -1 | 1,
  options: NavigateOptions = {},
): Promise<boolean> {
  await ensurePageDomain(cdp);

  const { currentIndex, entries } = await cdpSend(cdp, 'Page.getNavigationHistory');
  const target = currentIndex + delta;
  if (target < 0 || target >= entries.length) return false;

  await withLifecycleWait(cdp, options, async () => {
    await cdpSend(cdp, 'Page.navigateToHistoryEntry', { entryId: entries[target].id });
  });
  return true;
}
