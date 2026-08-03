import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../test/chromeMock';
import { sessionRegistry } from '../debugger-bridge/sessionRegistry';
import { ensureSession, getBoundTabId, releaseStaleBinding, setBoundTabId } from './context';
import { selectPage } from '../pages/PageManager';

let mock: ChromeMock;

beforeEach(() => {
  mock = installChromeMock();
  mock.setTab(1, 'https://www.v2ex.com/', { active: true });
  mock.setTab(2, 'https://example.com/');
  setBoundTabId(null);
});

afterEach(async () => {
  await sessionRegistry.detach().catch(() => {});
  setBoundTabId(null);
  mock.restore();
});

describe('ensureSession — tab binding (#4)', () => {
  it('binds to the active tab on first attach', async () => {
    const session = await ensureSession();
    expect(session.getTabId()).toBe(1);
    expect(getBoundTabId()).toBe(1);
  });

  it('does not silently retarget when the user switches the active tab', async () => {
    await ensureSession();
    expect(getBoundTabId()).toBe(1);

    // User focuses another tab; then the debugger is externally detached.
    mock.setTab(1, 'https://www.v2ex.com/', { active: false });
    mock.setTab(2, 'https://example.com/', { active: true });
    mock.emitDetach(1, 'canceled_by_user');

    const session = await ensureSession();
    // Must reattach to the bound tab (1), not the newly active tab (2).
    expect(session.getTabId()).toBe(1);
    expect(getBoundTabId()).toBe(1);
    expect(mock.attachCalls.filter((id) => id === 2)).toEqual([]);
  });

  it('select_page explicitly rebinds the session', async () => {
    await ensureSession();
    await selectPage(2);
    expect(getBoundTabId()).toBe(2);

    mock.emitDetach(2, 'canceled_by_user');
    mock.setTab(1, 'https://www.v2ex.com/', { active: true });
    mock.setTab(2, 'https://example.com/', { active: false });

    const session = await ensureSession();
    expect(session.getTabId()).toBe(2);
  });

  it('starts a new conversation on the tab the user is actually looking at', async () => {
    await ensureSession();
    expect(getBoundTabId()).toBe(1);

    // Days later, on a different tab, the user starts a new chat.
    mock.setTab(1, 'https://www.v2ex.com/', { active: false });
    mock.setTab(2, 'https://example.com/', { active: true });
    await releaseStaleBinding();

    expect(getBoundTabId()).toBeNull();
    expect(sessionRegistry.getAttached()).toBeNull();
    expect(mock.detachCalls).toContain(1);

    const session = await ensureSession();
    expect(session.getTabId()).toBe(2);
  });

  it('keeps the attachment when the bound tab is still the active one', async () => {
    await ensureSession();
    await releaseStaleBinding();

    // Detaching here would throw away the console/network buffers for nothing.
    expect(mock.detachCalls).toEqual([]);
    expect(sessionRegistry.getAttached()?.getTabId()).toBe(1);
    expect(getBoundTabId()).toBe(1);
  });

  it('clears a remembered binding even with nothing attached', async () => {
    setBoundTabId(2);
    await releaseStaleBinding();
    expect(getBoundTabId()).toBeNull();
  });

  it('falls back to the active tab if the bound tab was closed', async () => {
    await ensureSession();
    await sessionRegistry.detach();
    setBoundTabId(99); // gone
    mock.setTab(2, 'https://example.com/', { active: true });
    mock.setTab(1, 'https://www.v2ex.com/', { active: false });

    const session = await ensureSession();
    expect(session.getTabId()).toBe(2);
    expect(getBoundTabId()).toBe(2);
  });
});
