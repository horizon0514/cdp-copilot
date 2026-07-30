import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../test/chromeMock';
import { sessionRegistry } from './sessionRegistry';
import { RestrictedTargetError } from './DebuggerSession';
import { ensureSession } from '../tools/context';

let mock: ChromeMock;

beforeEach(() => {
  mock = installChromeMock();
  mock.setTab(1, 'https://www.v2ex.com/', { active: true });
  mock.setTab(2, 'https://example.com/');
  mock.setTab(3, 'chrome://version');
});

afterEach(async () => {
  await sessionRegistry.detach().catch(() => {});
  mock.restore();
});

describe('sessionRegistry — concurrent access', () => {
  it('attaches once when several tools race to attach to the same tab', async () => {
    // The SDK runs a step's tool calls in parallel, so this is the normal case,
    // not an edge case. Chrome rejects a second attach to the same tab.
    const sessions = await Promise.all([
      sessionRegistry.attach(1),
      sessionRegistry.attach(1),
      sessionRegistry.attach(1),
    ]);

    expect(mock.attachCalls).toEqual([1]);
    expect(new Set(sessions).size).toBe(1);
  });

  it('attaches once when tools race through ensureSession()', async () => {
    const sessions = await Promise.all([ensureSession(), ensureSession(), ensureSession()]);

    expect(mock.attachCalls).toEqual([1]);
    expect(new Set(sessions).size).toBe(1);
    expect(sessions[0].getTabId()).toBe(1);
  });

  it('serialises a switch to another tab', async () => {
    await sessionRegistry.attach(1);

    await Promise.all([sessionRegistry.attach(2), sessionRegistry.attach(2)]);

    expect(mock.attachCalls).toEqual([1, 2]);
    expect(mock.detachCalls).toEqual([1]);
    expect(sessionRegistry.getAttached()?.getTabId()).toBe(2);
  });

  it('reuses the existing session instead of re-attaching', async () => {
    const first = await sessionRegistry.attach(1);
    const second = await sessionRegistry.attach(1);

    expect(second).toBe(first);
    expect(mock.attachCalls).toEqual([1]);
  });
});

describe('sessionRegistry — failure handling', () => {
  it('refuses restricted pages with an actionable message', async () => {
    await expect(sessionRegistry.attach(3)).rejects.toThrow(RestrictedTargetError);
    expect(mock.attachCalls).toEqual([]); // rejected before touching chrome.debugger
  });

  it('keeps the current session when switching to a restricted page fails', async () => {
    const good = await sessionRegistry.attach(1);

    await expect(sessionRegistry.attach(3)).rejects.toThrow(RestrictedTargetError);

    // A failed switch must not leave the agent with nothing attached.
    expect(sessionRegistry.getAttached()).toBe(good);
    expect(mock.detachCalls).toEqual([]);
  });

  it('recovers after Chrome detaches the session externally', async () => {
    await sessionRegistry.attach(1);
    expect(sessionRegistry.getAttached()).not.toBeNull();

    // e.g. the user dismissed the debugging banner.
    mock.emitDetach(1, 'canceled_by_user');
    expect(sessionRegistry.getAttached()).toBeNull();

    const again = await ensureSession();
    expect(again.getTabId()).toBe(1);
    expect(mock.attachCalls).toEqual([1, 1]);
  });

  it('reclaims an attachment orphaned by a previous side panel session', async () => {
    // Closing the panel drops its JS context without reliably detaching, so the
    // next session finds the tab already attached — by us. It must recover
    // silently instead of reporting a conflict the user cannot act on.
    mock.orphanAttachment(1);

    const session = await sessionRegistry.attach(1);

    expect(session.getTabId()).toBe(1);
    expect(mock.detachCalls).toContain(1);
    expect(mock.attachCalls).toEqual([1, 1]); // failed, reclaimed, succeeded
  });

  it('explains a genuine foreign conflict rather than leaking Chrome wording', async () => {
    // DevTools open on the tab: Chrome refuses the attach, and the attachment is
    // not ours to release.
    mock.simulateForeignDebugger(1);

    await expect(sessionRegistry.attach(1)).rejects.toThrow(/DevTools/i);
    expect(sessionRegistry.getAttached()).toBeNull();
  });
});
