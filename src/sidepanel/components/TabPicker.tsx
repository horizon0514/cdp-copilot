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
      <span className="size-1 shrink-0 rounded-full bg-positive" />
      {tab.favIconUrl && <img className="size-3 shrink-0 rounded-[2px]" src={tab.favIconUrl} alt="" />}
      <span className="truncate text-fg-secondary">{host || tab.title}</span>
      {host && <span className="truncate">{tab.title}</span>}
    </div>
  );
}
