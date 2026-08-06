import { useEffect, useState } from 'react';
import { getAccessToken, getSession } from '../../lib/auth/session';
import { isHosted, type Settings } from '../../lib/storage/schema';

/**
 * Whether the panel is set up for hosted but has no account to run it with.
 *
 * The failure this prevents is the expensive kind: hosted settings with a dead
 * session look completely normal — composer enabled, suggestions offered — until
 * a turn is a minute and several tool calls in and a step throws
 * `NotSignedInError`. Everything that ran is wasted, and the reason arrives at
 * the worst possible moment. Cheaper to say it before anyone types.
 *
 * The opening check goes through `getAccessToken`, not `getSession`: a stored
 * session whose refresh token has been revoked is indistinguishable from a live
 * one until something tries to use it. That call refreshes when a refresh is
 * due, and clears the session when the server rejects it — so one request at
 * panel-open buys a gate that is actually true.
 */
export function useHostedAuth(settings: Settings | null): { needsSignIn: boolean } {
  const hosted = settings != null && isHosted(settings.provider);
  // Assumed until known. The alternative flashes "signed out" at every panel
  // open, which trains people to ignore it by the time it is real.
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    if (!hosted) return;
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!cancelled) setSignedIn(token !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [hosted]);

  // Signing in and out both happen somewhere else: the settings panel, the tab
  // the emailed link opened, or `session.ts` discarding a revoked token. Storage
  // is where all three meet.
  useEffect(() => {
    if (!hosted) return;
    const onChanged = (_changes: unknown, area: string) => {
      if (area !== 'local') return;
      // `getSession`, not `getAccessToken`: this fires on every storage write,
      // and a refresh per write would be a self-sustaining loop.
      void getSession().then((session) => setSignedIn(session !== null));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [hosted]);

  return { needsSignIn: hosted && !signedIn };
}
