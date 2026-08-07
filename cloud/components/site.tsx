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

export const CONTACT_EMAIL = 'horizon05140@gmail.com';

/**
 * Where someone asks to be let into the hosted preview.
 *
 * The proxy serves an allowlist while quotas are being built (`authenticate()`
 * in `lib/auth.ts`), so the request has to reach a human either way — and mail
 * carries the address the allowlist is keyed on without asking for it twice.
 */
export const PREVIEW_REQUEST_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Pagehand hosted preview access',
)}`;
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

/**
 * The mock side panel behind the hero, replaying one turn on a loop.
 *
 * It used to be a raw accessibility tree — Pagehand's own snapshot output, which
 * showed the machinery to anyone who could read it and nothing at all to anyone
 * who couldn't. A visitor's first question is "what does this do for me", and a
 * `RootWebArea` node does not answer it.
 *
 * Built to match the real panel part for part — brand header, bound-tab line,
 * question on the right, collapsed tool rows with a status badge, the answer,
 * the composer — because the picture is a promise about what installing gets
 * you. The strings are the panel's own (`src/lib/i18n`), which is also why they
 * are passed in per locale rather than hardcoded here.
 */
export function HeroStage({
  bound,
  ask,
  tools,
  doneLabel,
  runningLabel,
  reply,
  placeholder,
}: {
  bound: string;
  ask: string;
  tools: { name: string; note: string }[];
  doneLabel: string;
  runningLabel: string;
  reply: string;
  placeholder: string;
}) {
  return (
    <div className="hero-stage" aria-hidden="true">
      <div className="hero-grid" />
      <div className="hero-panel">
        <div className="hero-panel-head">
          <img src="/icon.png" alt="" width={18} height={18} />
          Pagehand
        </div>
        <p className="hero-bound">
          <span className="hero-bound-dot" />
          {bound}
        </p>

        <div className="hero-thread">
          <p className="hero-ask">{ask}</p>
          <ul className="hero-tools">
            {tools.map((tool, i) => (
              <li key={tool.name + tool.note} className={`hero-tool hero-tool-${i + 1}`}>
                <span className="hero-tool-chevron">›</span>
                <code>{tool.name}</code>
                <span className="hero-tool-note">{tool.note}</span>
                {/* The last row is the one still working when it lands, so it
                    carries both badges and swaps them mid-loop. */}
                {i === tools.length - 1 ? (
                  <span className="hero-badge-swap">
                    <span className="hero-badge hero-badge-running">{runningLabel}</span>
                    <span className="hero-badge hero-badge-done">{doneLabel}</span>
                  </span>
                ) : (
                  <span className="hero-badge">{doneLabel}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="hero-reply">{reply}</p>
        </div>

        <p className="hero-composer">{placeholder}</p>
      </div>
    </div>
  );
}
