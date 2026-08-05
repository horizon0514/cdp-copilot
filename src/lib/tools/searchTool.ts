import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';

/**
 * Web search as a first-class tool instead of "open a search engine and read
 * the page". Two things made the DIY approach bad: the model pasted the raw
 * question into the box instead of keywords, and extract_content on a results
 * page drowned the real hits in nav chrome, ads, and "related searches". This
 * navigates Bing (clean direct URLs, reachable from China as cn.bing.com) and
 * pulls only the organic result triples — title, url, snippet.
 */

const DEFAULT_COUNT = 8;
const MAX_COUNT = 15;
const MAX_TITLE_CHARS = 200;
const MAX_SNIPPET_CHARS = 300;
const RESULT_TIMEOUT_MS = 12_000;

export interface RawResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResult {
  rank: number;
  title: string;
  url: string;
  snippet: string;
}

function clamp(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * Normalize the raw page scrape: drop empties, dedupe by URL (Bing repeats a
 * domain across a main result and its sublinks), clamp text, and rank. Kept
 * pure and exported so it can be tested without a browser.
 */
export function formatSearchResults(raw: RawResult[], count: number): SearchResult[] {
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of raw) {
    if (!item.url || !item.title) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    results.push({
      rank: results.length + 1,
      title: clamp(item.title, MAX_TITLE_CHARS),
      url: item.url,
      snippet: clamp(item.snippet ?? '', MAX_SNIPPET_CHARS),
    });
    if (results.length >= count) break;
  }
  return results;
}

export function bingSearchUrl(query: string): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

/** Runs in the page: pull organic results from Bing's result list. */
export const BING_EXTRACT = `() => {
  const out = [];
  for (const li of document.querySelectorAll('#b_results > li.b_algo')) {
    const a = li.querySelector('h2 a');
    if (!a || !a.href) continue;
    const cap = li.querySelector('.b_caption p') || li.querySelector('p');
    out.push({
      title: (a.innerText || '').trim(),
      url: a.href,
      snippet: cap ? (cap.innerText || '').trim() : '',
    });
  }
  return out;
}`;

export const web_search = tool({
  description:
    'Searches the web and returns clean ranked results (title, url, snippet) as JSON — far more reliable ' +
    'than opening a search engine and reading the page. Pass concise keywords, not a full-sentence ' +
    'question. If results are weak, call again with reformulated terms rather than repeating the same ' +
    'query. Then navigate_page to a result url and extract_content to read it.',
  inputSchema: z.object({
    query: z.string().describe('Concise search keywords — not a full-sentence question'),
    count: z.number().optional().describe(`How many results to return (default ${DEFAULT_COUNT}, max ${MAX_COUNT})`),
  }),
  execute: async ({ query, count }, { abortSignal }) => {
    const session = await ensureSession();
    const want = Math.min(Math.max(1, count ?? DEFAULT_COUNT), MAX_COUNT);

    await session.send('Page.navigate', { url: bingSearchUrl(query) });

    // Navigation resolves before results render, so poll for the result list —
    // and honor an abort so the stop button lands without waiting out the timeout.
    const deadline = Date.now() + RESULT_TIMEOUT_MS;
    let raw: RawResult[] = [];
    while (Date.now() < deadline && !abortSignal?.aborted) {
      const { result, exceptionDetails } = await session.send<{
        result?: { value?: RawResult[] };
        exceptionDetails?: { text: string };
      }>('Runtime.evaluate', {
        expression: `(${BING_EXTRACT})()`,
        returnByValue: true,
      });
      if (!exceptionDetails && result?.value && result.value.length > 0) {
        raw = result.value;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const results = formatSearchResults(raw, want);
    if (results.length === 0) {
      return {
        query,
        results: [],
        note: 'No results parsed — the page may not have loaded, or the query was too specific. Reformulate with different keywords.',
      };
    }
    return { query, results };
  },
});
