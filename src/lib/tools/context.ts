import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { sessionRegistry } from '../debugger-bridge/sessionRegistry';

/** Returns the currently attached session, auto-attaching to the active tab
 * in the current window if nothing is attached yet — most tool calls should
 * "just work" against whatever tab the user is looking at. */
export async function ensureSession(): Promise<DebuggerSession> {
  const existing = sessionRegistry.getAttached();
  if (existing) return existing;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id === undefined) {
    throw new Error('No active tab found to automate. Open a page first.');
  }
  return sessionRegistry.attach(activeTab.id);
}
