import { MockLanguageModelV4 } from 'ai/test';

/**
 * LanguageModelV4 wire shapes are easy to get subtly wrong — `finishReason` is
 * an object (not a string) and `usage` is nested. Getting either wrong makes
 * the SDK silently report finishReason 'other' and drop token counts, which
 * looks like a product bug. Keep the shapes in one place.
 */
type Unified = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';

const finishReason = (unified: Unified) => ({ unified, raw: unified });

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

/** What the model should do on a given (1-based) step. */
export type StepScript =
  | { do: 'tool'; name: string; input?: unknown }
  /** Several tool calls in one assistant turn — the SDK runs these in parallel. */
  | { do: 'tools'; calls: { name: string; input?: unknown }[] }
  | { do: 'text'; text: string }
  /** Finishes cleanly but emits nothing — the "ran tools, gave no answer" case. */
  | { do: 'silent' }
  | { do: 'error'; message: string };

/**
 * A model that replays a fixed script, one entry per step. The last entry
 * repeats if the loop runs more steps than the script has entries.
 */
export function scriptedModel(
  script: StepScript[],
  onPrompt?: (prompt: unknown) => void,
  onTools?: (tools: unknown) => void,
) {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async ({ prompt, tools }) => {
      onPrompt?.(prompt);
      onTools?.(tools);
      const action = script[Math.min(step, script.length - 1)];
      step += 1;
      const id = `s${step}`;

      return {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] });

            switch (action.do) {
              case 'tool':
                c.enqueue({
                  type: 'tool-call',
                  toolCallId: id,
                  toolName: action.name,
                  input: JSON.stringify(action.input ?? {}),
                });
                c.enqueue({ type: 'finish', finishReason: finishReason('tool-calls'), usage: usage(100, 20) });
                break;

              case 'tools':
                action.calls.forEach((call, i) => {
                  c.enqueue({
                    type: 'tool-call',
                    toolCallId: `${id}-${i}`,
                    toolName: call.name,
                    input: JSON.stringify(call.input ?? {}),
                  });
                });
                c.enqueue({ type: 'finish', finishReason: finishReason('tool-calls'), usage: usage(100, 20) });
                break;

              case 'text':
                c.enqueue({ type: 'text-start', id });
                c.enqueue({ type: 'text-delta', id, delta: action.text });
                c.enqueue({ type: 'text-end', id });
                c.enqueue({ type: 'finish', finishReason: finishReason('stop'), usage: usage(100, 20) });
                break;

              case 'silent':
                c.enqueue({ type: 'finish', finishReason: finishReason('stop'), usage: usage(100, 0) });
                break;

              case 'error':
                c.enqueue({ type: 'error', error: new Error(action.message) });
                c.enqueue({ type: 'finish', finishReason: finishReason('error'), usage: usage(100, 0) });
                break;
            }

            c.close();
          },
        }),
      };
    },
  });
}
