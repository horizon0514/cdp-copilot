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
        <div className="brand">
          <span className="brand-mark" />
          <h1>cdp-copilot</h1>
        </div>
        <button
          className={`icon-button${showSettings ? ' active' : ''}`}
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
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
          <ChatThread messages={messages} isStreaming={isStreaming} />
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
            <button type="submit" disabled={isStreaming || !input.trim()} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}
