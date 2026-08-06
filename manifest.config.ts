import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

const IS_E2E = process.env.VITE_E2E === 'true';

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  version: pkg.version,
  description: '__MSG_extDescription__',
  default_locale: 'en',
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
      description: '__MSG_commandOpenPanel__',
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
    // launchWebAuthFlow for hosted sign-in. Grants no account access on its
    // own — it opens a window and reports back where it landed.
    'identity',
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
          // Hosted mode's own endpoint: the default path must not open a
          // permission dialog on first use. Dev builds point at localhost,
          // which stays optional below.
          'https://pagehand.app/*',
          'https://api.deepseek.com/*',
          'https://api.openai.com/*',
          'https://api.anthropic.com/*',
        ],
      }),
  // The sign-in page posts the finished session here. Chrome enforces this
  // list, and it is the only reason an ordinary tab can talk to the extension
  // at all — which is what lets an emailed sign-in link work, since a link
  // opens in a tab nobody controls rather than a window we opened.
  //
  // localhost cannot appear here: Chrome requires a second-level domain, so the
  // sign-in page is always the deployed one even in development.
  externally_connectable: { matches: ['https://pagehand.app/*'] },
  minimum_chrome_version: '116',
});
