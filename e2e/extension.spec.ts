import { test, expect } from './extension';

test('loads with a registered service worker and the expected manifest', async ({
  context,
  extensionId,
  panel,
}) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  expect(context.serviceWorkers()).not.toHaveLength(0);

  const manifest = await panel.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(
    expect.arrayContaining(['sidePanel', 'debugger', 'tabs', 'storage']),
  );
  expect(manifest.side_panel?.default_path).toContain('sidepanel');
});

test('side panel renders without console errors', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
  await expect(page.getByRole('heading', { name: 'cdp-copilot' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('shows settings first when no provider is configured', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

  // A fresh profile has no stored key, so the panel must ask for one rather
  // than presenting a chat box that cannot work.
  await expect(page.getByLabel(/API key/i)).toBeVisible();
});

test('persists provider settings to chrome.storage.local', async ({ panel }) => {
  await panel.evaluate(() =>
    chrome.storage.local.set({
      'cdp-copilot:settings': {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        model: 'test-model',
        baseURL: 'http://localhost:5599/v1',
      },
    }),
  );

  const stored = await panel.evaluate(async () => {
    const r = await chrome.storage.local.get('cdp-copilot:settings');
    return r['cdp-copilot:settings'];
  });

  expect(stored).toMatchObject({ provider: 'openai-compatible', model: 'test-model' });

  // Keys must never be written to synced storage.
  const synced = await panel.evaluate(() => chrome.storage.sync.get(null));
  expect(JSON.stringify(synced)).not.toContain('test-key');
});

test('exposes the full v1 tool set', async ({ panel }) => {
  const names = await panel.evaluate(() => window.__cdp.toolNames());

  expect(names).toEqual(
    expect.arrayContaining([
      'take_snapshot',
      'click',
      'hover',
      'fill',
      'fill_form',
      'type_text',
      'press_key',
      'navigate_page',
      'new_page',
      'list_pages',
      'select_page',
      'close_page',
      'wait_for',
      'evaluate_script',
      'take_screenshot',
      'list_console_messages',
      'get_console_message',
      'list_network_requests',
      'get_network_request',
    ]),
  );
});
