/**
 * Pieces shared by every marketing page, in both locales.
 *
 * The site was four hand-written HTML files before it moved under Next; these
 * components are that markup, unchanged, with the per-locale strings passed in
 * rather than duplicated. Class names still match `app/globals.css` exactly.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The canonical origin, and the one every page's `alternates` are built from.
 *
 * Shared rather than redeclared per page: it was copied into all four, which is
 * three chances for canonical and hreflang to disagree — the kind of drift that
 * costs nothing to introduce and shows up only in a search console weeks later.
 *
 * `pagehand.app`, not the `.vercel.app` it deploys under: that is the domain the
 * extension already talks to, and canonical URLs pointing anywhere else would
 * split the site across two origins.
 */
export const SITE_URL = 'https://pagehand.app';

export const GITHUB_URL = 'https://github.com/horizon0514/pagehand';
export const RELEASE_ZIP_URL = `${GITHUB_URL}/releases/latest/download/pagehand.zip`;
export const RELEASE_PAGE_URL = `${GITHUB_URL}/releases/latest`;

/** The store listing — now the way in. Loading an unpacked zip still works and
 * is still documented, but it asks six steps and a folder kept forever of
 * someone who came here to try a browser extension. */
export const STORE_URL =
  'https://chromewebstore.google.com/detail/pagehand/pcecngibbelhajhanohmcidacfmkekbb';

/** Paper texture overlay; purely decorative. */
export function Grain() {
  return <div className="grain" aria-hidden="true" />;
}

export function Nav({
  navLabel,
  brandHref,
  children,
  langSwitch,
}: {
  navLabel: string;
  brandHref: string;
  children: ReactNode;
  langSwitch: ReactNode;
}) {
  return (
    <nav className="nav" aria-label={navLabel}>
      <Link className="brand" href={brandHref}>
        <img src="/icon.png" alt="" width={28} height={28} />
        Pagehand
      </Link>
      <div className="nav-links">
        {children}
        <a href={GITHUB_URL}>GitHub</a>
        {langSwitch}
      </div>
    </nav>
  );
}

export function Footer({ navLabel, children }: { navLabel: string; children: ReactNode }) {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        {/* Rendered on the server, so the year needs no script and no hydration
            mismatch — the old page filled a `<span id="y">` from JS. */}
        <span>© {new Date().getFullYear()} Pagehand</span>
        <nav aria-label={navLabel}>
          {children}
          <a href={GITHUB_URL}>GitHub</a>
        </nav>
      </div>
    </footer>
  );
}

/** The accessibility-tree mock behind the hero. Identical in both locales —
 * it is meant to look like Pagehand's own snapshot output, not like prose. */
export function HeroStage() {
  return (
    <div className="hero-stage" aria-hidden="true">
      <div className="hero-grid" />
      <pre className="hero-tree">{`RootWebArea "Checkout"
  banner
    link "Pagehand"
    navigation
  main
    heading "Order summary"
    StaticText "$48.00"
    form
      textbox "Email"  ← focus
      textbox "Card"
      button "Pay now"
  complementary
    StaticText "Console · 0 errors"
    StaticText "Network · 12 req"`}</pre>
      <div className="hero-cursor" />
    </div>
  );
}
