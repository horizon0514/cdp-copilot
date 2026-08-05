import { describe, it, expect, vi } from 'vitest';
import { getBoxInPage, rectCenter, ElementNotVisibleError } from './geometry';
import type { CdpConnection } from './connection';

function mockCdp(box: unknown) {
  const send = vi.fn(async (method: string) => {
    if (method === 'DOM.scrollIntoViewIfNeeded') return {};
    if (method === 'DOM.resolveNode') return { object: { objectId: 'obj-1' } };
    if (method === 'Runtime.callFunctionOn') return { result: { value: box } };
    if (method === 'Runtime.releaseObject') return {};
    return {};
  }) as CdpConnection['send'];
  const cdp: CdpConnection = { send, on: () => () => undefined };
  return { cdp, send: send as unknown as ReturnType<typeof vi.fn> };
}

describe('getBoxInPage', () => {
  it('returns the page-space box from the injected walker', async () => {
    const { cdp, send } = mockCdp({ x: 100, y: 50, width: 40, height: 20 });
    const box = await getBoxInPage(cdp, 7);
    expect(box).toEqual({ x: 100, y: 50, width: 40, height: 20 });
    expect(rectCenter(box)).toEqual({ x: 120, y: 60 });
    expect(send).toHaveBeenCalledWith('DOM.scrollIntoViewIfNeeded', { backendNodeId: 7 });
    expect(send).toHaveBeenCalledWith('Runtime.releaseObject', { objectId: 'obj-1' });
  });

  it('throws when the element has no box', async () => {
    const { cdp } = mockCdp(null);
    await expect(getBoxInPage(cdp, 1, 'uid=a1')).rejects.toBeInstanceOf(ElementNotVisibleError);
  });
});
