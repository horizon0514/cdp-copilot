import { DebuggerSession } from '../debugger-bridge/DebuggerSession';
import { registerNavigationHook } from '../debugger-bridge/navigationInvalidation';

export interface ConsoleMessage {
  msgid: number;
  source: string;
  level: string;
  text: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
}

const MAX_ENTRIES = 500;
const buffersByTab = new Map<number, ConsoleMessage[]>();
let nextId = 1;

registerNavigationHook((tabId) => buffersByTab.delete(tabId));

function push(tabId: number, msg: Omit<ConsoleMessage, 'msgid'>): void {
  const buf = buffersByTab.get(tabId) ?? [];
  buf.push({ msgid: nextId++, ...msg });
  if (buf.length > MAX_ENTRIES) buf.shift();
  buffersByTab.set(tabId, buf);
}

interface RemoteObject {
  type: string;
  value?: unknown;
  description?: string;
}

function formatArg(obj: RemoteObject): string {
  if (obj.type === 'string') return String(obj.value);
  if ('value' in obj) return JSON.stringify(obj.value);
  return obj.description ?? `<${obj.type}>`;
}

interface LogEntryAddedParams {
  entry: { source: string; level: string; text: string; timestamp: number; url?: string; lineNumber?: number };
}

interface ConsoleAPICalledParams {
  type: string;
  args: RemoteObject[];
  timestamp: number;
}

export async function attachConsoleRecorder(session: DebuggerSession): Promise<void> {
  const tabId = session.getTabId();
  await session.send('Log.enable');
  await session.send('Runtime.enable');

  session.on('Log.entryAdded', (params) => {
    const { entry } = params as LogEntryAddedParams;
    push(tabId, {
      source: entry.source,
      level: entry.level,
      text: entry.text,
      timestamp: entry.timestamp,
      url: entry.url,
      lineNumber: entry.lineNumber,
    });
  });

  session.on('Runtime.consoleAPICalled', (params) => {
    const p = params as ConsoleAPICalledParams;
    push(tabId, {
      source: 'console',
      level: p.type,
      text: p.args.map(formatArg).join(' '),
      timestamp: p.timestamp,
    });
  });
}

export interface ListConsoleOptions {
  types?: string[];
  pageIdx?: number;
  pageSize?: number;
}

export function listConsoleMessages(tabId: number, opts: ListConsoleOptions = {}): ConsoleMessage[] {
  let messages = buffersByTab.get(tabId) ?? [];
  if (opts.types?.length) {
    messages = messages.filter((m) => opts.types!.includes(m.level));
  }
  if (opts.pageSize !== undefined) {
    const start = (opts.pageIdx ?? 0) * opts.pageSize;
    messages = messages.slice(start, start + opts.pageSize);
  }
  return messages;
}

export function getConsoleMessage(tabId: number, msgid: number): ConsoleMessage | null {
  return buffersByTab.get(tabId)?.find((m) => m.msgid === msgid) ?? null;
}
