import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installChromeMock, type ChromeMock } from '../../test/chromeMock';
import {
  loadThreadStore,
  makeEmptyThread,
  sanitizeThreadForStorage,
  saveThreadStore,
  upsertActiveThread,
} from './chatThreads';

let mock: ChromeMock;

beforeEach(() => {
  mock = installChromeMock();
});

afterEach(() => {
  mock.restore();
});

describe('chatThreads storage', () => {
  it('redacts screenshot payloads before persisting', () => {
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
    expect(JSON.stringify(messages)).not.toContain('data:image');
    expect(messages[0].toolCalls[0].result).toMatchObject({
      image: expect.stringMatching(/^\[image \d+KB\]$/),
    });
  });

  it('round-trips threads through chrome.storage.local', async () => {
    const empty = makeEmptyThread();
    await saveThreadStore({ threads: [empty], activeThreadId: empty.id });

    const loaded = await loadThreadStore();
    expect(loaded.activeThreadId).toBe(empty.id);
    expect(loaded.threads).toHaveLength(1);
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
});
