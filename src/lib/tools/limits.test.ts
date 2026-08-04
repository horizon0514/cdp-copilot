import { describe, it, expect } from 'vitest';
import { clampJsonValue, clampText } from './limits';

describe('clampText', () => {
  it('passes small text through untouched', () => {
    expect(clampText('hello', 100)).toEqual({ text: 'hello', truncated: false });
  });

  it('truncates and reports how much was cut', () => {
    const { text, truncated } = clampText('a'.repeat(150), 100);
    expect(truncated).toBe(true);
    expect(text.startsWith('a'.repeat(100))).toBe(true);
    expect(text).toContain('[truncated 50 of 150 chars]');
  });
});

describe('clampJsonValue', () => {
  it('keeps small values as-is, preserving their type', () => {
    const value = { rows: [1, 2, 3] };
    expect(clampJsonValue(value, 1000)).toEqual({ value, truncated: false });
  });

  it('replaces oversized values with a truncated JSON string', () => {
    const value = { rows: Array.from({ length: 500 }, (_, i) => `item-${i}`) };
    const clamped = clampJsonValue(value, 200);
    expect(clamped.truncated).toBe(true);
    expect(typeof clamped.value).toBe('string');
    expect((clamped.value as string).length).toBeLessThan(300);
  });

  it('tolerates non-serializable values', () => {
    expect(clampJsonValue(undefined, 10)).toEqual({ value: undefined, truncated: false });
  });
});
