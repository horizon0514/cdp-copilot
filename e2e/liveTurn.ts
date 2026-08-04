import type { Page } from '@playwright/test';
import { liveLlmConfig } from './env';
import type { TranscriptMessage } from './extension';

/**
 * Shared plumbing for the specs that drive a real model: seeding settings,
 * sending a message, and waiting for the turn to finish. Both live specs need
 * exactly this, and a copy in each is a copy that drifts.
 *
 * Null when no key is configured, so callers can skip cleanly.
 */
export const live = liveLlmConfig();

/** Seeds settings, reloads so the panel picks them up, then attaches to a target. */
export async function setUpLiveModel(panel: Page, targetUrl: string) {
  await panel.evaluate(
    (settings) => chrome.storage.local.set({ 'pagehand:settings': settings }),
    { provider: 'deepseek', ...live! },
  );

  // Reload for the panel to pick up settings — this also drops the previous JS
  // context, so the debugger must be re-attached afterwards.
  await panel.reload();
  await panel.waitForFunction(() => typeof window.__cdp !== 'undefined');

  const target = await panel.context().newPage();
  await target.goto(targetUrl);

  const tabId = await panel.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === url);
    if (tab?.id === undefined) throw new Error(`no tab for ${url}`);
    await window.__cdp.attach(tab.id);
    return tab.id;
  }, target.url());

  return { target, tabId };
}

export async function ask(panel: Page, prompt: string): Promise<void> {
  await panel.getByPlaceholder(/Ask anything/i).fill(prompt);
  await panel.getByRole('button', { name: 'Send' }).click();
}

/** What one turn cost, which is the whole point of the round-trip baseline. */
export interface TurnMetrics {
  /** Tool names in call order — the round-trip count is its length. */
  toolCalls: string[];
  steps: number;
  totalTokens?: number;
  finishReason: string;
  hitStepLimit: boolean;
  text: string;
  error: string | null;
}

/**
 * Sends a prompt and resolves once the turn is over, with what it cost.
 *
 * The two waits are ordered rather than combined because sendMessage adds the
 * user message, the assistant placeholder, and the streaming flag in one
 * synchronous block — so a transcript holding both messages is already
 * streaming, and no fast turn can slip between the two checks.
 */
export async function runTurn(
  panel: Page,
  prompt: string,
  { timeout = 150_000 }: { timeout?: number } = {},
): Promise<TurnMetrics> {
  const before = await panel.evaluate(() => window.__cdp.transcript().messages.length);

  await ask(panel, prompt);
  await panel.waitForFunction(
    (n) => window.__cdp.transcript().messages.length >= n + 2,
    before,
    { timeout: 30_000 },
  );
  await panel.waitForFunction(() => !window.__cdp.transcript().isStreaming, undefined, { timeout });

  const last = await panel.evaluate(() => {
    const { messages } = window.__cdp.transcript();
    return messages[messages.length - 1];
  });

  return metricsOf(last);
}

function metricsOf(message: TranscriptMessage): TurnMetrics {
  return {
    toolCalls: message.toolCalls.map((tc) => tc.name),
    steps: message.stop?.steps ?? 0,
    totalTokens: message.stop?.totalTokens,
    finishReason: message.stop?.finishReason ?? 'unknown',
    hitStepLimit: message.stop?.hitStepLimit ?? false,
    text: message.text,
    error: message.error,
  };
}

/**
 * Renders one scenario's numbers. These go to stdout and into the Playwright
 * report as an attachment, because the baseline is only useful if it can be
 * compared against the same three numbers after a change.
 */
export function formatMetrics(label: string, m: TurnMetrics): string {
  const counts = new Map<string, number>();
  for (const name of m.toolCalls) counts.set(name, (counts.get(name) ?? 0) + 1);
  const breakdown = [...counts.entries()].map(([name, n]) => `${name}×${n}`).join(', ');

  return [
    `[roundtrips] ${label}`,
    `  tool calls : ${m.toolCalls.length}${breakdown ? ` (${breakdown})` : ''}`,
    `  steps      : ${m.steps}${m.hitStepLimit ? ' (HIT STEP LIMIT)' : ''}`,
    `  tokens     : ${m.totalTokens ?? 'n/a'}`,
    `  finish     : ${m.finishReason}`,
    `  order      : ${m.toolCalls.join(' → ') || '(none)'}`,
  ].join('\n');
}
