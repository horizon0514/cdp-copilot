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

type EventHandler = (params: unknown) => void;

/**
 * Wraps chrome.debugger for a single attached tab. One instance = one live
 * CDP session. Detach (deliberate or via onDetach) tears the whole thing down;
 * callers must re-attach rather than assume the session survives.
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
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url ?? tab.pendingUrl ?? '';
    if (RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new RestrictedTargetError(url);
    }

    const session = new DebuggerSession(tabId);
    try {
      await chrome.debugger.attach({ tabId }, CDP_VERSION);
    } catch (err) {
      chrome.debugger.onEvent.removeListener(session.onEventListener);
      chrome.debugger.onDetach.removeListener(session.onDetachListener);
      throw err;
    }
    return session;
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
