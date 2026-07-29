import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { resolveUid } from '../snapshot/uidMap';

interface BoxModelResult {
  model: { content: [number, number, number, number, number, number, number, number] };
}

interface CaptureScreenshotResult {
  data: string;
}

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
      await session.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });
      const { model } = await session.send<BoxModelResult>('DOM.getBoxModel', { backendNodeId });
      const [x1, y1, , , x3, y3] = model.content;
      clip = { x: x1, y: y1, width: x3 - x1, height: y3 - y1, scale: 1 };
    }

    const { data } = await session.send<CaptureScreenshotResult>('Page.captureScreenshot', {
      format: format ?? 'png',
      clip,
    });
    return { image: `data:image/${format ?? 'png'};base64,${data}` };
  },
});
