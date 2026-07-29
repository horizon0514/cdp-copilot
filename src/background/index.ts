// Intentionally thin: no debugger calls, no agent state, no message relaying.
// The side panel document is the brain (see src/sidepanel) — this file only
// wires up install-time setup and the context-menu -> side panel handoff.

interface PendingPrompt {
  tabId: number;
  selectionText?: string;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: 'cdp-copilot-ask-page',
    title: 'Ask AI about this page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'cdp-copilot-ask-selection',
    title: 'Ask AI about selection',
    contexts: ['selection'],
  });
});

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
