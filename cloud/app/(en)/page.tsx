import type { Metadata } from 'next';
import { DownloadCta, TagLink, ZipLink } from '@/components/release';
import { LangSwitch } from '@/components/lang-switch';
import { LocaleRedirect } from '@/components/locale-redirect';
import { Footer, GITHUB_URL, Grain, HeroStage, Nav } from '@/components/site';

const SITE = 'https://pagehand.vercel.app';

export const metadata: Metadata = {
  title: 'Pagehand — AI that works the current page',
  description:
    'Pagehand is a Chrome side-panel AI that reads and automates the current page via the Chrome DevTools Protocol. Bring your own API key.',
  alternates: {
    canonical: `${SITE}/`,
    languages: { en: `${SITE}/`, 'zh-CN': `${SITE}/zh`, 'x-default': `${SITE}/` },
  },
  openGraph: {
    title: 'Pagehand',
    description:
      'AI that reads and automates the current Chrome page via CDP. Side panel. Your keys. No cloud middleman.',
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
              &amp; network — through CDP, with your own API key.
            </p>
            <div className="cta-row">
              <DownloadCta idle="Download" tagPrefix="Download " />
              <a className="btn btn-ghost" href="#install">
                How to install
              </a>
            </div>
            <p className="hero-meta">
              Manifest V3 · chrome.debugger · BYO OpenAI / Anthropic / DeepSeek
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" id="install">
          <div className="wrap">
            <p className="section-label">Install</p>
            <h2>Load it into Chrome in a few clicks.</h2>
            <p className="section-lead">
              No Node, no build tools. Download the release zip, unpack it, and load the folder as
              an unpacked extension.
            </p>
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
                  Extract the zip to a folder you will keep — Chrome reads that folder every time it
                  starts. Don’t delete it after installing.
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
                  Click <strong>Load unpacked</strong>, then choose the folder you unzipped (the one
                  that contains <code>manifest.json</code>).
                </p>
              </li>
              <li>
                <h3>Open Pagehand</h3>
                <p>
                  Click the puzzle icon in the toolbar, pin Pagehand, open the side panel, and add
                  your API key in Settings.
                </p>
              </li>
            </ol>
            <p className="install-note">
              To update later: download the new zip, replace the folder contents, then click the
              reload icon on <kbd>chrome://extensions</kbd>. Prefer building yourself?{' '}
              <a href={`${GITHUB_URL}#setup`}>See the GitHub setup</a>.
            </p>
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
                <h3>Drop in a key</h3>
                <p>
                  DeepSeek by default — OpenAI, Anthropic, or any OpenAI-compatible endpoint also
                  work.
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
            <h2>Your key never leaves your machine for us.</h2>
            <div className="privacy-box">
              <p>
                Pagehand has no backend. API keys stay in <code>chrome.storage.local</code> and are
                sent only to the model provider you choose. While attached, Chrome shows a “Pagehand
                is debugging this browser” banner — that is intentional and cannot be hidden.{' '}
                <a href="/privacy">Read the full privacy policy →</a>
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
