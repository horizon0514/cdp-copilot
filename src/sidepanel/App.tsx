import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Settings2, Sparkle } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { useAgentSession } from './hooks/useAgentSession';
import ChatThread from './components/ChatThread';
import SettingsPanel from './components/SettingsPanel';
import TabPicker from './components/TabPicker';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { cn } from './lib/utils';

interface PendingPrompt {
  tabId: number;
  selectionText?: string;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-xs border border-line bg-surface px-1 font-sans text-[9.5px] leading-[14px] text-fg-tertiary">
      {children}
    </kbd>
  );
}

export default function App() {
  const { settings, loading, save } = useSettings();
  const { messages, isStreaming, sendMessage } = useAgentSession(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !settings) setShowSettings(true);
  }, [loading, settings]);

  useEffect(() => {
    void chrome.storage.session.get('pendingPrompt').then((result) => {
      const pending = result.pendingPrompt as PendingPrompt | undefined;
      if (pending?.selectionText) {
        setInput(`Regarding this selected text: "${pending.selectionText}"\n`);
      }
      void chrome.storage.session.remove('pendingPrompt');
    });
  }, []);

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    void sendMessage(input);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const pickSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  if (loading) return null;

  const canSend = !isStreaming && input.trim().length > 0;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-accent text-accent-fg">
            <Sparkle className="size-3" strokeWidth={2.5} />
          </span>
          <h1 className="truncate text-[12.5px] font-medium tracking-[-0.015em]">cdp-copilot</h1>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(showSettings && 'bg-surface-active text-fg')}
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </header>

      {showSettings ? (
        <SettingsPanel initial={settings} onSave={save} onClose={() => settings && setShowSettings(false)} />
      ) : (
        <>
          <TabPicker />
          <ChatThread messages={messages} isStreaming={isStreaming} onPickSuggestion={pickSuggestion} />

          <form className="shrink-0 border-t border-line p-2.5" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-line bg-surface px-2.5 pt-2 pb-1.5 transition-colors duration-100 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-line">
              <Textarea
                ref={inputRef}
                rows={2}
                value={input}
                placeholder="Ask anything about this page…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 text-[10px] text-fg-tertiary select-none">
                  <Kbd>↵</Kbd> send
                  <span className="mx-0.5 text-line-strong">·</span>
                  <Kbd>⇧↵</Kbd> newline
                </span>
                <Button
                  type="submit"
                  size="icon-sm"
                  variant={canSend ? 'default' : 'subtle'}
                  disabled={!canSend}
                  aria-label="Send"
                >
                  <ArrowUp className="size-3.5" strokeWidth={2.5} />
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
