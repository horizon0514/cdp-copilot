import { describe, it, expect, vi } from 'vitest';
import { clickAt } from './mouse';
import type { CdpConnection } from './connection';

function mockCdp() {
  const send = vi.fn(async (_method: string, _params?: object) => ({})) as CdpConnection['send'];
  const cdp: CdpConnection = {
    send,
    on: () => () => undefined,
  };
  return { cdp, send: send as unknown as ReturnType<typeof vi.fn> };
}

describe('clickAt', () => {
  it('emits one move + press/release for a single click', async () => {
    const { cdp, send } = mockCdp();
    await clickAt(cdp, { x: 10, y: 20 });

    const calls = send.mock.calls as [string, { type: string; clickCount?: number; x?: number; y?: number }][];
    const types = calls.map(([, params]) => params.type);
    expect(types).toEqual(['mouseMoved', 'mousePressed', 'mouseReleased']);
    expect(calls[1][1]).toMatchObject({ clickCount: 1, x: 10, y: 20, button: 'left' });
  });

  it('emits two click cycles with increasing clickCount for a double-click', async () => {
    const { cdp, send } = mockCdp();
    await clickAt(cdp, { x: 5, y: 5 }, { count: 2 });

    const calls = send.mock.calls as [string, { type: string; clickCount?: number }][];
    const presses = calls
      .filter(([, params]) => params.type === 'mousePressed')
      .map(([, params]) => params.clickCount);
    expect(presses).toEqual([1, 2]);
  });
});
