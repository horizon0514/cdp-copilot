import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { sessionRegistry } from '../lib/debugger-bridge/sessionRegistry';
import './styles.css';

// Statically false in normal builds, so this branch and the chunk it imports
// are dropped entirely. Only present when built with VITE_E2E=true.
if (import.meta.env.VITE_E2E === 'true') {
  void import('../e2e/hook').then((m) => m.installExposedTestApi());
}

// Keep a port open for the lifetime of the side panel. Background detaches the
// debugger when this port drops (panel closed / crashed).
const sidepanelPort = chrome.runtime.connect({ name: 'cdp-copilot-sidepanel' });
sidepanelPort.onDisconnect.addListener(() => {
  // Local cleanup if the document is still alive long enough.
  void sessionRegistry.detach().catch(() => {});
});

window.addEventListener('pagehide', () => {
  void sessionRegistry.detach().catch(() => {});
});

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
