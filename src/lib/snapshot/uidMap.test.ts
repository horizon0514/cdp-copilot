import { describe, it, expect } from 'vitest';
import { beginSnapshot, resolveUid, UnknownUidError } from './uidMap';

describe('uidMap', () => {
  it('hands out sequential uids starting at 1 and resolves them to backend node ids', () => {
    const { register } = beginSnapshot(1);

    expect(register(501)).toBe('1');
    expect(register(502)).toBe('2');

    expect(resolveUid(1, '1')).toBe(501);
    expect(resolveUid(1, '2')).toBe(502);
  });

  it('throws an actionable error for a uid that was never registered', () => {
    beginSnapshot(2);

    expect(() => resolveUid(2, '99')).toThrow(UnknownUidError);
    expect(() => resolveUid(2, '99')).toThrow(/take_snapshot again/);
  });

  it('invalidates the previous uids when a new snapshot is taken', () => {
    const first = beginSnapshot(3);
    first.register(700);
    expect(resolveUid(3, '1')).toBe(700);

    // A fresh snapshot must discard the old map outright — a stale uid should
    // fail loudly, not silently resolve to whatever now shares that index.
    const second = beginSnapshot(3);
    expect(() => resolveUid(3, '1')).toThrow(UnknownUidError);
    second.register(800);
    expect(resolveUid(3, '1')).toBe(800);
  });

  it('gives each snapshot a distinct id', () => {
    expect(beginSnapshot(4).snapshotId).not.toBe(beginSnapshot(4).snapshotId);
  });

  it('keeps uid namespaces separate per tab', () => {
    beginSnapshot(10).register(1000);
    beginSnapshot(11).register(2000);

    expect(resolveUid(10, '1')).toBe(1000);
    expect(resolveUid(11, '1')).toBe(2000);
  });

  it('throws for a tab that has no snapshot yet', () => {
    expect(() => resolveUid(999, '1')).toThrow(UnknownUidError);
  });
});
