import { describe, expect, it } from 'vitest';
import { zodSchema } from 'ai';
import { control_task, taskControlSchema } from './controlTools';

describe('control_task schema', () => {
  it('advertises a top-level JSON Schema object (DeepSeek / OpenAI-compatible)', async () => {
    // Discriminated unions become anyOf with no root type — providers reject that
    // as type: null. The wire schema must stay a plain object.
    // inputSchema is a Zod object; AI SDK's FlexibleSchema typing is wider than zodSchema's param.
    const schema = zodSchema(control_task.inputSchema as never);
    const json = await schema.jsonSchema;
    expect(json.type).toBe('object');
    expect(json).not.toHaveProperty('anyOf');
    expect(json.properties).toMatchObject({
      type: expect.anything(),
      summary: expect.anything(),
      objective: expect.anything(),
      rationale: expect.anything(),
      status: expect.anything(),
      handoffNote: expect.anything(),
    });
  });

  it('narrows each action variant', () => {
    expect(
      taskControlSchema.parse({ type: 'complete', summary: 'done' }),
    ).toEqual({ type: 'complete', summary: 'done' });

    expect(
      taskControlSchema.parse({
        type: 'start_episode',
        objective: 'page 1',
        rationale: 'bounded',
      }),
    ).toEqual({
      type: 'start_episode',
      objective: 'page 1',
      rationale: 'bounded',
    });

    expect(
      taskControlSchema.parse({
        type: 'finish_episode',
        status: 'partial',
        summary: 'halfway',
        handoffNote: 'continue',
      }),
    ).toEqual({
      type: 'finish_episode',
      status: 'partial',
      summary: 'halfway',
      handoffNote: 'continue',
    });
  });

  it('rejects incomplete actions', () => {
    expect(taskControlSchema.safeParse({ type: 'complete' }).success).toBe(false);
    expect(
      taskControlSchema.safeParse({ type: 'start_episode', objective: 'x' }).success,
    ).toBe(false);
    expect(
      taskControlSchema.safeParse({
        type: 'finish_episode',
        status: 'done',
        summary: 'ok',
      }).success,
    ).toBe(false);
  });
});
