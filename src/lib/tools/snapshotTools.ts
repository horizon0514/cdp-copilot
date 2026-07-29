import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { takeSnapshot as takeSnapshotImpl } from '../snapshot/takeSnapshot';

export const take_snapshot = tool({
  description:
    'Take a text/accessibility snapshot of the current page. Every meaningful element gets a ' +
    'short uid you can pass to click/fill/hover/etc. uids are only valid until the next take_snapshot call.',
  inputSchema: z.object({}),
  execute: async () => {
    const session = await ensureSession();
    const result = await takeSnapshotImpl(session);
    return {
      url: (await chrome.tabs.get(session.getTabId())).url ?? '',
      snapshot: result.text,
      uidCount: result.uidCount,
      truncated: result.truncated,
    };
  },
});
