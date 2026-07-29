import { useEffect, useState } from 'react';

export default function TabPicker() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);

  useEffect(() => {
    const refresh = () => {
      void chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab(t ?? null));
    };
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    return () => {
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
    };
  }, []);

  if (!tab) return null;

  return (
    <div
      className="flex items-center gap-1.5 overflow-hidden border-b border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
      title={tab.url}
    >
      {tab.favIconUrl ? (
        <img className="size-3 shrink-0 rounded-xs" src={tab.favIconUrl} alt="" />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />
      )}
      <span className="truncate">{tab.title || tab.url}</span>
    </div>
  );
}
