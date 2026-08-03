import { test, expect, callTool, uidFor, type SnapshotResult } from './extension';
import type { Page } from '@playwright/test';

/**
 * These exercise the real thing: an actual chrome.debugger attachment, live CDP
 * responses from a real renderer, and input dispatched through the browser.
 */

/** Reload through the tool layer so page scripts run *while* attached, then wait
 * for the fixture's delayed write as proof scripts finished. */
async function reloadWhileAttached(panel: Page, page: Page) {
  await callTool(panel, 'navigate_page', { type: 'reload' });
  await expect(page.locator('#delayed')).toHaveText(/delayed content arrived/);
}

test('attaches the debugger to the target tab', async ({ panel, openTarget }) => {
  const { tabId } = await openTarget('/page.html');
  expect(await panel.evaluate(() => window.__cdp.attachedTabId())).toBe(tabId);
});

test('take_snapshot returns the live accessibility tree with usable uids', async ({
  panel,
  openTarget,
}) => {
  await openTarget('/page.html');
  const result = await callTool<SnapshotResult>(panel, 'take_snapshot');

  expect(result.url).toContain('/page.html');
  expect(result.uidCount).toBeGreaterThan(3);
  expect(result.truncated).toBe(false);
  // Real roles and names computed by Chrome, not a DOM dump.
  expect(result.snapshot).toContain('Fixture Page');
  expect(result.snapshot).toMatch(/button "Clicked 0 times" \[uid=\d+\]/);
  expect(uidFor(result.snapshot, 'Clicked 0 times')).toMatch(/^\d+$/);
});

test('click dispatches a real event that runs the page handler', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');

  await callTool(panel, 'click', { uid: uidFor(snapshot, 'Clicked 0 times') });

  // Proof the click reached the page's own listener, not just the DOM.
  await expect(page.locator('#counter')).toHaveText('Clicked 1 times');
});

test('fill replaces a pre-filled value instead of appending to it', async ({
  panel,
  openTarget,
}) => {
  const { page } = await openTarget('/page.html');
  expect(await page.inputValue('#search')).toBe('existing value');

  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');
  await callTool(panel, 'fill', { uid: uidFor(snapshot, 'Search'), value: 'replaced' });

  // Regression guard: a bare Input.insertText would yield "existing valuereplaced".
  expect(await page.inputValue('#search')).toBe('replaced');
});

test('fill_form sets several fields in one call', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');

  await callTool(panel, 'fill_form', {
    elements: [
      { uid: uidFor(snapshot, 'Search'), value: 'aaa' },
      { uid: uidFor(snapshot, 'Typed'), value: 'bbb' },
    ],
  });

  expect(await page.inputValue('#search')).toBe('aaa');
  expect(await page.inputValue('#typed')).toBe('bbb');
});

test('type_text produces genuine keyboard events', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');

  await callTool(panel, 'click', { uid: uidFor(snapshot, 'Typed') });
  await callTool(panel, 'type_text', { text: 'hi' });

  expect(await page.inputValue('#typed')).toBe('hi');
  // The page saw real keydown events — a JS value assignment would not fire these.
  expect(await page.evaluate(() => window.__keys)).toEqual(['h', 'i']);
});

test('press_key sends named keys', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');

  await callTool(panel, 'click', { uid: uidFor(snapshot, 'Typed') });
  await callTool(panel, 'press_key', { key: 'Enter' });

  expect(await page.evaluate(() => window.__keys)).toContain('Enter');
});

test('evaluate_script runs in the page and returns JSON', async ({ panel, openTarget }) => {
  await openTarget('/page.html');

  const result = await callTool<{ value: unknown }>(panel, 'evaluate_script', {
    function: '() => ({ title: document.title, buttons: document.querySelectorAll("button").length })',
  });

  expect(result.value).toEqual({ title: 'pagehand e2e fixture', buttons: 1 });
});

test('evaluate_script surfaces a page exception as a tool error', async ({ panel, openTarget }) => {
  await openTarget('/page.html');

  await expect(
    callTool(panel, 'evaluate_script', { function: '() => { throw new Error("boom from page") }' }),
  ).rejects.toThrow(/boom from page/);
});

test('take_screenshot captures the real viewport', async ({ panel, openTarget }) => {
  await openTarget('/page.html');
  const result = await callTool<{ image: string }>(panel, 'take_screenshot');

  expect(result.image).toMatch(/^data:image\/png;base64,/);
  expect(result.image.length).toBeGreaterThan(1000);
});

test('wait_for resolves once delayed text appears', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  await callTool(panel, 'navigate_page', { type: 'reload' });

  // Written 300ms after load, so this genuinely has to wait.
  const result = await callTool<{ found: boolean }>(panel, 'wait_for', {
    text: ['delayed content arrived'],
    timeout: 5000,
  });

  expect(result.found).toBe(true);
  await expect(page.locator('#delayed')).toHaveText(/delayed/);
});

test('wait_for reports not-found rather than hanging', async ({ panel, openTarget }) => {
  await openTarget('/page.html');

  const result = await callTool<{ found: boolean }>(panel, 'wait_for', {
    text: ['text that never appears'],
    timeout: 600,
  });

  expect(result.found).toBe(false);
});

test('captures console messages emitted by the real page', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  await reloadWhileAttached(panel, page);

  const { messages } = await callTool<{ messages: { level: string; text: string }[] }>(
    panel,
    'list_console_messages',
  );

  expect(messages.map((m) => m.text)).toContain('fixture console error');
  const errorsOnly = await callTool<{ messages: { text: string }[] }>(panel, 'list_console_messages', {
    types: ['error'],
  });
  expect(errorsOnly.messages.map((m) => m.text)).toContain('fixture console error');
  expect(errorsOnly.messages.map((m) => m.text)).not.toContain('fixture console log');
});

test('captures real network requests including status', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  await reloadWhileAttached(panel, page);

  const { requests } = await callTool<
    { requests: { reqid: number; url: string; method: string; status?: number }[] }
  >(panel, 'list_network_requests');

  const api = requests.find((r) => r.url.includes('/api/data.json'));
  expect(api, `no /api/data.json in ${JSON.stringify(requests.map((r) => r.url))}`).toBeDefined();
  expect(api).toMatchObject({ method: 'GET', status: 200 });

  const detail = await callTool<{ url: string; body: string | null }>(panel, 'get_network_request', {
    reqid: api!.reqid,
  });
  expect(detail.body).toContain('"ok":true');
});

test('navigate_page follows a URL and clears per-page state', async ({ panel, openTarget }) => {
  const { page } = await openTarget('/page.html');
  await reloadWhileAttached(panel, page);

  expect(
    (await callTool<{ messages: unknown[] }>(panel, 'list_console_messages')).messages.length,
  ).toBeGreaterThan(0);

  await callTool(panel, 'navigate_page', { type: 'url', url: 'http://localhost:5599/other.html' });
  await expect(page.locator('#heading')).toHaveText('Other Page');

  // Console and network history are scoped to the current navigation.
  const after = await callTool<{ messages: unknown[] }>(panel, 'list_console_messages');
  expect(after.messages).toHaveLength(0);
  const net = await callTool<{ requests: unknown[] }>(panel, 'list_network_requests');
  expect(net.requests).toHaveLength(0);
});

test('a uid from before a navigation fails loudly instead of hitting the wrong node', async ({
  panel,
  openTarget,
}) => {
  const { page } = await openTarget('/page.html');
  const { snapshot } = await callTool<SnapshotResult>(panel, 'take_snapshot');
  const staleUid = uidFor(snapshot, 'Clicked 0 times');

  await callTool(panel, 'navigate_page', { type: 'url', url: 'http://localhost:5599/other.html' });
  await expect(page.locator('#heading')).toHaveText('Other Page');

  await expect(callTool(panel, 'click', { uid: staleUid })).rejects.toThrow(/take_snapshot again/);
});

test('lists open pages and can open and close one', async ({ panel, openTarget }) => {
  await openTarget('/page.html');

  const opened = await callTool<{ pageId: number; url: string }>(panel, 'new_page', {
    url: 'http://localhost:5599/other.html',
  });
  expect(opened.url).toContain('other.html');

  const { pages } = await callTool<{ pages: { pageId: number }[] }>(panel, 'list_pages');
  expect(pages.map((p) => p.pageId)).toContain(opened.pageId);

  await callTool(panel, 'close_page', { pageId: opened.pageId });
  const after = await callTool<{ pages: { pageId: number }[] }>(panel, 'list_pages');
  expect(after.pages.map((p) => p.pageId)).not.toContain(opened.pageId);
});

test('concurrent tool calls share one attachment instead of colliding', async ({
  panel,
  openTarget,
}) => {
  const { tabId } = await openTarget('/page.html');
  await panel.evaluate(() => window.__cdp.detach());

  // The SDK runs a step's tool calls in parallel, so this is the everyday path.
  // Chrome rejects a second attach to the same tab, which surfaced to the model
  // as "another debugger is already attached".
  const results = await panel.evaluate(async (id) => {
    const settled = await Promise.allSettled([
      window.__cdp.attach(id),
      window.__cdp.attach(id),
      window.__cdp.attach(id),
    ]);
    return settled.map((s) => (s.status === 'rejected' ? String(s.reason) : 'ok'));
  }, tabId);

  expect(results).toEqual(['ok', 'ok', 'ok']);
  expect(await panel.evaluate(() => window.__cdp.attachedTabId())).toBe(tabId);

  // And the shared session is actually usable afterwards.
  const snap = await callTool<SnapshotResult>(panel, 'take_snapshot');
  expect(snap.snapshot).toContain('Fixture Page');
});

test('recovers when a previous attachment was left behind', async ({ panel, openTarget }) => {
  const { tabId } = await openTarget('/page.html');

  // Attach out-of-band and drop our bookkeeping, mimicking a panel that was
  // closed without detaching. Re-attaching must reclaim it, not fail.
  await panel.evaluate(async (id) => {
    await window.__cdp.detach();
    await chrome.debugger.attach({ tabId: id }, '1.3');
  }, tabId);

  await panel.evaluate((id) => window.__cdp.attach(id), tabId);

  const snap = await callTool<SnapshotResult>(panel, 'take_snapshot');
  expect(snap.snapshot).toContain('Fixture Page');
});

test('refuses to attach to a restricted page', async ({ panel }) => {
  // chrome-extension:// pages cannot be debugged; the failure must be legible.
  await expect(
    panel.evaluate(async () => {
      const self = await chrome.tabs.getCurrent();
      return window.__cdp.attach(self!.id!);
    }),
  ).rejects.toThrow(/Can't automate this page/);
});
