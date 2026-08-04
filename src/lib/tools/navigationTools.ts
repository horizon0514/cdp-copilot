import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { listPages, newPage, selectPage, closePage } from '../pages/PageManager';

export const navigate_page = tool({
  description: 'Navigates the current page: go to a URL, or back/forward/reload.',
  inputSchema: z.object({
    type: z.enum(['url', 'back', 'forward', 'reload']).default('url'),
    url: z.string().optional().describe('Target URL (only for type="url")'),
  }),
  execute: async ({ type, url }) => {
    const session = await ensureSession();
    if (type === 'url') {
      if (!url) throw new Error('url is required when type="url"');
      await session.send('Page.navigate', { url });
    } else if (type === 'reload') {
      await session.send('Page.reload');
    } else {
      await chrome.tabs[type === 'back' ? 'goBack' : 'goForward'](session.getTabId());
    }
    return { ok: true };
  },
});

export const new_page = tool({
  description: 'Opens a new tab and loads a URL.',
  inputSchema: z.object({
    url: z.string(),
    background: z.boolean().optional().describe('Open without bringing to front. Default false.'),
  }),
  execute: async ({ url, background }) => newPage(url, { background }),
});

export const list_pages = tool({
  description: 'Lists all open pages (tabs).',
  inputSchema: z.object({}),
  execute: async () => {
    // favIconUrl is decoration for the picker; in the transcript it is only
    // a long URL per tab that the model has no use for.
    const pages = (await listPages()).map(({ favIconUrl: _favIconUrl, ...page }) => page);
    return { pages };
  },
});

export const select_page = tool({
  description:
    'Rebinds the agent to another tab for future tool calls. Do not use merely because a tab was ' +
    '@-mentioned — mentions already carry identity (and often page text). Only call this when the ' +
    'user asks to switch to or interact with that tab. bringToFront defaults to false; set true ' +
    'only when the user should see the tab.',
  inputSchema: z.object({
    pageId: z.number().describe('The tab id from list_pages'),
    bringToFront: z.boolean().optional(),
  }),
  execute: async ({ pageId, bringToFront }) => {
    await selectPage(pageId, { bringToFront });
    return { ok: true };
  },
});

export const close_page = tool({
  description: 'Closes a page by its id. The last open page cannot be closed.',
  inputSchema: z.object({
    pageId: z.number(),
  }),
  execute: async ({ pageId }) => {
    await closePage(pageId);
    return { ok: true };
  },
});

export const wait_for = tool({
  description:
    'Waits for any of the given texts to appear on the page. Use it for waiting on something the page ' +
    'does by itself — a navigation settling, a slow fetch. If you are already inside an evaluate_script ' +
    'program, await there instead of stepping back out to this tool.',
  inputSchema: z.object({
    text: z.array(z.string()).min(1),
    timeout: z.number().optional().describe('Max wait time in ms. Default 10000.'),
  }),
  execute: async ({ text, timeout }, { abortSignal }) => {
    const session = await ensureSession();
    const deadline = Date.now() + (timeout ?? 10_000);
    // Without this check a stop can't land until the poll's deadline passes.
    while (Date.now() < deadline && !abortSignal?.aborted) {
      const { result } = await session.send<{ result: { value: boolean } }>('Runtime.evaluate', {
        expression: `(() => { const t = document.body.innerText; return ${JSON.stringify(text)}.some(s => t.includes(s)); })()`,
        returnByValue: true,
      });
      if (result.value) return { found: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { found: false };
  },
});
