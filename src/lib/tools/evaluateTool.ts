import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { clampJsonValue, MAX_EVALUATE_CHARS } from './limits';

interface EvaluateResult {
  result?: { value?: unknown };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

export const evaluate_script = tool({
  description:
    'Evaluates a JavaScript function in the current page and returns the JSON-serializable result. ' +
    'Example: "() => document.title".',
  inputSchema: z.object({
    function: z.string().describe('A JS function declaration, e.g. "() => document.title"'),
    args: z.array(z.unknown()).optional(),
  }),
  execute: async ({ function: fn, args }) => {
    const session = await ensureSession();
    const argsLiteral = JSON.stringify(args ?? []);
    const expression = `(${fn})(...${argsLiteral})`;
    const { result, exceptionDetails } = await session.send<EvaluateResult>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    // The page controls this payload, so it can be arbitrarily large — clamp it
    // before it lands in the context window.
    const { value, truncated } = clampJsonValue(result?.value ?? null, MAX_EVALUATE_CHARS);
    return truncated
      ? { value, truncated: true, note: 'Result was truncated — return a smaller selection from the script.' }
      : { value };
  },
});
