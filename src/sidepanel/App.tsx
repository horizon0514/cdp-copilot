import { useEffect, useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useAgentSession } from './hooks/useAgentSession';
import ChatThread from './components/ChatThread';
import SettingsPanel from './components/SettingsPanel';
import TabPicker from './components/TabPicker';

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
    <div className="app">
      <header className="app-header">
        <h1>cdp-copilot</h1>
        <button className="icon-button" onClick={() => setShowSettings((s) => !s)} aria-label="Settings">
          ⚙
        </button>
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
          <ChatThread messages={messages} />
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
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
            <button type="submit" disabled={isStreaming || !input.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
