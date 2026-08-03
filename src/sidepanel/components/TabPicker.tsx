import { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { sessionRegistry } from '../../lib/debugger-bridge/sessionRegistry';
import { getBoundTabId } from '../../lib/tools/context';
import { selectPage } from '../../lib/pages/PageManager';
import { useConversationStore } from '../state/conversationStore';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

function hostOf(tab: chrome.tabs.Tab | null): string {
  if (!tab?.url) return tab?.title ?? '';
  try {
    return new URL(tab.url).host || tab.title || '';
  } catch {
    return tab.title ?? '';
  }
}

/**
 * Shows the tab the agent acts on — the bound one, not whichever is focused —
 * and, when those have drifted apart, says so and offers the one click that
 * fixes it. Binding deliberately never follows the active tab on its own (#4),
 * which is only safe if the mismatch is impossible to miss.
 */
export default function TabPicker() {
  const [target, setTarget] = useState<chrome.tabs.Tab | null>(null);
  const [active, setActive] = useState<chrome.tabs.Tab | null>(null);
  const [bound, setBound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const isStreaming = useConversationStore((s) => s.isStreaming);

  const refresh = useCallback(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setActive(activeTab ?? null);

    const targetId = sessionRegistry.getAttached()?.getTabId() ?? getBoundTabId();
    if (targetId != null) {
      try {
        setTarget(await chrome.tabs.get(targetId));
        setBound(true);
        return;
      } catch {
        // Bound tab is gone — ensureSession will fall back to the active one.
      }
    }
    setTarget(activeTab ?? null);
    setBound(false);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const unsub = sessionRegistry.onChange(onChange);
    chrome.tabs.onActivated.addListener(onChange);
    chrome.tabs.onUpdated.addListener(onChange);
    chrome.tabs.onRemoved.addListener(onChange);
    return () => {
      unsub();
      chrome.tabs.onActivated.removeListener(onChange);
      chrome.tabs.onUpdated.removeListener(onChange);
      chrome.tabs.onRemoved.removeListener(onChange);
    };
  }, [refresh]);

  const switchToActive = async () => {
    if (active?.id == null) return;
    setSwitching(true);
    setError(null);
    try {
      // Same path the model's select_page takes, so both rebind identically.
      await selectPage(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(false);
      void refresh();
    }
  };

  if (!target) return null;

  const drifted = bound && active?.id != null && active.id !== target.id;
  const host = hostOf(target);

  return (
    <div className="shrink-0 border-b border-line bg-bg">
      <div className="flex h-8 items-center gap-2 overflow-hidden px-3 text-[11px]" title={target.url}>
        <Badge variant={bound ? (drifted ? 'caution' : 'positive') : 'neutral'} className="shrink-0 gap-1">
          <span
            className={`size-1.5 rounded-full ${bound ? (drifted ? 'bg-caution' : 'bg-positive') : 'bg-fg-tertiary'}`}
            aria-hidden
          />
          {bound ? 'Bound' : 'active'}
        </Badge>
        {target.favIconUrl ? (
          <img className="size-3.5 shrink-0 rounded-[3px]" src={target.favIconUrl} alt="" />
        ) : (
          <Link2 className="size-3 shrink-0 text-fg-tertiary" aria-hidden />
        )}
        <span className="min-w-0 truncate font-medium text-fg-secondary">{host || target.title}</span>
        {host && target.title && <span className="min-w-0 truncate text-fg-tertiary">{target.title}</span>}
      </div>

      {drifted && (
        <div className="flex items-center gap-2 border-t border-line bg-caution-soft px-3 py-1.5 text-[11px] leading-[1.4] text-caution">
          <span className="min-w-0 flex-1">
            Acting on <span className="font-medium">{host}</span> — you're viewing{' '}
            <span className="font-medium">{hostOf(active)}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void switchToActive()}
            // Rebinding mid-turn would pull the page out from under the agent.
            disabled={isStreaming || switching}
            title={isStreaming ? 'Stop the agent first' : `Move the agent to ${hostOf(active)}`}
          >
            {switching ? 'Switching…' : 'Switch here'}
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="border-t border-negative-line bg-negative-soft px-3 py-1.5 text-[11px] leading-[1.4] text-negative"
        >
          {error}
        </div>
      )}
    </div>
  );
}
