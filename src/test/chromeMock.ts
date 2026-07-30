type Listener = (...args: unknown[]) => void;

export interface ChromeMock {
  /** Every tabId passed to chrome.debugger.attach, including rejected attempts. */
  attachCalls: number[];
  detachCalls: number[];
  sentCommands: { tabId: number; method: string }[];
  setTab(id: number, url: string, opts?: { active?: boolean }): void;
  /** Marks the tab as held by a debugger we do NOT own (e.g. open DevTools):
   * attach is refused and detach fails, because it isn't ours to release. */
  simulateForeignDebugger(tabId: number): void;
  /** Leaves an attachment behind as if a previous panel context vanished
   * without detaching — still ours, so it can be reclaimed. */
  orphanAttachment(tabId: number): void;
  emitDetach(tabId: number, reason: string): void;
  emitEvent(tabId: number, method: string, params?: unknown): void;
  restore(): void;
}

/**
 * Fake chrome.* surface for the modules that touch it. Deliberately reproduces
 * Chrome's real refusal to attach twice to the same tab, since that behaviour is
 * exactly what the code under test has to avoid tripping.
 */
export function installChromeMock(): ChromeMock {
  const tabs = new Map<number, { id: number; url: string; active: boolean }>();
  const attachedTabs = new Set<number>();
  const foreignDebuggers = new Set<number>();
  const sessionStore: Record<string, unknown> = {};
  const eventListeners: Listener[] = [];
  const detachListeners: Listener[] = [];

  const mock: ChromeMock = {
    attachCalls: [],
    detachCalls: [],
    sentCommands: [],
    setTab(id, url, opts) {
      tabs.set(id, { id, url, active: opts?.active ?? false });
    },
    simulateForeignDebugger(tabId) {
      foreignDebuggers.add(tabId);
    },
    orphanAttachment(tabId) {
      attachedTabs.add(tabId);
    },
    emitDetach(tabId, reason) {
      attachedTabs.delete(tabId);
      for (const l of [...detachListeners]) l({ tabId }, reason);
    },
    emitEvent(tabId, method, params) {
      for (const l of [...eventListeners]) l({ tabId }, method, params);
    },
    restore() {
      delete (globalThis as { chrome?: unknown }).chrome;
    },
  };

  const chrome = {
    debugger: {
      async attach({ tabId }: { tabId: number }) {
        mock.attachCalls.push(tabId);
        if (attachedTabs.has(tabId) || foreignDebuggers.has(tabId)) {
          // Chrome's actual error text for a second attachment.
          throw new Error(`Another debugger is already attached to the tab with id: ${tabId}.`);
        }
        attachedTabs.add(tabId);
      },
      async detach({ tabId }: { tabId: number }) {
        mock.detachCalls.push(tabId);
        // An extension can only release its own attachment.
        if (!attachedTabs.delete(tabId)) throw new Error('Debugger is not attached');
      },
      async sendCommand({ tabId }: { tabId: number }, method: string) {
        if (!attachedTabs.has(tabId)) throw new Error('Debugger is not attached');
        mock.sentCommands.push({ tabId, method });
        return {};
      },
      onEvent: {
        addListener: (l: Listener) => eventListeners.push(l),
        removeListener: (l: Listener) => {
          const i = eventListeners.indexOf(l);
          if (i >= 0) eventListeners.splice(i, 1);
        },
      },
      onDetach: {
        addListener: (l: Listener) => detachListeners.push(l),
        removeListener: (l: Listener) => {
          const i = detachListeners.indexOf(l);
          if (i >= 0) detachListeners.splice(i, 1);
        },
      },
      async getTargets() {
        return [...attachedTabs].map((tabId) => ({
          tabId,
          attached: true,
          type: 'page',
        }));
      },
    },

    tabs: {
      async get(id: number) {
        const tab = tabs.get(id);
        if (!tab) throw new Error(`No tab with id: ${id}`);
        return { ...tab, status: 'complete' as const };
      },
      async query(info?: { active?: boolean; windowType?: string }) {
        const all = [...tabs.values()];
        if (info?.active) return all.filter((t) => t.active);
        return all;
      },
      async create({ url, active }: { url: string; active?: boolean }) {
        const id = Math.max(0, ...tabs.keys()) + 1;
        // Creating an active tab deactivates the others (matches Chrome).
        if (active !== false) {
          for (const t of tabs.values()) t.active = false;
        }
        tabs.set(id, { id, url, active: active ?? true });
        return { id, url, active: active ?? true, status: 'complete' };
      },
      async remove(id: number | number[]) {
        for (const tabId of Array.isArray(id) ? id : [id]) {
          tabs.delete(tabId);
          attachedTabs.delete(tabId);
        }
      },
      async update(id: number, props: { active?: boolean }) {
        const tab = tabs.get(id);
        if (tab && props.active !== undefined) {
          if (props.active) {
            for (const t of tabs.values()) t.active = false;
          }
          tab.active = props.active;
        }
        return tab;
      },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      onActivated: { addListener: () => {}, removeListener: () => {} },
      onRemoved: { addListener: () => {}, removeListener: () => {} },
    },

    runtime: {
      connect: () => ({
        name: 'cdp-copilot-sidepanel',
        onDisconnect: { addListener: () => {}, removeListener: () => {} },
        disconnect: () => {},
      }),
    },

    windows: {
      async getCurrent() {
        return { id: 1 };
      },
    },

    storage: {
      session: {
        async get(key: string) {
          return key in sessionStore ? { [key]: sessionStore[key] } : {};
        },
        async set(items: Record<string, unknown>) {
          Object.assign(sessionStore, items);
        },
        async remove(key: string) {
          delete sessionStore[key];
        },
      },
    },
  };

  (globalThis as { chrome?: unknown }).chrome = chrome;
  return mock;
}
