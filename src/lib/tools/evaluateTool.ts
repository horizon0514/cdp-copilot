import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';

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
    return { value: result?.value ?? null };
  },
});
