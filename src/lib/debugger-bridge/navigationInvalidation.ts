import { DebuggerSession } from './DebuggerSession';

type Hook = (tabId: number) => void;

const hooks = new Set<Hook>();

/** Modules that hold per-tab, per-navigation state (uid map, console/network
 * ring buffers) register a clear-on-navigate callback here. */
export function registerNavigationHook(hook: Hook): void {
  hooks.add(hook);
}

interface FrameNavigatedParams {
  frame: { id: string; parentId?: string };
}

/** Call once right after a session attaches. Clears all registered state on
 * every main-frame navigation (matches "history since last navigation" tool semantics). */
export async function wireNavigationInvalidation(session: DebuggerSession): Promise<void> {
  const tabId = session.getTabId();
  await session.send('Page.enable');
  session.on('Page.frameNavigated', (params) => {
    const { frame } = params as FrameNavigatedParams;
    if (!frame.parentId) {
      for (const hook of hooks) hook(tabId);
    }
  });
}
