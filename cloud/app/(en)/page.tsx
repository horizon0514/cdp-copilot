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
    "Pagehand is an AI in Chrome's side panel that works on the page you are already on — summarize it, fill the form, click through the flow, or find out what's broken. Sign in and go, or bring your own API key.",
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
        <HeroStage
          bound="Bound · help.acme.com"
          ask="Find the refund policy on this site and give me the short version."
          tools={[
            { name: 'take_snapshot', note: '42 nodes' },
            { name: 'click', note: 'link “Help Centre”' },
            { name: 'extract_content', note: 'Refunds & Returns' },
          ]}
          doneLabel="Done"
          runningLabel="Running"
          reply="Three things: 30 days from delivery, unopened items only, and refunds land 5–7 days after they receive it."
          placeholder="Ask anything — @ to reference a tab"
        />

        <div className="wrap">
          <Nav
            navLabel="Primary"
            brandHref="/"
            langSwitch={<LangSwitch label="Language" current="en" enHref="/" zhHref="/zh" />}
          >
            <a className="hide-sm" href="#uses">
              What it does
            </a>
            <a className="hide-sm" href="#install">
              Install
            </a>
            <a className="hide-sm" href="#modes">
              Modes
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
              Pagehand opens in Chrome&rsquo;s side panel and works on the page you are already
              looking at — reading it, filling it in, clicking through it. You ask in plain words;
              it does the part you&rsquo;d rather not.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" id="install-cta" href={STORE_URL}>
                Add to Chrome
              </a>
              <a className="btn btn-ghost" href="#uses">
                See what it does
              </a>
            </div>
            <p className="hero-meta">
              Works on any page · Sign in and go · Your chats stay in your browser
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" id="uses">
          <div className="wrap">
            <p className="section-label">What it does</p>
            <h2>Four things people ask it for.</h2>
            <p className="section-lead">
              Open the panel on any page and type. Every line below is something you could paste in
              as it stands.
            </p>
            <ul className="scenarios">
              <li>
                <h3>Read this page for me</h3>
                <p>
                  Long article, dense report, a table you don&rsquo;t want to retype — it reads what
                  is actually on screen, not a search result about it.
                </p>
                <p className="scenario-ask">
                  “Summarize this report and pull out the three numbers that matter.”
                </p>
              </li>
              <li>
                <h3>Do it for me</h3>
                <p>
                  Forms, checkboxes, multi-step flows. It works in the tab you already have open, so
                  anything you are signed in to, it can reach.
                </p>
                <p className="scenario-ask">
                  “Fill this form with the same details as last time, and stop before submitting.”
                </p>
              </li>
              <li>
                <h3>Compare what&rsquo;s in my tabs</h3>
                <p>
                  Type <strong>@</strong> to point it at other tabs you have open, and it reads them
                  together instead of one at a time.
                </p>
                <p className="scenario-ask">
                  “@ these three listings — which is cheapest once shipping is included?”
                </p>
              </li>
              <li>
                <h3>Tell me why this page is broken</h3>
                <p>
                  For the developers in the room: console errors and network requests, read and
                  explained without you opening DevTools.
                </p>
                <p className="scenario-ask">
                  “Clicking Save does nothing — what request fails, and what did it return?”
                </p>
              </li>
            </ul>
          </div>
        </section>

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
                  Click the Pagehand icon on any page — or press <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+
                  <kbd>Shift</kbd>+<kbd>K</kbd>. Sign in, and start asking.
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

        <section className="section" id="privacy">
          <div className="wrap">
            <p className="section-label">Privacy</p>
            <h2>It reads the page. Here is the whole of it.</h2>
            <div className="privacy-box">
              <p>
                Pagehand looks at a tab when you ask it something, and only that tab. What it reads
                goes to the AI model answering you and nowhere else — we never store what a page
                said, and your chat history stays in your browser. While it is working, Chrome puts
                a “Pagehand is debugging this browser” bar across the top of the window: that is
                Chrome telling you the truth about what an extension is doing, we are not allowed to
                hide it, and it goes away when you close the panel.{' '}
                <a href="/privacy">Read the full privacy policy →</a>
              </p>
            </div>
          </div>
        </section>

        {/* Last, and kept. It is why the clicking works at all, and the people
            who ask "is this a DOM scraper" will scroll for it — but it answers a
            question most visitors have not thought to ask yet. */}
        <section className="section" id="how">
          <div className="wrap">
            <p className="section-label">Under the hood</p>
            <h2>Same protocol Puppeteer speaks.</h2>
            <p className="section-lead">
              No Node sidecar, no MCP bridge, no DOM scraping. The side panel holds the agent loop
              and speaks Chrome DevTools Protocol directly, through <code>chrome.debugger</code> on
              Manifest V3.
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
            <p className="install-note">
              The full tool list, and the code behind it, are on{' '}
              <a href={GITHUB_URL}>GitHub</a>.
            </p>
          </div>
        </section>
      </main>

      <Footer navLabel="Footer">
        <a href="/privacy">Privacy</a>
      </Footer>
    </>
  );
}
