import { useEffect, useRef, useState } from 'react';
import { getSession, type Session } from '../../lib/auth/session';
import { SignInCancelled, signIn, signOut } from '../../lib/auth/signIn';
import { useI18n } from '../i18n/useT';
import { Button } from './ui/button';

/**
 * Sign-in state for hosted mode.
 *
 * The whole product difference lives here: BYOK asks for a key, hosted asks for
 * an account. Which is why this sits where the API key field does for BYOK,
 * rather than somewhere separate.
 */
export function AccountField() {
  const { t } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const abort = useRef<AbortController | null>(null);

  // Sign-in finishes in another tab, possibly minutes later — the panel could
  // be closed and reopened in between, so the session is picked up from storage
  // rather than only from the promise below.
  useEffect(() => {
    const onChanged = (_c: unknown, area: string) => {
      if (area === 'local') void getSession().then(setSession);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      setSession(await signIn(abort.current.signal));
    } catch (err) {
      // Giving up on the flow is a decision, not a failure — say nothing.
      if (!(err instanceof SignInCancelled)) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
  };

  if (loading) return null;

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      {session ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
            {session.email ?? t('account.signedIn')}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
            {t('account.signOut')}
          </Button>
        </div>
      ) : (
        <>
          <Button type="button" onClick={handleSignIn} disabled={busy} className="w-full">
            {busy ? t('account.signingIn') : t('account.signIn')}
          </Button>
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
