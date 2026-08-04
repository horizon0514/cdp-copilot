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
    'Runs a JavaScript function inside the current page and returns its JSON-serializable result. ' +
    'This is a program, not just an expression: the function may be async, loop, await, click things, ' +
    'and read the DOM. Do the WHOLE job in one script rather than stepping out between actions — ' +
    'page through a list, scroll and wait for lazy content, collect, de-duplicate and filter, then ' +
    'return only the finished result. One script that walks five pages costs one step; five rounds of ' +
    'click-then-read cost ten. ' +
    'Collecting: "() => [...document.querySelectorAll(\'.item\')].map(el => ({ ' +
    'name: el.querySelector(\'.name\').innerText.trim(), href: el.querySelector(\'a\')?.href }))". ' +
    'Scrolling a lazy feed to the end: "async () => { let last = 0; for (let i = 0; i < 20; i++) { ' +
    'window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 400)); ' +
    'const n = document.querySelectorAll(\'.comment\').length; if (n === last) break; last = n; } ' +
    'return last; }". ' +
    'The result is capped, so select and shrink inside the script — return the few fields you need, ' +
    'never whole elements or the full page text.',
  inputSchema: z.object({
    function: z
      .string()
      .describe(
        'A JS function declaration, sync or async, e.g. "() => document.title" or ' +
          '"async () => { ...; return result; }"',
      ),
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
