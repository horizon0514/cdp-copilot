import { test, expect } from './extension';
import { live, setUpLiveModel, ask } from './liveTurn';

/**
 * The only test that exercises the whole stack for real: a live model decides
 * which tools to call, the real tool layer runs them over CDP, and a real page
 * changes as a result.
 *
 * Skipped unless a key is configured in .env.local, so CI and everyone else
 * stay unaffected. It costs tokens and depends on the network and on model
 * behaviour, so assertions check observable effects rather than exact wording.
 */
test.describe('live LLM', () => {
  test.skip(!live, 'Set DEEPSEEK_API_KEY in .env.local to run this.');

  // A real multi-step agent turn: several API round trips plus tool execution.
  test.setTimeout(180_000);

  test('reads the page and answers from its real content', async ({ panel, baseURL }) => {
    const { target } = await setUpLiveModel(panel, `${baseURL}/page.html`);

    await ask(panel, 'Use take_snapshot, then reply with the exact text of the h1 heading. Be brief.');

    // A tool call must appear, proving the model chose to use the browser tools.
    await expect(panel.getByText('take_snapshot').first()).toBeVisible({ timeout: 120_000 });
    // And the answer must contain content only obtainable from the live page.
    await expect(panel.getByText(/Fixture Page/i).last()).toBeVisible({ timeout: 120_000 });

    await target.close();
  });

  test('drives the page: a model-chosen click actually changes it', async ({ panel, baseURL }) => {
    const { target } = await setUpLiveModel(panel, `${baseURL}/page.html`);

    await ask(
      panel,
      'Take a snapshot of this page, click the button labelled "Clicked 0 times", then tell me its new label.',
    );

    // The strongest possible assertion: the real page mutated because the model
    // decided to click and the tool layer carried it out.
    await expect(target.locator('#counter')).toHaveText('Clicked 1 times', { timeout: 150_000 });

    await target.close();
  });

  test('reports a bad API key as an error instead of failing silently', async ({ panel, baseURL }) => {
    await panel.evaluate(
      (settings) => chrome.storage.local.set({ 'pagehand:settings': settings }),
      { provider: 'openai-compatible', ...live!, apiKey: 'sk-definitely-invalid' },
    );
    await panel.reload();
    await panel.waitForFunction(() => typeof window.__cdp !== 'undefined');

    const target = await panel.context().newPage();
    await target.goto(`${baseURL}/page.html`);

    await ask(panel, 'What is on this page?');

    // Must surface the failure in the UI rather than leaving an empty bubble.
    await expect(
      panel.getByText(/error|invalid|unauthor|401|authentication/i).first(),
    ).toBeVisible({ timeout: 60_000 });

    await target.close();
  });
});
