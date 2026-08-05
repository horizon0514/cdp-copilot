import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { listPages, newPage, selectPage, closePage } from '../pages/PageManager';
import { navigate, reload, traverseHistory, waitForText } from '../cdp';

export const navigate_page = tool({
  description: 'Navigates the current page: go to a URL, or back/forward/reload.',
  inputSchema: z.object({
    type: z.enum(['url', 'back', 'forward', 'reload']).default('url'),
    url: z.string().optional().describe('Target URL (only for type="url")'),
  }),
  execute: async ({ type, url }, { abortSignal }) => {
    const session = await ensureSession();
    const wait = { signal: abortSignal };
    if (type === 'url') {
      if (!url) throw new Error('url is required when type="url"');
      await navigate(session, url, wait);
    } else if (type === 'reload') {
      await reload(session, wait);
    } else {
      await traverseHistory(session, type === 'back' ? -1 : 1, wait);
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
    const found = await waitForText(session, text, {
      timeoutMs: timeout ?? 10_000,
      signal: abortSignal,
    });
    return { found };
  },
});
