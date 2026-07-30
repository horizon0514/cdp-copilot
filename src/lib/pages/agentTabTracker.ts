import { sessionRegistry } from '../debugger-bridge/sessionRegistry';

/**
 * Tracks tabs the agent opened via new_page during the current turn so we can
 * close them when the turn ends. Pre-existing tabs (and select_page targets)
 * are never tracked.
 */
class AgentTabTracker {
  private created = new Set<number>();
  private originTabId: number | null = null;
  /** Issue #12 setting — default on. */
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Call at the start of each agent turn. */
  beginTurn(originTabId: number | null): void {
    this.created.clear();
    this.originTabId = originTabId;
  }

  trackCreated(tabId: number): void {
    this.created.add(tabId);
  }

  untrack(tabId: number): void {
    this.created.delete(tabId);
  }

  /** Tab ids opened this turn (for tests). */
  getTracked(): number[] {
    return [...this.created];
  }

  /**
   * Close agent-created tabs. If still attached to one of them, reattach to the
   * turn's origin tab first (or detach if that isn't possible).
   */
  async cleanup(): Promise<void> {
    const toClose = [...this.created];
    this.created.clear();
    if (!this.enabled || toClose.length === 0) return;

    const attached = sessionRegistry.getAttached();
    if (attached && toClose.includes(attached.getTabId())) {
      const origin = this.originTabId;
      if (origin != null && !toClose.includes(origin)) {
        try {
          await sessionRegistry.attach(origin);
        } catch {
          await sessionRegistry.detach().catch(() => {});
        }
      } else {
        await sessionRegistry.detach().catch(() => {});
      }
    }

    for (const tabId of toClose) {
      try {
        const remaining = await chrome.tabs.query({ windowType: 'normal' });
        if (remaining.length <= 1) continue;
        if (sessionRegistry.getAttached()?.getTabId() === tabId) {
          await sessionRegistry.detach().catch(() => {});
        }
        await chrome.tabs.remove(tabId);
      } catch {
        // Last tab, already closed, etc. — never fail the turn over cleanup.
      }
    }
  }
}

export const agentTabTracker = new AgentTabTracker();
