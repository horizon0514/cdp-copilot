import { beforeEach, describe, expect, it } from 'vitest';
import { useConversationStore } from './conversationStore';
import { saveThreadStore } from '../../lib/storage/chatThreads';

const store = () => useConversationStore.getState();

beforeEach(async () => {
  await saveThreadStore({ threads: [], activeThreadId: null });
  useConversationStore.getState().reset();
});

describe('newChat', () => {
  it('reuses the thread it is already on when nothing has been said', async () => {
    await store().hydrate();
    const opened = store().threadId;
    expect(opened).not.toBe('');

    await store().newChat();
    await store().newChat();

    // Three presses of "new chat", one thread — otherwise the switcher fills
    // up with identical blank entries the user has to scroll past.
    expect(store().threadId).toBe(opened);
    expect(store().threadList).toHaveLength(1);
  });

  it('starts a fresh thread once the current one has been used', async () => {
    await store().hydrate();
    const used = store().threadId;
    store().addUserMessage('what is on this page?');

    await store().newChat();

    expect(store().threadId).not.toBe(used);
    expect(store().messages).toEqual([]);
    expect(store().threadList.map((t) => t.id)).toContain(used);
  });

  it('refuses to leave a turn that is still running', async () => {
    await store().hydrate();
    store().addUserMessage('go');
    const busy = store().threadId;
    store().setStreaming(true);

    await store().newChat();

    expect(store().threadId).toBe(busy);
  });
});
