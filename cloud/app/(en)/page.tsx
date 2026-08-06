import type { Metadata } from 'next';
import { TagLink, ZipLink } from '@/components/release';
import { LangSwitch } from '@/components/lang-switch';
import { LocaleRedirect } from '@/components/locale-redirect';
import {
  Footer,
  GITHUB_URL,
  Grain,
  HeroStage,
  Nav,
  PREVIEW_REQUEST_URL,
  SITE_URL,
  STORE_URL,
} from '@/components/site';

export const metadata: Metadata = {
  title: 'Pagehand — AI that works the current page',
  description:
    'Pagehand is a Chrome side-panel AI that reads and automates the current page via the Chrome DevTools Protocol. Sign in and the model is handled for you — or bring your own API key.',
  alternates: {
    canonical: `${SITE_URL}/`,
    languages: { en: `${SITE_URL}/`, 'zh-CN': `${SITE_URL}/zh`, 'x-default': `${SITE_URL}/` },
  },
  openGraph: {
    title: 'Pagehand',
    description:
      'AI that reads and automates the current Chrome page via CDP. Side panel. Sign in and go, or bring your own key.',
    type: 'website',
    locale: 'en_US',
  },
};

export default function Home() {
  return (
    <>
      <LocaleRedirect />
      <Grain />

      <header className="hero">
        <HeroStage />

        <div className="wrap">
          <Nav
            navLabel="Primary"
            brandHref="/"
            langSwitch={<LangSwitch label="Language" current="en" enHref="/" zhHref="/zh" />}
          >
            <a className="hide-sm" href="#install">
              Install
            </a>
            <a className="hide-sm" href="#modes">
              Modes
            </a>
            <a className="hide-sm" href="#how">
              How it works
            </a>
            <a className="hide-sm" href="#privacy">
              Privacy
            </a>
          </Nav>

          <div className="hero-content">
            <p className="hero-brand">
              <img src="/icon.png" alt="" width={56} height={56} />
              Pagehand
            </p>
            <h1>AI that puts a hand on the current page.</h1>
            <p className="hero-lead">
              Side-panel copilot for Chrome. It reads the page, clicks, fills, and inspects console
              &amp; network — through CDP. Sign in and the model is handled for you.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" id="install-cta" href={STORE_URL}>
                Add to Chrome
              </a>
              <a className="btn btn-ghost" href="#install">
                How to install
              </a>
            </div>
            <p className="hero-meta">
              Manifest V3 · chrome.debugger · Hosted model, or your own OpenAI / Anthropic /
              DeepSeek key
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" id="install">
          <div className="wrap">
            <p className="section-label">Install</p>
            <h2>Get it from the Chrome Web Store.</h2>
            <p className="section-lead">
              One click, and Chrome keeps it up to date. No zip to keep, no folder to remember, no
              Developer mode.
            </p>
            <ol className="steps">
              <li>
                <h3>Add to Chrome</h3>
                <p>
                  Open the <a href={STORE_URL}>Pagehand listing</a> and click{' '}
                  <strong>Add to Chrome</strong>.
                </p>
              </li>
              <li>
                <h3>Pin it</h3>
                <p>
                  Click the puzzle icon in the toolbar and pin Pagehand, so the side panel is always
                  one click away.
                </p>
              </li>
              <li>
                <h3>Open the side panel</h3>
                <p>
                  Click the Pagehand icon on any page. Sign in — or switch to your own API key — and
                  start asking.
                </p>
              </li>
            </ol>
            <p className="install-note">
              Updates arrive on their own. Prefer building it yourself?{' '}
              <a href={`${GITHUB_URL}#setup`}>See the GitHub setup</a>.
            </p>

            {/* Kept, not featured. It is the right path for anyone on a build
                that hasn't cleared review yet, and the wrong one for everybody
                else — six steps and a folder they must never delete. */}
            <details className="install-alt">
              <summary>Rather load it unpacked?</summary>
              <ol className="steps">
                <li>
                  <h3>Download</h3>
                  <p>
                    Get <ZipLink>pagehand.zip</ZipLink> from the <TagLink idle="latest" /> GitHub
                    Release.
                  </p>
                </li>
                <li>
                  <h3>Unzip</h3>
                  <p>
                    Extract the zip to a folder you will keep — Chrome reads that folder every time
                    it starts. Don’t delete it after installing.
                  </p>
                </li>
                <li>
                  <h3>Open Extensions</h3>
                  <p>
                    In Chrome’s address bar, go to <kbd>chrome://extensions</kbd> and press Enter.
                  </p>
                </li>
                <li>
                  <h3>Turn on Developer mode</h3>
                  <p>
                    Toggle <strong>Developer mode</strong> in the top-right corner of that page.
                  </p>
                </li>
                <li>
                  <h3>Load unpacked</h3>
                  <p>
                    Click <strong>Load unpacked</strong>, then choose the folder you unzipped (the
                    one that contains <code>manifest.json</code>).
                  </p>
                </li>
              </ol>
              <p className="install-note">
                To update later: download the new zip, replace the folder contents, then click the
                reload icon on <kbd>chrome://extensions</kbd>.
              </p>
            </details>
          </div>
        </section>

        <section className="section" id="modes">
          <div className="wrap">
            <p className="section-label">Model access</p>
            <h2>Sign in, or bring your own key.</h2>
            <p className="section-lead">
              Two ways to reach a model. The hands are the same either way — the agent loop and
              every CDP tool run inside your browser.
            </p>
            <ul className="modes">
              <li className="mode-default">
                <p className="mode-tag">Hosted · default</p>
                <h3>Sign in and go</h3>
                <p>
                  One email, no API key, no provider account. Pagehand routes the model call through
                  its own endpoint and carries the bill.
                </p>
                <ul className="mode-points">
                  <li>Nothing to configure on the first run</li>
                  <li>Chat threads still stay in your browser</li>
                  <li>In private preview while usage limits are built</li>
                </ul>
              </li>
              <li>
                <p className="mode-tag">Your key · advanced</p>
                <h3>Bring your own key</h3>
                <p>
                  Point the panel at DeepSeek, OpenAI, Anthropic, or any OpenAI-compatible endpoint.
                  Requests go straight from your browser to that provider.
                </p>
                <ul className="mode-points">
                  <li>
                    Key stays in <code>chrome.storage.local</code>
                  </li>
                  <li>Nothing touches Pagehand&rsquo;s servers</li>
                  <li>Any model your provider offers, at its price</li>
                </ul>
              </li>
            </ul>
            <div className="note-box modes-note">
              <p>
                Hosted is in private preview: sign-in works, but requests are served to a short list
                of accounts until quotas land.{' '}
                <a href={PREVIEW_REQUEST_URL}>Email us for access →</a> Your own key works for
                everyone today, no account needed.
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <p className="section-label">How it works</p>
            <h2>The side panel owns the debugger.</h2>
            <p className="section-lead">
              No Node sidecar. No MCP bridge. Pagehand talks Chrome DevTools Protocol from inside
              the extension and drives the page you are looking at.
            </p>
            <ol className="steps">
              <li>
                <h3>Open the panel</h3>
                <p>
                  <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd>, or click the toolbar
                  icon.
                </p>
              </li>
              <li>
                <h3>Sign in</h3>
                <p>
                  One email and the model is handled for you — or switch to your own key in
                  Settings.
                </p>
              </li>
              <li>
                <h3>Ask it to act</h3>
                <p>
                  Summarize, click, fill forms, chase console errors, or walk a multi-step flow on
                  the live page.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section" id="tools">
          <div className="wrap">
            <p className="section-label">Capabilities</p>
            <h2>Same protocol Puppeteer speaks.</h2>
            <p className="section-lead">
              Accessibility snapshots, input, navigation, screenshots, console and network —
              implemented against CDP domains, not a brittle DOM scraper.
            </p>
            <ul className="feature-list">
              <li>
                <code>take_snapshot</code>
                <p>Read the page as a structured accessibility tree with stable uids.</p>
              </li>
              <li>
                <code>click / fill / type</code>
                <p>Drive forms and UI the way a user would — including select-all before replace.</p>
              </li>
              <li>
                <code>navigate / pages</code>
                <p>Move between pages and manage them while the agent keeps context.</p>
              </li>
              <li>
                <code>console / network</code>
                <p>Inspect errors and requests without opening DevTools yourself.</p>
              </li>
              <li>
                <code>evaluate_script</code>
                <p>Run focused page scripts when reading the tree is not enough.</p>
              </li>
              <li>
                <code>take_screenshot</code>
                <p>Capture what the page looks like and keep it in the chat thread.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="wrap">
            <p className="section-label">Privacy</p>
            <h2>The hands stay local either way.</h2>
            <div className="privacy-box">
              <p>
                Page content is read in your browser and chat threads never leave it. On hosted,
                prompts and page context pass through <code>pagehand.app</code> to the model
                provider — we meter what a request cost, not what it said. With your own key,
                nothing touches our servers at all: it stays in{' '}
                <code>chrome.storage.local</code> and goes straight to the provider. While attached,
                Chrome shows a “Pagehand is debugging this browser” banner — that is intentional and
                cannot be hidden. <a href="/privacy">Read the full privacy policy →</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer navLabel="Footer">
        <a href="/privacy">Privacy</a>
      </Footer>
    </>
  );
}
