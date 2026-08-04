import { tool } from 'ai';
import { z } from 'zod';
import { ensureSession } from './context';
import { listNetworkRequests, getNetworkRequest, getResponseBody } from '../network/NetworkRecorder';
import { clampText, MAX_BODY_CHARS } from './limits';

export const list_network_requests = tool({
  description: 'Lists network requests for the current page since the last navigation.',
  inputSchema: z.object({
    resourceTypes: z.array(z.string()).optional().describe('e.g. ["Document", "XHR", "Fetch"]'),
    pageIdx: z.number().optional(),
    pageSize: z.number().optional(),
  }),
  execute: async ({ resourceTypes, pageIdx, pageSize }) => {
    const session = await ensureSession();
    const requests = listNetworkRequests(session.getTabId(), { resourceTypes, pageIdx, pageSize });
    return { requests: requests.map(({ cdpRequestId: _cdpRequestId, ...rest }) => rest) };
  },
});

export const get_network_request = tool({
  description: 'Gets a network request by reqid, including response body when still available.',
  inputSchema: z.object({
    reqid: z.number(),
  }),
  execute: async ({ reqid }) => {
    const session = await ensureSession();
    const record = getNetworkRequest(session.getTabId(), reqid);
    if (!record) throw new Error(`No network request with reqid ${reqid}`);
    const rawBody = await getResponseBody(session, record);
    const { cdpRequestId: _cdpRequestId, ...rest } = record;
    if (rawBody == null) return { ...rest, body: rawBody };
    // Response bodies are unbounded (API dumps, HTML documents) — clamp before
    // they land in the context window.
    const { text: body, truncated } = clampText(rawBody, MAX_BODY_CHARS);
    return truncated ? { ...rest, body, bodyTruncated: true } : { ...rest, body };
  },
});
