import { describe, it, expect } from 'vitest';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { streamAgentEvents } from './agentLoop';
import { scriptedModel } from '../../test/mockModel';

/**
 * Establishes whether the SDK runs several tool calls from one assistant turn
 * concurrently. It does — which is why anything the tools share (notably the
 * single debugger attachment) has to tolerate concurrent entry.
 */
describe('parallel tool calls', () => {
  it('executes tool calls from the same step concurrently', async () => {
    let active = 0;
    let maxActive = 0;

    const slow = tool({
      description: 'slow',
      inputSchema: z.object({}),
      execute: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 30));
        active -= 1;
        return { ok: true };
      },
    });

    const toolset: ToolSet = { slow };
    const model = scriptedModel([
      { do: 'tools', calls: [{ name: 'slow' }, { name: 'slow' }, { name: 'slow' }] },
      { do: 'text', text: 'done' },
    ]);

    for await (const _ of streamAgentEvents(model, [{ role: 'user', content: 'go' }], { toolset })) {
      // drain
    }

    expect(maxActive).toBeGreaterThan(1);
  });
});
