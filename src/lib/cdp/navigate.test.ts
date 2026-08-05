import { describe, it, expect, vi } from 'vitest';
import { navigate } from './navigate';
import type { CdpConnection } from './connection';

describe('navigate', () => {
  it('enables lifecycle events, arms the waiter, then navigates', async () => {
    const handlers = new Map<string, Set<(params: unknown) => void>>();
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.enable' || method === 'Page.setLifecycleEventsEnabled') return {};
      if (method === 'Page.navigate') {
        queueMicrotask(() => {
          for (const h of handlers.get('Page.lifecycleEvent') ?? []) {
            h({ name: 'load', frameId: 'f1' });
          }
        });
        return { frameId: 'f1', loaderId: 'l1' };
      }
      return {};
    }) as CdpConnection['send'];

    const cdp: CdpConnection = {
      send,
      on(method, handler) {
        let set = handlers.get(method);
        if (!set) {
          set = new Set();
          handlers.set(method, set);
        }
        set.add(handler);
        return () => set!.delete(handler);
      },
    };

    const result = await navigate(cdp, 'https://example.com', { timeoutMs: 1000 });
    expect(result).toEqual({ frameId: 'f1', loaderId: 'l1' });
    expect((send as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([m]) => m)).toEqual([
      'Page.enable',
      'Page.setLifecycleEventsEnabled',
      'Page.navigate',
    ]);
  });

  it('surfaces Page.navigate errorText and does not hang on the waiter', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.enable' || method === 'Page.setLifecycleEventsEnabled') return {};
      if (method === 'Page.navigate') return { errorText: 'net::ERR_NAME_NOT_RESOLVED' };
      return {};
    }) as CdpConnection['send'];
    const cdp: CdpConnection = {
      send,
      on: () => () => undefined,
    };

    await expect(navigate(cdp, 'https://nope.invalid', { timeoutMs: 500 })).rejects.toThrow(
      /ERR_NAME_NOT_RESOLVED/,
    );
  });
});
