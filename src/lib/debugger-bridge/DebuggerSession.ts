const CDP_VERSION = '1.3';

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'chrome-search://',
  'devtools://',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
  'edge://',
  'about:',
];

export class RestrictedTargetError extends Error {
  constructor(url: string) {
    super(`Can't automate this page (${url}). Chrome blocks debugger attachment to internal/store pages.`);
    this.name = 'RestrictedTargetError';
  }
}

export class SessionDetachedError extends Error {
  constructor(reason: string) {
    super(`Debugger session was detached (${reason}). Call take_snapshot again to reconnect.`);
    this.name = 'SessionDetachedError';
  }
}

export class DebuggerConflictError extends Error {
  constructor() {
    super(
      'Something else is already debugging this tab, so it cannot be automated. ' +
        'This is almost always DevTools being open on that tab — close DevTools ' +
        '(or any other debugging extension) for this tab, then try again.',
    );
    this.name = 'DebuggerConflictError';
  }
}

/** Throws if the tab cannot be debugged at all, without touching chrome.debugger. */
export async function assertAttachable(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ?? tab.pendingUrl ?? '';
  if (RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new RestrictedTargetError(url);
  }
}

type EventHandler = (params: unknown) => void;

/**
 * Wraps chrome.debugger for a single attached tab. One instance = one live
 * CDP session. Structurally a {@link import('../cdp').CdpConnection}, so the
 * transport-agnostic helpers in `src/lib/cdp` can drive it directly.
 * Detach (deliberate or via onDetach) tears the whole thing down; callers must
 * re-attach rather than assume the session survives.
 */
export class DebuggerSession {
  private readonly tabId: number;
  private detached = false;
  private detachReason: string | null = null;
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly onEventListener: (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
  ) => void;
  private readonly onDetachListener: (source: chrome.debugger.Debuggee, reason: string) => void;
  private onExternalDetach: ((reason: string) => void) | null = null;

  private constructor(tabId: number) {
    this.tabId = tabId;

    this.onEventListener = (source, method, params) => {
      if (source.tabId !== this.tabId) return;
      const handlers = this.eventHandlers.get(method);
      if (!handlers) return;
      for (const handler of handlers) handler(params);
    };

    this.onDetachListener = (source, reason) => {
      if (source.tabId !== this.tabId) return;
      this.detached = true;
      this.detachReason = reason;
      chrome.debugger.onEvent.removeListener(this.onEventListener);
      chrome.debugger.onDetach.removeListener(this.onDetachListener);
      this.onExternalDetach?.(reason);
    };

    chrome.debugger.onEvent.addListener(this.onEventListener);
    chrome.debugger.onDetach.addListener(this.onDetachListener);
  }

  static async attach(tabId: number): Promise<DebuggerSession> {
    await assertAttachable(tabId);

    const session = new DebuggerSession(tabId);
    try {
      await session.attachWithRecovery();
      return session;
    } catch (err) {
      session.removeListeners();
      throw err;
    }
  }

  private removeListeners(): void {
    chrome.debugger.onEvent.removeListener(this.onEventListener);
    chrome.debugger.onDetach.removeListener(this.onDetachListener);
  }

  private async attachWithRecovery(): Promise<void> {
    const tabId = this.tabId;
    try {
      await chrome.debugger.attach({ tabId }, CDP_VERSION);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/already attached/i.test(message)) throw err;
    }

    // Closing the side panel destroys its JS context without reliably
    // detaching, so the attachment blocking us is often our own orphan from a
    // previous session. Chrome only lets an extension detach its own
    // attachment, so if this detach succeeds it was ours to reclaim; if it
    // fails, something else (usually DevTools) genuinely holds the tab.
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      throw new DebuggerConflictError();
    }

    try {
      await chrome.debugger.attach({ tabId }, CDP_VERSION);
    } catch {
      throw new DebuggerConflictError();
    }
  }

  /** Registered by sessionRegistry so it can clear itself when Chrome (not us) tears the session down. */
  setOnExternalDetach(handler: (reason: string) => void): void {
    this.onExternalDetach = handler;
  }

  isDetached(): boolean {
    return this.detached;
  }

  getTabId(): number {
    return this.tabId;
  }

  async detach(): Promise<void> {
    if (this.detached) return;
    this.detached = true;
    chrome.debugger.onEvent.removeListener(this.onEventListener);
    chrome.debugger.onDetach.removeListener(this.onDetachListener);
    try {
      await chrome.debugger.detach({ tabId: this.tabId });
    } catch {
      // Tab may already be gone; nothing more to do.
    }
  }

  async send<TResult = unknown>(method: string, params?: object): Promise<TResult> {
    if (this.detached) {
      throw new SessionDetachedError(this.detachReason ?? 'unknown');
    }
    const result = await chrome.debugger.sendCommand({ tabId: this.tabId }, method, params);
    return (result ?? {}) as TResult;
  }

  /** Returns an unsubscribe function. */
  on(method: string, handler: EventHandler): () => void {
    let handlers = this.eventHandlers.get(method);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(method, handlers);
    }
    handlers.add(handler);
    return () => handlers!.delete(handler);
  }
}
