import { generateText, tool } from 'ai';
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

interface CollectedPage {
  url: string;
  title: string;
  text: string;
  links: string[];
}

/**
 * innerText, not the AX tree: for reading, layout text is denser and closer to
 * what a human sees. Links ride along separately because innerText drops
 * hrefs, and collection tasks usually need them (profile URLs, post URLs).
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

export const extract_content = tool({
  description:
    'Reads the ENTIRE visible page text in one call and extracts what you ask for as compact JSON. ' +
    'Far cheaper than take_snapshot for reading and collecting (comments, listings, tables, profiles) — ' +
    'the raw page never enters your context, only the result does. Reads what is currently rendered: ' +
    'scroll or expand first if more content must load (evaluate_script with window.scrollBy). ' +
    'Use take_snapshot only when you need uids to click or fill.',
  inputSchema: z.object({
    instruction: z
      .string()
      .describe(
        'What to extract and the JSON shape wanted, e.g. "all comments as [{user, text, hint}] where ' +
          'the text suggests the commenter wants to sell an apartment; include the profile link if present"',
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

    const { text: answer } = await generateText({
      model: resolveModel(settings),
      instructions: EXTRACT_SYSTEM,
      prompt: buildExtractionPrompt(instruction, result.value),
      abortSignal,
    });

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
