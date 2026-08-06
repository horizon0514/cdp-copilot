import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, type Session } from '../../lib/auth/session';
import { SignInCancelled, awaitSession, sendSignInLink, signOut } from '../../lib/auth/signIn';
import { useT } from '../i18n/useT';

/**
 * The sign-in state machine, kept apart from what draws it.
 *
 * Two very different surfaces need the same machine: the full-height sign-in
 * screen someone lands on with no account, and the one-line "signed in as …"
 * row in settings. Sharing the hook rather than one component with a `variant`
 * prop keeps the awkward parts — the link that resolves in another tab, minutes
 * later, possibly after this panel was closed and reopened — written once.
 */
export interface SignIn {
  session: Session | null;
  /** True until the stored session has been read; nothing should be drawn on a
   * guess about whether someone is signed in. */
  loading: boolean;
  email: string;
  setEmail: (value: string) => void;
  /** The link has been sent and we are waiting for it to be opened. */
  sent: boolean;
  busy: boolean;
  error: string | null;
  send: () => void;
  /** Back to the email field, to correct a typo in the address. */
  reset: () => void;
  signOut: () => void;
}

export function useSignIn(onSignedIn: () => void): SignIn {
  const t = useT();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Mirrors `session` so the storage listener can tell a fresh sign-in from a
  // token refresh without re-subscribing on every change.
  const known = useRef<Session | null>(null);

  useEffect(() => {
    void getSession().then((s) => {
      known.current = s;
      setSession(s);
      setLoading(false);
    });
  }, []);

  // Sign-in finishes in another tab, possibly minutes later, and the panel may
  // have been closed and reopened in between — so the signed-in state comes
  // from storage rather than only from the promise below.
  useEffect(() => {
    const onChanged = (_changes: unknown, area: string) => {
      if (area !== 'local') return;
      void getSession().then((next) => {
        const isNew = next !== null && known.current === null;
        known.current = next;
        setSession(next);
        if (isNew) onSignedIn();
      });
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [onSignedIn]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(() => {
    setBusy(true);
    setError(null);
    void sendSignInLink(email.trim())
      .then(() => {
        setSent(true);
        const controller = new AbortController();
        abort.current?.abort();
        abort.current = controller;
        // Not awaited for its value — the storage listener above updates the
        // UI. This exists to surface a timeout rather than wait in silence.
        awaitSession(controller.signal).catch((err) => {
          // `awaitSession` rejects the same way whether the ten minutes ran out
          // or we cancelled it ourselves — sending a second link, or unmounting.
          // Only the first is news; the rest would report "expired" about a link
          // that was just replaced.
          if (!(err instanceof SignInCancelled) || controller.signal.aborted) return;
          setError(t('account.timedOut'));
          setSent(false);
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }, [email, t]);

  const reset = useCallback(() => {
    abort.current?.abort();
    setSent(false);
    setError(null);
  }, []);

  const handleSignOut = useCallback(() => {
    void signOut().then(() => {
      known.current = null;
      setSession(null);
      setSent(false);
    });
  }, []);

  return {
    session,
    loading,
    email,
    setEmail,
    sent,
    busy,
    error,
    send,
    reset,
    signOut: handleSignOut,
  };
}
