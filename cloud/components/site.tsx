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

/**
 * GitHub as a mark rather than a word.
 *
 * The nav's other items are all places on this site; "GitHub" set in the same
 * type read as one of them, and it was the least important of the five. The
 * logo is the one piece of nav vocabulary a visitor already knows, and it takes
 * back the width the section names need. The label stays for screen readers.
 */
function GithubLink({ label }: { label: string }) {
  return (
    <a className="nav-icon" href={GITHUB_URL} aria-label={label} title={label}>
      <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    </a>
  );
}

export function Nav({
  navLabel,
  brandHref,
  githubLabel,
  children,
  langSwitch,
}: {
  navLabel: string;
  brandHref: string;
  githubLabel: string;
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
        <GithubLink label={githubLabel} />
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
