import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { sessionRegistry } from '../../lib/debugger-bridge/sessionRegistry';
import { getBoundTabId } from '../../lib/tools/context';
import { Badge } from './ui/badge';

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
      className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-b border-line bg-bg px-3 text-[11px]"
      title={tab.url}
    >
      <Badge variant={bound ? 'positive' : 'neutral'} className="shrink-0 gap-1">
        <span className={`size-1.5 rounded-full ${bound ? 'bg-positive' : 'bg-fg-tertiary'}`} aria-hidden />
        {bound ? 'Bound' : 'active'}
      </Badge>
      {tab.favIconUrl ? (
        <img className="size-3.5 shrink-0 rounded-[3px]" src={tab.favIconUrl} alt="" />
      ) : (
        <Link2 className="size-3 shrink-0 text-fg-tertiary" aria-hidden />
      )}
      <span className="min-w-0 truncate font-medium text-fg-secondary">{host || tab.title}</span>
      {host && tab.title && (
        <span className="min-w-0 truncate text-fg-tertiary">{tab.title}</span>
      )}
    </div>
  );
}
