import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { cdpSend, getBoxInPage } from '../cdp';
import { resolveUid } from '../snapshot/uidMap';

export const take_screenshot = tool({
  description: 'Takes a screenshot of the current page, or a single element if uid is given.',
  inputSchema: z.object({
    uid: z.string().optional().describe('Optional uid from take_snapshot to screenshot just that element'),
    format: z.enum(['png', 'jpeg']).optional(),
  }),
  execute: async ({ uid, format }) => {
    const session = await ensureSession();
    let clip: { x: number; y: number; width: number; height: number; scale: number } | undefined;

    if (uid) {
      const backendNodeId = resolveUid(session.getTabId(), uid);
      const box = await getBoxInPage(session, backendNodeId, `uid=${uid}`);
      clip = { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 };
    }

    const { data } = await cdpSend(session, 'Page.captureScreenshot', {
      format: format ?? 'png',
      clip,
    });
    return { image: `data:image/${format ?? 'png'};base64,${data}` };
  },
});
