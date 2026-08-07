import { streamText, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { getSettings } from '../storage/settingsStore';
import { resolveModel } from '../llm/providers';
import { clampJsonValue, clampText } from './limits';

/**
 * extract_content exists to change the economics of reading a page. A
 * take_snapshot costs ~12K tokens of the main context per look, and the main
 * loop pays for it again on every following step. Here the raw page text goes
 * into a one-shot side call instead; only the compact JSON answer enters the
 * agent's context.
 */

/** Same budget as a snapshot — the side call runs on the same model. */
export const MAX_EXTRACT_SOURCE_CHARS = 40_000;
export const MAX_EXTRACT_RESULT_CHARS = 8_000;
const MAX_LINKS = 200;

/**
 * Two ceilings that exist because of where the hosted path runs.
 *
 * The hosted proxy caps itself at 60s per request, and this is the one call in
 * the product that can approach it: 10K tokens of page text in, and a model
 * free to emit rows until it runs out of things to say. Being killed at that
 * ceiling is the worst available outcome — the client sees an opaque 504 *and*
 * the usage frame never arrives, so tokens we were charged for go unbilled.
 *
 * So the call is bounded twice over on this side too: an output cap the
 * provider enforces, and a deadline that fires with time to spare and produces
 * a tool error the agent can act on ("ask for fewer fields") rather than a
 * platform error it can only retry into the same wall. Both are worth keeping
 * whatever the proxy's own limit is set to — 45s is already far longer than a
 * healthy extraction takes.
 */
const MAX_EXTRACT_OUTPUT_TOKENS = 4_000;
const EXTRACT_TIMEOUT_MS = 45_000;

interface CollectedPage {
  url: string;
  title: string;
  text: string;
  links: string[];
}

/**
 * innerText, not the AX tree: for reading, layout text is denser and closer to
 * what a human sees. Links ride along separately because innerText drops
 * hrefs, which extractions often need.
 */
const COLLECT_PAGE = `() => {
  const links = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const text = (a.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
    if (!text) continue;
    const entry = text + ' -> ' + a.href;
    if (seen.has(entry)) continue;
    seen.add(entry);
    links.push(entry);
    if (links.length >= ${MAX_LINKS}) break;
  }
  return {
    url: location.href,
    title: document.title,
    text: document.body ? document.body.innerText : '',
    links,
  };
}`;

const EXTRACT_SYSTEM =
  'You are a data-extraction engine. You get the visible text of a web page (plus its links) and an ' +
  'extraction instruction. Reply with ONLY the extracted data as valid JSON — no markdown fences, no ' +
  'commentary. If nothing on the page matches, reply with an empty JSON array [].';

export function buildExtractionPrompt(instruction: string, page: CollectedPage): string {
  const { text, truncated } = clampText(page.text, MAX_EXTRACT_SOURCE_CHARS);
  return [
    `Extraction instruction: ${instruction}`,
    '',
    `Page URL: ${page.url}`,
    `Page title: ${page.title}`,
    truncated ? 'Note: the page text below was truncated.' : '',
    '--- PAGE TEXT ---',
    text,
    '--- LINKS (text -> href) ---',
    page.links.join('\n'),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Models often wrap JSON in ```fences``` despite instructions — tolerate it. */
export function parseModelJson(raw: string): unknown | undefined {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Streamed, not one-shot — the difference matters only on the hosted path, and
 * there it matters twice.
 *
 * The proxy's non-streaming branch buffers the whole upstream body inside the
 * function before answering, so a slow extraction spends its entire budget with
 * nothing sent and then dies at the platform ceiling. The streaming branch
 * answers as soon as upstream headers arrive and accounts for usage off a
 * tee'd copy, which is the path the ledger is built on. The text is collected
 * here, so the caller still gets one string and nothing else changes.
 */
async function runExtraction(
  model: LanguageModel,
  prompt: string,
  abortSignal: AbortSignal | undefined,
): Promise<string> {
  // Whichever comes first: the agent's stop button or our own deadline.
  const deadline = AbortSignal.timeout(EXTRACT_TIMEOUT_MS);
  const signal = abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline;

  const result = streamText({
    model,
    instructions: EXTRACT_SYSTEM,
    prompt,
    maxOutputTokens: MAX_EXTRACT_OUTPUT_TOKENS,
    abortSignal: signal,
  });

  try {
    return await result.text;
  } catch (err) {
    // The agent's own stop is not this tool's failure to explain; our deadline is.
    if (deadline.aborted && abortSignal?.aborted !== true) {
      throw new Error(
        `Extraction timed out after ${EXTRACT_TIMEOUT_MS / 1000}s. The page is too large or the ` +
          'instruction too broad — narrow it to fewer fields, or scroll to the section you need first.',
      );
    }
    throw err;
  }
}

export const extract_content = tool({
  description:
    'Reads the ENTIRE visible page text in one call and extracts what you ask for as compact JSON. ' +
    'Far cheaper than take_snapshot for reading — the raw page never enters your context, only the ' +
    'result does. Reads what is currently rendered: scroll or expand first (via evaluate_script) if ' +
    'more content must load. Use take_snapshot only when you need uids to click or fill.',
  inputSchema: z.object({
    instruction: z
      .string()
      .describe(
        'What to extract and the JSON shape wanted, e.g. "table rows as [{name, price, url}] matching ' +
          'the stated criteria; omit rows that do not qualify"',
      ),
  }),
  execute: async ({ instruction }, { abortSignal }) => {
    const session = await ensureSession();
    const { result, exceptionDetails } = await session.send<{
      result?: { value?: CollectedPage };
      exceptionDetails?: { text: string };
    }>('Runtime.evaluate', {
      expression: `(${COLLECT_PAGE})()`,
      returnByValue: true,
    });
    if (exceptionDetails || !result?.value) {
      throw new Error(`Could not read the page: ${exceptionDetails?.text ?? 'no content returned'}`);
    }

    const settings = await getSettings();
    if (!settings) throw new Error('No model configured — open settings first.');

    const answer = await runExtraction(
      resolveModel(settings),
      buildExtractionPrompt(instruction, result.value),
      abortSignal,
    );

    const parsed = parseModelJson(answer);
    const { value, truncated } = clampJsonValue(parsed ?? answer, MAX_EXTRACT_RESULT_CHARS);
    return {
      url: result.value.url,
      // `data` when the sub-model returned valid JSON, `text` when it rambled —
      // still useful, and the agent can re-ask with a stricter instruction.
      ...(parsed !== undefined ? { data: value } : { text: value }),
      ...(truncated ? { truncated: true, note: 'Result truncated — ask for fewer fields or a narrower extraction.' } : {}),
    };
  },
});
