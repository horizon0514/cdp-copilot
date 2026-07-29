import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { listConsoleMessages, getConsoleMessage } from '../console/ConsoleRecorder';

export const list_console_messages = tool({
  description: 'Lists console messages for the current page since the last navigation.',
  inputSchema: z.object({
    types: z.array(z.string()).optional().describe('Filter by level, e.g. ["error", "warning"]'),
    pageIdx: z.number().optional(),
    pageSize: z.number().optional(),
  }),
  execute: async ({ types, pageIdx, pageSize }) => {
    const session = await ensureSession();
    return { messages: listConsoleMessages(session.getTabId(), { types, pageIdx, pageSize }) };
  },
});

export const get_console_message = tool({
  description: 'Gets a single console message by its msgid (from list_console_messages).',
  inputSchema: z.object({
    msgid: z.number(),
  }),
  execute: async ({ msgid }) => {
    const session = await ensureSession();
    const message = getConsoleMessage(session.getTabId(), msgid);
    if (!message) throw new Error(`No console message with msgid ${msgid}`);
    return message;
  },
});
