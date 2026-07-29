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
    <div className="tab-picker" title={tab.url}>
      {tab.favIconUrl ? (
        <img className="tab-favicon" src={tab.favIconUrl} alt="" />
      ) : (
        <span className="tab-favicon-placeholder" />
      )}
      <span className="tab-title">{tab.title || tab.url}</span>
    </div>
  );
}
