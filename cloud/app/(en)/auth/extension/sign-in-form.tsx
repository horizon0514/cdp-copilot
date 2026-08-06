'use client';

import { useEffect, useState } from 'react';
import { deliverSession } from '@/lib/deliver-session';
import { supabaseBrowser } from '@/lib/supabase-browser';

/**
 * Email sign-in for the extension.
 *
 * Two jobs in one page. Arriving with no session, it sends a sign-in link.
 * Arriving *back* from that link — Supabase returns the session in the URL
 * fragment — it hands the session to the extension and says so.
 *
 * A link rather than a typed code, because Supabase's free tier will not let us
 * customise the email template while the built-in mail service is in use, and
 * the stock template sends a link. Once a real SMTP sender is configured the
 * email can carry both, and the code becomes the fallback for people reading
 * their mail somewhere other than this browser — the one case a link cannot
 * serve.
 */

type Phase = 'idle' | 'sending' | 'sent' | 'delivering' | 'done' | 'no-extension';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  // Returning from the emailed link: supabase-js reads the fragment, and the
  // session exists before this component gets a chance to render anything.
  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return;
    setPhase('delivering');

    void (async () => {
      const { data, error } = await supabaseBrowser().auth.getSession();
      if (error || !data.session) {
        setError(error?.message ?? 'That sign-in link has expired.');
        setPhase('idle');
        return;
      }
      // Clear the tokens out of the address bar before anything can screenshot,
      // bookmark, or share it.
      history.replaceState(null, '', window.location.pathname);
      setPhase((await deliverSession(data.session)) === 'delivered' ? 'done' : 'no-extension');
    })();
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhase('sending');
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href.split('#')[0] },
    });
    if (error) {
      setError(error.message);
      setPhase('idle');
    } else {
      setPhase('sent');
    }
  };

  if (phase === 'delivering') return <p>Signing you in…</p>;

  if (phase === 'done') {
    return (
      <>
        <h2>You’re signed in</h2>
        <p>Pagehand’s side panel is ready to use. You can close this tab.</p>
      </>
    );
  }

  if (phase === 'no-extension') {
    return (
      <>
        <h2>Almost there</h2>
        <p>
          Signing in worked, but this tab couldn’t reach the Pagehand extension. That happens when
          the link is opened in a different browser or profile from the one Pagehand is installed
          in. Open this page again in that browser.
        </p>
      </>
    );
  }

  if (phase === 'sent') {
    return (
      <>
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{email}</strong>.
        </p>
        <p>
          <strong>Open it in this browser</strong> — the link signs in whichever browser opens it,
          and Pagehand is installed in this one.
        </p>
        <p>
          <button type="button" onClick={() => setPhase('idle')}>
            Use a different email
          </button>
        </p>
      </>
    );
  }

  return (
    <form onSubmit={sendLink}>
      <p>We’ll email you a sign-in link. No password to remember.</p>
      <p>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />{' '}
        <button type="submit" disabled={phase === 'sending'}>
          {phase === 'sending' ? 'Sending…' : 'Send link'}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
