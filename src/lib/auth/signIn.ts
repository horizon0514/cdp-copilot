import { clearSession, getSession, type Session } from './session';

/**
 * Sign-in, driven from the side panel.
 *
 * Opens the sign-in page in an ordinary tab and waits for the session to show
 * up in storage. The page delivers it by calling `chrome.runtime.sendMessage`,
 * which the background worker accepts because the manifest's
 * `externally_connectable` names that origin.
 *
 * Not `chrome.identity.launchWebAuthFlow`, which would be the obvious choice:
 * it watches a window it opened for a redirect, and an emailed sign-in link
 * opens wherever the user's mail client sends it — another window entirely, or
 * another browser. The flow would sit there waiting for a navigation that
 * happens somewhere it cannot see. A plain tab has no such requirement: the
 * link can be opened from anywhere in this browser and still lands home.
 *
 * The cost, worth stating: the link must be opened in *this* Chrome profile.
 * Reading the mail on a phone gets the user nowhere. That is the trade for
 * dropping the manual code entry, and it reverses once a custom SMTP sender
 * lets the email carry both a link and a code.
 */

/** Always the deployed site: `externally_connectable` cannot name localhost,
 * so a locally served sign-in page could never message the extension. */
const SIGN_IN_URL = 'https://pagehand.app/auth/extension';

/** Long enough to find the mail, read it, and click through. */
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

export class SignInCancelled extends Error {}

/** Resolves when a session appears in storage, or rejects on timeout/abort. */
function awaitSession(signal: AbortSignal): Promise<Session> {
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

export async function signIn(signal: AbortSignal): Promise<Session> {
  const waiting = awaitSession(signal);
  await chrome.tabs.create({ url: SIGN_IN_URL });
  return waiting;
}

export async function signOut(): Promise<void> {
  await clearSession();
}
