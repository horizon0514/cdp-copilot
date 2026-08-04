import { describe, expect, it } from 'vitest';
import { tools } from './index';

describe('model tool registry', () => {
  it('exposes task-ledger state through one stable tool', () => {
    expect(Object.keys(tools)).toContain('update_task_ledger');
    expect(Object.keys(tools)).not.toEqual(
      expect.arrayContaining(['update_plan', 'save_finding', 'remove_finding', 'add_note']),
    );
  });

  it('exposes completion and episode transitions through one control tool', () => {
    expect(Object.keys(tools)).toContain('control_task');
    expect(Object.keys(tools)).not.toContain('task_complete');
  });
});
