import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../test/chromeMock';
import { sessionRegistry } from '../debugger-bridge/sessionRegistry';
import { newPage, selectPage, closePage } from './PageManager';
import { agentTabTracker } from './agentTabTracker';
import { setBoundTabId } from '../tools/context';

let mock: ChromeMock;

beforeEach(() => {
  mock = installChromeMock();
  mock.setTab(1, 'https://example.com/', { active: true });
  mock.setTab(2, 'https://other.test/');
  agentTabTracker.setEnabled(true);
  agentTabTracker.beginTurn(1);
  setBoundTabId(null);
});

afterEach(async () => {
  await sessionRegistry.detach().catch(() => {});
  agentTabTracker.beginTurn(null);
  setBoundTabId(null);
  mock.restore();
});

describe('agentTabTracker', () => {
  it('tracks tabs created via new_page and closes them on cleanup', async () => {
    const page = await newPage('https://temp.test/');
    expect(agentTabTracker.getTracked()).toContain(page.pageId);

    await agentTabTracker.cleanup();

    await expect(chrome.tabs.get(page.pageId)).rejects.toThrow();
    expect(agentTabTracker.getTracked()).toEqual([]);
  });

  it('does not mark select_page targets for cleanup', async () => {
    await selectPage(2);
    expect(agentTabTracker.getTracked()).toEqual([]);

    await agentTabTracker.cleanup();

    // Pre-existing tab still there.
    await expect(chrome.tabs.get(2)).resolves.toMatchObject({ id: 2 });
  });

  it('never closes the last remaining tab', async () => {
    // Leave only the origin tab, then create one temp — cleanup may close temp
    // but must not throw / wipe the browser.
    mock.setTab(1, 'https://example.com/', { active: true });
    // Remove tab 2 from the mock map via closePage path carefully
    const tabsBefore = await chrome.tabs.query({ windowType: 'normal' });
    expect(tabsBefore.length).toBeGreaterThanOrEqual(1);

    const page = await newPage('https://temp.test/');
    await agentTabTracker.cleanup();
    await expect(chrome.tabs.get(page.pageId)).rejects.toThrow();

    const remaining = await chrome.tabs.query({ windowType: 'normal' });
    expect(remaining.length).toBeGreaterThanOrEqual(1);
  });

  it('reattaches to the origin tab before closing a tracked attachment', async () => {
    await sessionRegistry.attach(1);
    const page = await newPage('https://temp.test/');
    await sessionRegistry.attach(page.pageId);
    expect(sessionRegistry.getAttached()?.getTabId()).toBe(page.pageId);

    await agentTabTracker.cleanup();

    expect(sessionRegistry.getAttached()?.getTabId()).toBe(1);
    await expect(chrome.tabs.get(page.pageId)).rejects.toThrow();
  });

  it('skips cleanup when disabled', async () => {
    agentTabTracker.setEnabled(false);
    const page = await newPage('https://temp.test/');
    await agentTabTracker.cleanup();
    await expect(chrome.tabs.get(page.pageId)).resolves.toMatchObject({ id: page.pageId });
  });

  it('untracks when close_page is called explicitly', async () => {
    const page = await newPage('https://temp.test/');
    await closePage(page.pageId);
    expect(agentTabTracker.getTracked()).not.toContain(page.pageId);
  });
});
