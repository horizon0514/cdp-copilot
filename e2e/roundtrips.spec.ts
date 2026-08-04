import { test, expect } from './extension';
import { live, setUpLiveModel, runTurn, formatMetrics, type TurnMetrics } from './liveTurn';
import type { TestInfo } from '@playwright/test';

/**
 * The round-trip baseline.
 *
 * Everything downstream of this file — teaching the model to do a whole job in
 * one evaluate_script, and later exposing page actions to those scripts — is
 * justified by one number: how many tool calls a real model spends on a real
 * task. Guessing at that number is how you end up optimising something that was
 * never the bottleneck, so it gets measured before anything is changed.
 *
 * These are measurements, not gates. Each test asserts only that the task
 * genuinely succeeded — a run that failed early would otherwise post a
 * flatteringly low count — and then records what it cost. Compare the recorded
 * numbers before and after a change; do not read a single run as a threshold,
 * since a live model varies between runs.
 *
 * Skipped unless a key is configured in .env.local, like the other live spec.
 */
test.describe('round-trip baseline', () => {
  test.skip(!live, 'Set DEEPSEEK_API_KEY in .env.local to run this.');

  // Several model round trips plus real page interaction, three times over.
  test.setTimeout(300_000);

  async function record(testInfo: TestInfo, label: string, metrics: TurnMetrics) {
    const report = formatMetrics(label, metrics);
    console.log(report);
    await testInfo.attach(`roundtrips-${label}`, {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });
  }

  test('paginated collection: walks three pages and reports what it cost', async ({
    panel,
    baseURL,
  }, testInfo) => {
    const { target } = await setUpLiveModel(panel, `${baseURL}/list.html`);

    const metrics = await runTurn(
      panel,
      'This catalogue has 3 pages. Collect the names of every item priced above $50 across ' +
        'all 3 pages, then list them. Be brief.',
    );

    // Proof the work actually happened: the last page is only reachable by
    // paginating, and Item-28 only exists there.
    await expect(target.locator('#page-indicator')).toHaveText('Page 3 of 3');
    expect(metrics.text).toContain('Item-28');
    expect(metrics.hitStepLimit).toBe(false);

    await record(testInfo, 'paginated-collection', metrics);
    await target.close();
  });

  test('scroll-loaded feed: loads all comments and reports what it cost', async ({
    panel,
    baseURL,
  }, testInfo) => {
    const { target } = await setUpLiveModel(panel, `${baseURL}/feed.html`);

    const metrics = await runTurn(
      panel,
      'This page loads more comments as you scroll down. Scroll until every comment has ' +
        'loaded, then tell me the total number of comments. Be brief.',
    );

    // The counter is written by the page itself, so it cannot be talked into
    // reading 30 — only scrolling gets it there.
    await expect(target.locator('#loaded-count')).toHaveText('30');
    expect(metrics.text).toContain('30');
    expect(metrics.hitStepLimit).toBe(false);

    await record(testInfo, 'scroll-feed', metrics);
    await target.close();
  });

  test('form filling: sets both fields and reports what it cost', async ({
    panel,
    baseURL,
  }, testInfo) => {
    const { target } = await setUpLiveModel(panel, `${baseURL}/page.html`);

    const metrics = await runTurn(
      panel,
      'Fill the Search field with "hello" and the Typed field with "world". Be brief.',
    );

    // Real values in the real page — the cheapest scenario, kept as a control:
    // if its count moves, the change touched more than page reading.
    await expect(target.locator('#search')).toHaveValue('hello');
    await expect(target.locator('#typed')).toHaveValue('world');
    expect(metrics.hitStepLimit).toBe(false);

    await record(testInfo, 'form-filling', metrics);
    await target.close();
  });
});
