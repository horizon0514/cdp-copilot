import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

const IS_E2E = process.env.VITE_E2E === 'true';

export default defineManifest({
  manifest_version: 3,
  name: 'cdp-copilot',
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  // openPanelOnActionClick is set at install, so triggering the action opens the
  // panel — a tool that claims to be at hand shouldn't need the mouse to reach.
  // Remappable at chrome://extensions/shortcuts if this collides with something.
  commands: {
    _execute_action: {
      suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
      description: 'Open the cdp-copilot side panel',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: [
    'sidePanel',
    'debugger',
    'tabs',
    'storage',
    'activeTab',
    'contextMenus',
    // Inject the screenshot lightbox onto the page tab (full viewport), not just the side panel.
    'scripting',
  ],
  // In E2E builds the wildcard hosts are pre-granted, because
  // chrome.permissions.request() raises a native dialog that Playwright cannot
  // dismiss. Normal builds keep them optional and ask at runtime.
  ...(IS_E2E
    ? { host_permissions: ['https://*/*', 'http://localhost/*'] }
    : {
        optional_host_permissions: ['https://*/*', 'http://localhost/*'],
        // Mirrored by DEFAULT_HOST_ORIGINS in SettingsPanel.tsx.
        host_permissions: [
          'https://api.deepseek.com/*',
          'https://api.openai.com/*',
          'https://api.anthropic.com/*',
        ],
      }),
  minimum_chrome_version: '116',
});
