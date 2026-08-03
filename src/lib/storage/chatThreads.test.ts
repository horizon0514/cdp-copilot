import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../test/chromeMock';
import { idbClearAll } from './idb';
import {
  isUntitledThreadTitle,
  loadThreadStore,
  makeEmptyThread,
  sanitizeThreadForStorage,
  saveThreadStore,
  upsertActiveThread,
} from './chatThreads';

let mock: ChromeMock;

beforeEach(async () => {
  mock = installChromeMock();
  await idbClearAll();
});

afterEach(async () => {
  await idbClearAll();
  mock.restore();
});

describe('chatThreads storage (IndexedDB)', () => {
  it('keeps screenshot payloads when preparing for IDB', () => {
    const png = `data:image/png;base64,${'A'.repeat(5000)}`;
    const { messages } = sanitizeThreadForStorage(
      [
        {
          id: '1',
          role: 'assistant',
          text: 'shot',
          toolCalls: [
            {
              id: 't1',
              name: 'take_screenshot',
              args: {},
              status: 'done',
              result: { image: png },
            },
          ],
        },
      ],
      [],
    );
    expect(messages[0].toolCalls[0].result).toEqual({ image: png });
  });

  it('round-trips threads through IndexedDB', async () => {
    const empty = makeEmptyThread();
    expect(empty.title).toBe('');
    expect(isUntitledThreadTitle(empty.title)).toBe(true);
    expect(isUntitledThreadTitle('New chat')).toBe(true);
    expect(isUntitledThreadTitle('新对话')).toBe(true);
    expect(isUntitledThreadTitle('Summarize this')).toBe(false);

    await saveThreadStore({ threads: [empty], activeThreadId: empty.id });

    const loaded = await loadThreadStore();
    expect(loaded.activeThreadId).toBe(empty.id);
    expect(loaded.threads).toHaveLength(1);
    expect(loaded.threads[0].title).toBe('');
  });

  it('upserts the active thread and derives a title from the first user message', async () => {
    const t = makeEmptyThread();
    const next = upsertActiveThread(
      { threads: [t], activeThreadId: t.id },
      {
        id: t.id,
        createdAt: t.createdAt,
        messages: [
          { id: 'u1', role: 'user', text: 'Summarize this page please', toolCalls: [] },
          { id: 'a1', role: 'assistant', text: 'Sure', toolCalls: [] },
        ],
        modelMessages: [{ role: 'user', content: 'Summarize this page please' }],
      },
    );
    expect(next.threads[0].title).toBe('Summarize this page please');
    await saveThreadStore(next);
    const loaded = await loadThreadStore();
    expect(loaded.threads[0].title).toBe('Summarize this page please');
  });

  it('migrates legacy chrome.storage.local threads into IndexedDB once', async () => {
    const legacy = makeEmptyThread();
    legacy.title = 'Legacy chat';
    await chrome.storage.local.set({
      'cdp-copilot:threads': { threads: [legacy], activeThreadId: legacy.id },
    });

    const loaded = await loadThreadStore();
    expect(loaded.threads[0].title).toBe('Legacy chat');

    // Legacy key is removed after migration.
    const leftover = await chrome.storage.local.get('cdp-copilot:threads');
    expect(leftover['cdp-copilot:threads']).toBeUndefined();

    // Second load comes from IDB, not chrome.storage.
    await chrome.storage.local.set({
      'cdp-copilot:threads': { threads: [], activeThreadId: null },
    });
    const again = await loadThreadStore();
    expect(again.threads[0].title).toBe('Legacy chat');
  });
});
