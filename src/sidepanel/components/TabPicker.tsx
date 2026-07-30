import { useEffect, useState } from 'react';
import { sessionRegistry } from '../../lib/debugger-bridge/sessionRegistry';
import { getBoundTabId } from '../../lib/tools/context';

/**
 * Shows the tab the agent is bound to (attached / remembered), not whichever
 * tab happens to be focused — so a mid-conversation tab switch is visible.
 */
export default function TabPicker() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [bound, setBound] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      const attachedId = sessionRegistry.getAttached()?.getTabId();
      const targetId = attachedId ?? getBoundTabId();
      if (targetId != null) {
        try {
          const t = await chrome.tabs.get(targetId);
          setTab(t);
          setBound(true);
          return;
        } catch {
          // Bound tab gone — fall through to active.
        }
      }
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      setTab(active ?? null);
      setBound(false);
    };

    void refresh();
    const unsub = sessionRegistry.onChange(() => {
      void refresh();
    });
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    chrome.tabs.onRemoved.addListener(refresh);
    return () => {
      unsub();
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
      chrome.tabs.onRemoved.removeListener(refresh);
    };
  }, []);

  if (!tab) return null;

  let host = '';
  try {
    host = tab.url ? new URL(tab.url).host : '';
  } catch {
    host = '';
  }

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-1.5 overflow-hidden border-b border-line px-3 text-[11px] text-fg-tertiary"
      title={tab.url}
    >
      <span
        className={`size-1 shrink-0 rounded-full ${bound ? 'bg-positive' : 'bg-fg-tertiary'}`}
      />
      {tab.favIconUrl && <img className="size-3 shrink-0 rounded-[2px]" src={tab.favIconUrl} alt="" />}
      <span className="shrink-0 text-fg-tertiary">{bound ? 'Bound' : 'active'}</span>
      <span className="truncate text-fg-secondary">{host || tab.title}</span>
      {host && <span className="truncate">{tab.title}</span>}
    </div>
  );
}
