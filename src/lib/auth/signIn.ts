import { HOSTED_BASE_URL } from '../storage/schema';
import { clearSession, getSession, type Session } from './session';

/**
 * Sign-in, driven from the side panel.
 *
 * The panel asks for the email and posts it here; the emailed link is what
 * finally opens a tab, and that tab hands the session back through
 * `chrome.runtime.sendMessage` — permitted because the manifest names that
 * origin under `externally_connectable`.
 *
 * Notably *not* `chrome.identity.launchWebAuthFlow`, the obvious choice: it
 * watches a window it opened for the redirect that ends the flow, and an
 * emailed link opens wherever the mail client sends it — another window
 * entirely. The flow would wait forever on a navigation it cannot see.
 *
 * The trade, worth stating plainly: a link removes any code to transcribe, but
 * only works when opened in this Chrome profile. Reading the mail on a phone
 * gets the user nowhere. That reverses once a custom SMTP sender lets the email
 * carry a code as well.
 */

/** Long enough to find the mail, read it, and click through. */
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

export class SignInCancelled extends Error {}

export async function sendSignInLink(email: string): Promise<void> {
  const res = await fetch(`${HOSTED_BASE_URL}/auth/send-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'Could not send the sign-in email.');
  }
}

/**
 * Resolves once the session lands in storage, which the background worker
 * writes when the tab opened by the emailed link reports in.
 */
export function awaitSession(signal: AbortSignal): Promise<Session> {
  return new Promise((resolve, reject) => {
    const finish = (fn: () => void) => {
      chrome.storage.onChanged.removeListener(onChanged);
      signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
      fn();
    };

    const onChanged = (_changes: unknown, area: string) => {
      if (area !== 'local') return;
      void getSession().then((session) => {
        if (session) finish(() => resolve(session));
      });
    };
    const onAbort = () => finish(() => reject(new SignInCancelled('Sign-in was cancelled.')));
    const timer = setTimeout(
      () => finish(() => reject(new SignInCancelled('Sign-in timed out.'))),
      SIGN_IN_TIMEOUT_MS,
    );

    chrome.storage.onChanged.addListener(onChanged);
    signal.addEventListener('abort', onAbort);
  });
}

export async function signOut(): Promise<void> {
  await clearSession();
}
