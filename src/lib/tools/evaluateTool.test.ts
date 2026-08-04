import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MAX_EVALUATE_CHARS } from './limits';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./context', () => ({ ensureSession: async () => ({ send }) }));

import { evaluate_script } from './evaluateTool';

/** The tool's own execute, called the way the agent loop calls it. */
function run(input: { function: string; args?: unknown[] }) {
  const { execute } = evaluate_script as unknown as {
    execute: (input: unknown, options: unknown) => Promise<{
      value: unknown;
      truncated?: boolean;
      note?: string;
    }>;
  };
  return execute(input, { toolCallId: 'test', messages: [] });
}

function lastExpression(): string {
  return send.mock.calls.at(-1)![1].expression;
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ result: { value: null } });
});

describe('evaluate_script', () => {
  it('runs a whole async program and waits for it to settle', async () => {
    send.mockResolvedValue({ result: { value: 30 } });

    const { value } = await run({
      function:
        'async () => { let n = 0; for (let i = 0; i < 3; i++) { ' +
        'await new Promise(r => setTimeout(r, 10)); n += 10; } return n; }',
    });

    expect(value).toBe(30);
    // Without awaitPromise the page returns a pending Promise and every async
    // script silently resolves to an empty object.
    const [method, params] = send.mock.calls[0];
    expect(method).toBe('Runtime.evaluate');
    expect(params.awaitPromise).toBe(true);
    expect(params.returnByValue).toBe(true);
    expect(lastExpression()).toContain('async () =>');
  });

  it('invokes the declaration rather than evaluating it, passing args through', async () => {
    await run({ function: '(a, b) => a + b', args: [1, 2] });

    // A bare declaration evaluates to a function object, not a result — the
    // call parentheses and the spread arguments are what make it run.
    expect(lastExpression()).toBe('((a, b) => a + b)(...[1,2])');
  });

  it('defaults to no arguments', async () => {
    await run({ function: '() => document.title' });
    expect(lastExpression()).toBe('(() => document.title)(...[])');
  });

  it('surfaces a page-side exception instead of returning a null result', async () => {
    send.mockResolvedValue({
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: "TypeError: Cannot read properties of null" },
      },
    });

    await expect(run({ function: '() => document.querySelector("#gone").innerText' })).rejects.toThrow(
      'TypeError: Cannot read properties of null',
    );
  });

  it('clamps an oversized result and tells the model to narrow the script', async () => {
    send.mockResolvedValue({ result: { value: { blob: 'x'.repeat(MAX_EVALUATE_CHARS * 2) } } });

    const result = await run({ function: '() => ({ blob: document.body.innerHTML })' });

    expect(result.truncated).toBe(true);
    expect(String(result.value).length).toBeLessThan(MAX_EVALUATE_CHARS + 200);
    expect(result.note).toMatch(/smaller selection/i);
  });

  it('leaves a result within budget untouched and unflagged', async () => {
    send.mockResolvedValue({ result: { value: [{ name: 'Item-04' }, { name: 'Item-08' }] } });

    const result = await run({ function: '() => collect()' });

    expect(result.value).toEqual([{ name: 'Item-04' }, { name: 'Item-08' }]);
    expect(result.truncated).toBeUndefined();
  });
});
