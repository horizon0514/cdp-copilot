import type { Metadata } from 'next';
import { Grain } from '@/components/site';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in — Pagehand',
  // Nothing here should ever appear in search results.
  robots: { index: false, follow: false },
};

/**
 * The sign-in screen, opened from the side panel and returned to from the
 * emailed link. Both halves live in the same page so the link can point back at
 * a URL the user has already seen.
 */
export default function ExtensionAuth() {
  return (
    <>
      <Grain />
      <div className="wrap">
        <article className="legal">
          <h1>Sign in to Pagehand</h1>
          <SignInForm />
        </article>
      </div>
    </>
  );
}
