import { test, expect, callTool } from './extension';
import { BING_EXTRACT, formatSearchResults, type RawResult } from '../src/lib/tools/searchTool';

/**
 * web_search's own navigation + polling can't run offline (it hits Bing), so
 * that path is gated behind E2E_NETWORK and skipped in CI. What always runs is
 * the piece most likely to silently rot — the DOM selectors — exercised against
 * a Bing-shaped fixture in a real renderer via the same extraction script the
 * tool ships.
 */

test('the Bing extraction selectors pick organic results out of a real render', async ({
  panel,
  openTarget,
}) => {
  await openTarget('/bing.html');

  const { value: raw } = await callTool<{ value: RawResult[] }>(panel, 'evaluate_script', {
    function: BING_EXTRACT,
  });

  // The ad (li.b_ad) and the related-searches block (li.b_ans) are skipped.
  expect(raw).toHaveLength(3);
  expect(raw[0]).toMatchObject({
    title: 'First Result Title',
    url: 'https://example.com/one',
    snippet: 'Snippet for the first result.',
  });

  // And the tool's formatter turns that into clean ranked output.
  const results = formatSearchResults(raw, 8);
  expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
  expect(results.map((r) => r.url)).toEqual([
    'https://example.com/one',
    'https://example.com/two',
    'https://example.com/three',
  ]);
});

test('web_search returns ranked results from a live query', async ({ panel, openTarget }) => {
  test.skip(!process.env.E2E_NETWORK, 'set E2E_NETWORK=1 to run the live Bing search test');

  // Bind to some tab first; web_search navigates the attached tab to Bing.
  await openTarget('/page.html');

  const { results } = await callTool<{ results: { rank: number; title: string; url: string }[] }>(
    panel,
    'web_search',
    { query: 'openai', count: 5 },
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].url).toMatch(/^https?:\/\//);
  expect(results[0].title.length).toBeGreaterThan(0);
});
