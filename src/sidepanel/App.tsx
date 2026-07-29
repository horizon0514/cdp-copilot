import { useEffect, useState } from 'react';
import { Settings2, SendHorizontal, Sparkles } from 'lucide-react';
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

export default function App() {
  const { settings, loading, save } = useSettings();
  const { messages, isStreaming, sendMessage } = useAgentSession(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState('');

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

  if (loading) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-sm">
            <Sparkles className="size-3.5" />
          </span>
          <h1 className="truncate text-[13px] font-semibold tracking-tight">cdp-copilot</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(showSettings && 'bg-primary-soft text-primary')}
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </header>

      {showSettings ? (
        <SettingsPanel
          initial={settings}
          onSave={save}
          onClose={() => settings && setShowSettings(false)}
        />
      ) : (
        <>
          <TabPicker />
          <ChatThread messages={messages} isStreaming={isStreaming} />
          <form
            className="flex shrink-0 items-end gap-2 border-t border-border bg-card p-2.5"
            onSubmit={handleSubmit}
          >
            <Textarea
              rows={2}
              value={input}
              placeholder="Ask me to read or automate this page…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label="Send">
              <SendHorizontal className="size-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
