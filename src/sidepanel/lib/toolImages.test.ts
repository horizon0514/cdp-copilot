import { describe, expect, it } from 'vitest';
import { extractImages, imagesFromToolCalls, redactImages } from './toolImages';

describe('extractImages / redactImages', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

  it('pulls data-URL images out of nested tool results', () => {
    expect(extractImages({ image: png, meta: { ok: true } })).toEqual([png]);
    expect(extractImages({ shots: [png, 'nope'] })).toEqual([png]);
  });

  it('redacts base64 blobs from the raw JSON view', () => {
    const redacted = redactImages({ image: png, n: 1 }) as { image: string; n: number };
    expect(redacted.image).toMatch(/^\[image \d+KB\]$/);
    expect(redacted.n).toBe(1);
  });

  it('collects images from done tool calls only', () => {
    expect(
      imagesFromToolCalls([
        { status: 'running', result: { image: png } },
        { status: 'done', result: { image: png } },
        { status: 'error' },
      ]),
    ).toEqual([png]);
  });
});
