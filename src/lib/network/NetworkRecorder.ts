import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { registerNavigationHook } from '../debugger-bridge/navigationInvalidation';

export interface NetworkRequestRecord {
  reqid: number;
  cdpRequestId: string;
  url: string;
  method: string;
  resourceType?: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  mimeType?: string;
  timestamp: number;
  finished: boolean;
  failed?: string;
  encodedDataLength?: number;
}

const MAX_ENTRIES = 500;
const buffersByTab = new Map<number, NetworkRequestRecord[]>();
const byCdpRequestId = new Map<string, NetworkRequestRecord>();
let nextReqId = 1;

registerNavigationHook((tabId) => {
  const buf = buffersByTab.get(tabId);
  buf?.forEach((r) => byCdpRequestId.delete(r.cdpRequestId));
  buffersByTab.delete(tabId);
});

interface RequestWillBeSentParams {
  requestId: string;
  request: { url: string; method: string; headers: Record<string, string> };
  type?: string;
  timestamp: number;
}

interface ResponseReceivedParams {
  requestId: string;
  response: { status: number; statusText: string; headers: Record<string, string>; mimeType: string };
}

interface LoadingFinishedParams {
  requestId: string;
  encodedDataLength: number;
}

interface LoadingFailedParams {
  requestId: string;
  errorText: string;
}

export async function attachNetworkRecorder(session: DebuggerSession): Promise<void> {
  const tabId = session.getTabId();
  await session.send('Network.enable');

  session.on('Network.requestWillBeSent', (params) => {
    const p = params as RequestWillBeSentParams;
    const record: NetworkRequestRecord = {
      reqid: nextReqId++,
      cdpRequestId: p.requestId,
      url: p.request.url,
      method: p.request.method,
      resourceType: p.type,
      requestHeaders: p.request.headers,
      timestamp: p.timestamp,
      finished: false,
    };
    byCdpRequestId.set(p.requestId, record);

    const buf = buffersByTab.get(tabId) ?? [];
    buf.push(record);
    if (buf.length > MAX_ENTRIES) {
      const removed = buf.shift();
      if (removed) byCdpRequestId.delete(removed.cdpRequestId);
    }
    buffersByTab.set(tabId, buf);
  });

  session.on('Network.responseReceived', (params) => {
    const p = params as ResponseReceivedParams;
    const record = byCdpRequestId.get(p.requestId);
    if (!record) return;
    record.status = p.response.status;
    record.statusText = p.response.statusText;
    record.responseHeaders = p.response.headers;
    record.mimeType = p.response.mimeType;
  });

  session.on('Network.loadingFinished', (params) => {
    const p = params as LoadingFinishedParams;
    const record = byCdpRequestId.get(p.requestId);
    if (!record) return;
    record.finished = true;
    record.encodedDataLength = p.encodedDataLength;
  });

  session.on('Network.loadingFailed', (params) => {
    const p = params as LoadingFailedParams;
    const record = byCdpRequestId.get(p.requestId);
    if (!record) return;
    record.finished = true;
    record.failed = p.errorText;
  });
}

export interface ListNetworkOptions {
  resourceTypes?: string[];
  pageIdx?: number;
  pageSize?: number;
}

export function listNetworkRequests(tabId: number, opts: ListNetworkOptions = {}): NetworkRequestRecord[] {
  let requests = buffersByTab.get(tabId) ?? [];
  if (opts.resourceTypes?.length) {
    requests = requests.filter((r) => r.resourceType && opts.resourceTypes!.includes(r.resourceType));
  }
  if (opts.pageSize !== undefined) {
    const start = (opts.pageIdx ?? 0) * opts.pageSize;
    requests = requests.slice(start, start + opts.pageSize);
  }
  return requests;
}

export function getNetworkRequest(tabId: number, reqid: number): NetworkRequestRecord | null {
  return buffersByTab.get(tabId)?.find((r) => r.reqid === reqid) ?? null;
}

interface GetResponseBodyResult {
  body: string;
  base64Encoded: boolean;
}

/** Best-effort: fails once the request's page has navigated away, since Chrome
 * discards response bodies at that point. Callers should treat this as optional. */
export async function getResponseBody(session: DebuggerSession, record: NetworkRequestRecord): Promise<string | null> {
  try {
    const result = await session.send<GetResponseBodyResult>('Network.getResponseBody', {
      requestId: record.cdpRequestId,
    });
    return result.base64Encoded ? atob(result.body) : result.body;
  } catch {
    return null;
  }
}
