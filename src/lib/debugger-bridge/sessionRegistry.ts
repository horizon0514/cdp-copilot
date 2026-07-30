import { DebuggerSession, assertAttachable } from './DebuggerSession';
import { wireNavigationInvalidation } from './navigationInvalidation';
import { attachConsoleRecorder } from '../console/ConsoleRecorder';
import { attachNetworkRecorder } from '../network/NetworkRecorder';

const LOCK_KEY = 'cdp-copilot:lock';
const LOCK_STALE_MS = 15_000;

interface Lock {
  ownerId: string;
  windowId: number;
  tabId: number;
  attachedAt: number;
}

export class AlreadyActiveElsewhereError extends Error {
  constructor() {
    super('cdp-copilot is already active in another window. v1 supports a single active window at a time.');
    this.name = 'AlreadyActiveElsewhereError';
  }
}

/**
 * Owns the single chrome.debugger attachment for this side panel process, and
 * guards against a second window's side panel racing to attach a second one
 * (side panels are per-window documents, so this can't be enforced with
 * in-memory state alone — a chrome.storage.session lock coordinates across
 * windows).
 */
class SessionRegistry {
  private readonly ownerId = crypto.randomUUID();
  private session: DebuggerSession | null = null;
  private listeners = new Set<(session: DebuggerSession | null) => void>();
  private queue: Promise<unknown> = Promise.resolve();

  getAttached(): DebuggerSession | null {
    return this.session && !this.session.isDetached() ? this.session : null;
  }

  onChange(handler: (session: DebuggerSession | null) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.getAttached());
  }

  /**
   * Runs attach/detach one at a time. The SDK executes a step's tool calls in
   * parallel, so several tools routinely reach ensureSession() at once; without
   * this, each would see "nothing attached" and race to attach, and Chrome
   * rejects the losers with "Another debugger is already attached".
   */
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  attach(tabId: number): Promise<DebuggerSession> {
    return this.serialize(() => this.attachNow(tabId));
  }

  private async attachNow(tabId: number): Promise<DebuggerSession> {
    const existing = this.getAttached();
    if (existing && existing.getTabId() === tabId) return existing;

    // Check the target is attachable *before* giving up a working session, so a
    // rejected switch leaves the agent where it was rather than with nothing.
    await assertAttachable(tabId);
    await this.assertLockAvailable();

    if (existing) {
      await existing.detach();
      this.session = null;
    }

    const session = await DebuggerSession.attach(tabId);
    session.setOnExternalDetach(() => {
      this.session = null;
      void this.releaseLock();
      this.notify();
    });
    await wireNavigationInvalidation(session);
    await attachConsoleRecorder(session);
    await attachNetworkRecorder(session);

    this.session = session;
    await this.writeLock(tabId);
    this.notify();
    return session;
  }

  detach(): Promise<void> {
    return this.serialize(async () => {
      if (this.session) {
        await this.session.detach();
        this.session = null;
      }
      await this.releaseLock();
      this.notify();
    });
  }

  private async assertLockAvailable(): Promise<void> {
    const { [LOCK_KEY]: lock } = (await chrome.storage.session.get(LOCK_KEY)) as { [LOCK_KEY]?: Lock };
    if (!lock) return;
    if (lock.ownerId === this.ownerId) return;
    const isStale = Date.now() - lock.attachedAt > LOCK_STALE_MS;
    if (isStale) return;

    const win = await chrome.windows.getCurrent();
    if (win.id !== lock.windowId) {
      throw new AlreadyActiveElsewhereError();
    }
  }

  private async writeLock(tabId: number): Promise<void> {
    const win = await chrome.windows.getCurrent();
    const lock: Lock = { ownerId: this.ownerId, windowId: win.id ?? -1, tabId, attachedAt: Date.now() };
    await chrome.storage.session.set({ [LOCK_KEY]: lock });
  }

  private async releaseLock(): Promise<void> {
    const { [LOCK_KEY]: lock } = (await chrome.storage.session.get(LOCK_KEY)) as { [LOCK_KEY]?: Lock };
    if (lock?.ownerId === this.ownerId) {
      await chrome.storage.session.remove(LOCK_KEY);
    }
  }
}

export const sessionRegistry = new SessionRegistry();
