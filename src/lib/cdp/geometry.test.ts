import { describe, it, expect, vi } from 'vitest';
import { getBoxInPage, rectCenter, ElementNotVisibleError } from './geometry';
import type { CdpConnection } from './connection';

function mockCdp(opts: {
  content?: number[];
  offset?: { x: number; y: number };
  boxModelThrows?: boolean;
}) {
  const send = vi.fn(async (method: string) => {
    if (method === 'DOM.scrollIntoViewIfNeeded') return {};
    if (method === 'DOM.getBoxModel') {
      if (opts.boxModelThrows) throw new Error('no box');
      return { model: { content: opts.content ?? [10, 20, 50, 20, 50, 40, 10, 40] } };
    }
    if (method === 'DOM.resolveNode') return { object: { objectId: 'obj-1' } };
    if (method === 'Runtime.callFunctionOn') {
      return { result: { value: opts.offset ?? { x: 0, y: 0 } } };
    }
    if (method === 'Runtime.releaseObject') return {};
    return {};
  }) as CdpConnection['send'];
  const cdp: CdpConnection = { send, on: () => () => undefined };
  return { cdp, send: send as unknown as ReturnType<typeof vi.fn> };
}

describe('getBoxInPage', () => {
  it('uses getBoxModel and adds iframe offsets into page space', async () => {
    // content TL=(10,20) BR=(50,40) → 40x20, plus iframe offset (100,5)
    const { cdp, send } = mockCdp({
      content: [10, 20, 50, 20, 50, 40, 10, 40],
      offset: { x: 100, y: 5 },
    });
    const box = await getBoxInPage(cdp, 7);
    expect(box).toEqual({ x: 110, y: 25, width: 40, height: 20 });
    expect(rectCenter(box)).toEqual({ x: 130, y: 35 });
    expect(send).toHaveBeenCalledWith('DOM.getBoxModel', { backendNodeId: 7 });
    expect(send).toHaveBeenCalledWith('Runtime.releaseObject', { objectId: 'obj-1' });
  });

  it('throws when getBoxModel fails', async () => {
    const { cdp } = mockCdp({ boxModelThrows: true });
    await expect(getBoxInPage(cdp, 1, 'uid=a1')).rejects.toBeInstanceOf(ElementNotVisibleError);
  });
});
