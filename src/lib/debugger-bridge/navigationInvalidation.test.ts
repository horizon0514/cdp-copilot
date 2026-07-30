import { describe, it, expect, beforeEach } from 'vitest';
import type { DebuggerSession } from './DebuggerSession';
import { wireNavigationInvalidation } from './navigationInvalidation';
import { attachConsoleRecorder, listConsoleMessages } from '../console/ConsoleRecorder';
import { attachNetworkRecorder, listNetworkRequests } from '../network/NetworkRecorder';
import { beginSnapshot, resolveUid, UnknownUidError } from '../snapshot/uidMap';

/** Minimal stand-in for a live CDP session: records subscriptions so the test
 * can push protocol events at the modules under test. */
function fakeSession(tabId: number) {
  const handlers = new Map<string, ((params: unknown) => void)[]>();

  const session = {
    getTabId: () => tabId,
    send: async () => ({}),
    on(method: string, handler: (params: unknown) => void) {
      const list = handlers.get(method) ?? [];
      list.push(handler);
      handlers.set(method, list);
      return () => {};
    },
  };

  return {
    session: session as unknown as DebuggerSession,
    emit(method: string, params: unknown) {
      for (const h of handlers.get(method) ?? []) h(params);
    },
  };
}

async function wireAll(tabId: number) {
  const fake = fakeSession(tabId);
  await wireNavigationInvalidation(fake.session);
  await attachConsoleRecorder(fake.session);
  await attachNetworkRecorder(fake.session);
  return fake;
}

function pushConsoleMessage(fake: { emit: (m: string, p: unknown) => void }) {
  fake.emit('Runtime.consoleAPICalled', {
    type: 'error',
    args: [{ type: 'string', value: 'boom' }],
    timestamp: 1,
  });
}

function pushNetworkRequest(fake: { emit: (m: string, p: unknown) => void }, requestId: string) {
  fake.emit('Network.requestWillBeSent', {
    requestId,
    request: { url: 'https://example.com/a', method: 'GET', headers: {} },
    type: 'XHR',
    timestamp: 1,
  });
}

const mainFrame = { frame: { id: 'root' } };
const subFrame = { frame: { id: 'child', parentId: 'root' } };

describe('navigation invalidation', () => {
  let tabId = 100;
  beforeEach(() => {
    tabId += 1; // module state is shared within the file — isolate each test
  });

  it('captures console and network activity while attached', async () => {
    const fake = await wireAll(tabId);

    pushConsoleMessage(fake);
    pushNetworkRequest(fake, 'r1');

    expect(listConsoleMessages(tabId)).toHaveLength(1);
    expect(listConsoleMessages(tabId)[0]).toMatchObject({ level: 'error', text: 'boom' });
    expect(listNetworkRequests(tabId)).toHaveLength(1);
    expect(listNetworkRequests(tabId)[0]).toMatchObject({ url: 'https://example.com/a', method: 'GET' });
  });

  it('clears console, network and uid state on a main-frame navigation', async () => {
    const fake = await wireAll(tabId);
    pushConsoleMessage(fake);
    pushNetworkRequest(fake, 'r2');
    beginSnapshot(tabId).register(900);

    expect(resolveUid(tabId, '1')).toBe(900);

    fake.emit('Page.frameNavigated', mainFrame);

    expect(listConsoleMessages(tabId)).toHaveLength(0);
    expect(listNetworkRequests(tabId)).toHaveLength(0);
    // Stale uids must fail loudly rather than resolve to a detached node.
    expect(() => resolveUid(tabId, '1')).toThrow(UnknownUidError);
  });

  it('ignores subframe navigations, which do not reset the page', async () => {
    const fake = await wireAll(tabId);
    pushConsoleMessage(fake);
    pushNetworkRequest(fake, 'r3');
    beginSnapshot(tabId).register(901);

    fake.emit('Page.frameNavigated', subFrame);

    expect(listConsoleMessages(tabId)).toHaveLength(1);
    expect(listNetworkRequests(tabId)).toHaveLength(1);
    expect(resolveUid(tabId, '1')).toBe(901);
  });

  it('only clears the navigating tab', async () => {
    const other = tabId + 500;
    const fake = await wireAll(tabId);
    const otherFake = await wireAll(other);

    pushConsoleMessage(fake);
    pushConsoleMessage(otherFake);

    fake.emit('Page.frameNavigated', mainFrame);

    expect(listConsoleMessages(tabId)).toHaveLength(0);
    expect(listConsoleMessages(other)).toHaveLength(1);
  });
});

describe('recorder enrichment', () => {
  it('folds response and completion events into the originating request', async () => {
    const tabId = 300;
    const fake = await wireAll(tabId);
    pushNetworkRequest(fake, 'req-1');

    fake.emit('Network.responseReceived', {
      requestId: 'req-1',
      response: { status: 404, statusText: 'Not Found', headers: {}, mimeType: 'text/html' },
    });
    fake.emit('Network.loadingFinished', { requestId: 'req-1', encodedDataLength: 1234 });

    expect(listNetworkRequests(tabId)[0]).toMatchObject({
      status: 404,
      statusText: 'Not Found',
      finished: true,
      encodedDataLength: 1234,
    });
  });

  it('records a failed request with its error text', async () => {
    const tabId = 301;
    const fake = await wireAll(tabId);
    pushNetworkRequest(fake, 'req-2');

    fake.emit('Network.loadingFailed', { requestId: 'req-2', errorText: 'net::ERR_TIMED_OUT' });

    expect(listNetworkRequests(tabId)[0]).toMatchObject({ finished: true, failed: 'net::ERR_TIMED_OUT' });
  });

  it('filters console messages by level and network requests by resource type', async () => {
    const tabId = 302;
    const fake = await wireAll(tabId);
    pushConsoleMessage(fake); // level 'error'
    fake.emit('Runtime.consoleAPICalled', { type: 'log', args: [{ type: 'string', value: 'hi' }], timestamp: 2 });
    pushNetworkRequest(fake, 'req-3'); // type 'XHR'

    expect(listConsoleMessages(tabId, { types: ['error'] })).toHaveLength(1);
    expect(listNetworkRequests(tabId, { resourceTypes: ['XHR'] })).toHaveLength(1);
    expect(listNetworkRequests(tabId, { resourceTypes: ['Image'] })).toHaveLength(0);
  });
});
