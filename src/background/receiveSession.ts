import { saveSession, type Session } from '../lib/auth/session';

/**
 * Receiving a finished sign-in from the website.
 *
 * The sign-in page runs in an ordinary tab — which is what lets the emailed
 * link work at all, since a link opens wherever the mail client sends it rather
 * than inside a window the extension controls. A tab cannot hand anything back
 * through a redirect, so `externally_connectable` in the manifest lets that one
 * origin call `chrome.runtime.sendMessage` instead.
 *
 * Only the background worker can receive those messages, hence this file rather
 * than the panel.
 */

const SESSION_MESSAGE = 'pagehand:session';

/**
 * `externally_connectable` already restricts senders to the origins listed in
 * the manifest, and Chrome — not the page — fills in `sender.url`. Re-checking
 * it here keeps the guarantee legible at the point where a credential is
 * accepted, rather than only in a manifest field someone might later widen.
 */
function fromTrustedOrigin(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.url) return false;
  try {
    return new URL(sender.url).origin === 'https://pagehand.app';
  } catch {
    return false;
  }
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.accessToken === 'string' &&
    typeof s.refreshToken === 'string' &&
    typeof s.expiresAt === 'number'
  );
}

export function listenForSession(): void {
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return;
    const { type, session } = message as { type?: unknown; session?: unknown };
    if (type !== SESSION_MESSAGE) return;

    if (!fromTrustedOrigin(sender) || !isSession(session)) {
      sendResponse({ ok: false });
      return;
    }

    // The panel notices through chrome.storage.onChanged, so signing in from a
    // tab updates an already-open Settings screen without a reload.
    void saveSession(session).then(() => sendResponse({ ok: true }));
    // Keeps the message channel open across the await.
    return true;
  });
}
