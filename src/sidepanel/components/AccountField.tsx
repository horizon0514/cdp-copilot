import { FormEvent, useEffect, useRef, useState } from 'react';
import { getSession, type Session } from '../../lib/auth/session';
import { SignInCancelled, awaitSession, sendSignInLink, signOut } from '../../lib/auth/signIn';
import { useI18n } from '../i18n/useT';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * Sign-in state for hosted mode.
 *
 * The whole product difference lives here: BYOK asks for a key, hosted asks for
 * an account. Which is why this sits where the API key field does for BYOK,
 * rather than somewhere separate.
 *
 * The email is collected here rather than on a web page so that signing in
 * opens exactly one tab — the one the emailed link opens — instead of one to
 * show a text field and a second to finish, leaving the first stranded.
 *
 * `onSignedIn` exists because hosted mode has nothing else to configure: the
 * account is the configuration. Leaving the settings unsaved until someone
 * presses a button would mean a panel that looks ready and an extension that
 * silently does nothing — which is exactly what happened.
 */
export function AccountField({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Mirrors `session` so the storage listener can tell a fresh sign-in from a
  // refresh without re-subscribing on every change.
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
    const onChanged = (_c: unknown, area: string) => {
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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendSignInLink(email.trim());
      setSent(true);
      abort.current?.abort();
      abort.current = new AbortController();
      // Not awaited for its value — the storage listener above updates the UI.
      // This exists to surface a timeout rather than wait forever in silence.
      awaitSession(abort.current.signal).catch((err) => {
        if (!(err instanceof SignInCancelled)) return;
        setError(t('account.timedOut'));
        setSent(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    known.current = null;
    setSession(null);
    setSent(false);
  };

  if (loading) return null;

  if (session) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
          {session.email ?? t('account.signedIn')}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
          {t('account.signOut')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      {sent ? (
        <>
          <p className="text-[12px] leading-[1.45] text-fg">{t('account.sent', { email })}</p>
          <p className="text-[11px] leading-[1.4] text-fg-tertiary">{t('account.sentHint')}</p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="self-start text-[11px] text-fg-tertiary underline underline-offset-2"
          >
            {t('account.useAnother')}
          </button>
        </>
      ) : (
        // Not a <form>: this renders inside the settings form, and nesting one
        // form in another is invalid — the inner submit would save settings.
        <>
          <div className="flex gap-1.5">
            <Input
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSend(e);
              }}
              className="min-w-0 flex-1 text-[12px]"
            />
            <Button type="button" onClick={handleSend} disabled={busy || !email.includes('@')}>
              {busy ? t('account.sending') : t('account.signIn')}
            </Button>
          </div>
          <p className="text-[11px] leading-[1.4] text-fg-tertiary">{t('account.signInHint')}</p>
        </>
      )}
      {error && (
        <p role="alert" className="text-[11px] leading-[1.4] text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
