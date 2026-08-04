import { sessionRegistry } from '../lib/debugger-bridge/sessionRegistry';
import { tools } from '../lib/tools';
import { activateLedger, getActiveLedger } from '../lib/ledger/activeLedger';

/**
 * Test-only bridge. Playwright can load this page (an extension page, so it has
 * full chrome.* access) and drive the real tool layer against a real tab —
 * covering actual chrome.debugger attachment, live CDP responses, and genuine
 * input dispatch, none of which the Vitest suite can reach.
 *
 * Attachment is explicit rather than going through ensureSession()'s
 * "active tab" lookup, because under Playwright the panel page is itself a tab
 * and focus is not a reliable way to pick the target.
 *
 * Only reachable in builds made with VITE_E2E=true; installExposedTestApi is
 * dead code eliminated otherwise.
 */
export function installExposedTestApi(): void {
  Object.assign(window, {
    __cdp: {
      attach: (tabId: number) => sessionRegistry.attach(tabId),
      detach: () => sessionRegistry.detach(),
      attachedTabId: () => sessionRegistry.getAttached()?.getTabId() ?? null,

      /** Invoke a tool exactly as the agent loop would. */
      call: async (name: string, args: unknown = {}) => {
        const registry = tools as unknown as Record<
          string,
          { execute: (input: unknown, options: unknown) => Promise<unknown> }
        >;
        const tool = registry[name];
        if (!tool) throw new Error(`No such tool: ${name}`);
        return tool.execute(args, { toolCallId: 'e2e', messages: [] });
      },

      toolNames: () => Object.keys(tools),

      // The ledger tools write to whichever ledger is active. In the app the
      // side panel activates one per thread; tests set it explicitly for the
      // same reason attachment is explicit — deterministic control beats
      // depending on React mount timing.
      ledger: {
        activate: (threadId: string) => activateLedger(threadId),
        get: () => getActiveLedger(),
      },
    },
  });
}
