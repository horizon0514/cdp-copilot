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
    <div title={tab.url} style={{ fontSize: 11, color: '#666', padding: '0 12px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {tab.title || tab.url}
    </div>
  );
}
