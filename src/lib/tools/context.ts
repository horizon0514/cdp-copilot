import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { sessionRegistry } from '../debugger-bridge/sessionRegistry';

/**
 * Tab the agent is bound to for this side-panel session. Once set, ensureSession
 * reattaches here instead of silently following the browser's active tab (#4).
 * Explicit select_page / attach updates the binding.
 */
let boundTabId: number | null = null;

export function getBoundTabId(): number | null {
  return boundTabId;
}

export function setBoundTabId(tabId: number | null): void {
  boundTabId = tabId;
}

async function resolveActiveTabId(): Promise<number | undefined> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id;
}

/**
 * Returns the currently attached session, attaching to the bound tab (or the
 * active tab on first use) if nothing is attached yet.
 */
export async function ensureSession(): Promise<DebuggerSession> {
  const existing = sessionRegistry.getAttached();
  if (existing) {
    boundTabId = existing.getTabId();
    return existing;
  }

  let targetId = boundTabId;
  if (targetId != null) {
    try {
      await chrome.tabs.get(targetId);
    } catch {
      // Bound tab was closed — fall back to active rather than dying silently.
      boundTabId = null;
      targetId = null;
    }
  }

  if (targetId == null) {
    targetId = (await resolveActiveTabId()) ?? null;
  }
  if (targetId == null) {
    throw new Error('No active tab found to automate. Open a page first.');
  }

  boundTabId = targetId;
  return sessionRegistry.attach(targetId);
}
