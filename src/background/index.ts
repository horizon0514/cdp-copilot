// Intentionally thin: no agent state, no tool execution.
// The side panel document is the brain (see src/sidepanel). This file wires
// install-time setup, the context-menu handoff, and reliable debugger detach
// when the side panel closes (pagehide alone is best-effort during teardown).

import { installContextMenus, watchContextMenuLocale } from './contextMenus';

interface PendingPrompt {
  tabId: number;
  selectionText?: string;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void installContextMenus();
});

watchContextMenuLocale();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined) return;

  const pending: PendingPrompt = {
    tabId: tab.id,
    selectionText: info.menuItemId === 'cdp-copilot-ask-selection' ? info.selectionText : undefined,
  };

  void chrome.storage.session.set({ pendingPrompt: pending }).then(() => {
    void chrome.sidePanel.open({ tabId: tab.id! });
  });
});

/**
 * Side panel opens a long-lived port on load. When the panel is closed the port
 * disconnects and we detach every debugger target this extension still holds —
 * that's what clears Chrome's "cdp-copilot is debugging this browser" banner.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'cdp-copilot-sidepanel') return;

  port.onDisconnect.addListener(() => {
    void chrome.debugger.getTargets().then((targets) => {
      for (const target of targets) {
        if (!target.attached || target.tabId == null) continue;
        // detach only succeeds for attachments we own; foreign (DevTools) ones throw.
        void chrome.debugger.detach({ tabId: target.tabId }).catch(() => {});
      }
    });
  });
});
