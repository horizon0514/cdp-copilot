import type { Metadata } from 'next';
import { LangSwitch } from '@/components/lang-switch';
import { Footer, GITHUB_URL, Grain, Nav } from '@/components/site';

const SITE = 'https://pagehand.vercel.app';

export const metadata: Metadata = {
  title: 'Privacy Policy — Pagehand',
  description: 'Privacy policy for the Pagehand Chrome extension.',
  alternates: {
    canonical: `${SITE}/privacy`,
    languages: {
      en: `${SITE}/privacy`,
      'zh-CN': `${SITE}/zh/privacy`,
      'x-default': `${SITE}/privacy`,
    },
  },
};

export default function Privacy() {
  return (
    <>
      <Grain />

      <div className="wrap">
        <Nav
          navLabel="Primary"
          brandHref="/"
          langSwitch={
            <LangSwitch label="Language" current="en" enHref="/privacy" zhHref="/zh/privacy" />
          }
        >
          <a href="/">Home</a>
        </Nav>

        <article className="legal">
          <h1>Privacy Policy</h1>
          <p className="updated">Last updated: August 3, 2026</p>

          <p>
            Pagehand (“the Extension”) is a Chrome extension that helps you read and automate the
            current page using the Chrome DevTools Protocol. This policy explains what data the
            Extension handles and what it does <em>not</em> do.
          </p>

          <h2>1. No Pagehand backend</h2>
          <p>
            Pagehand does not operate a cloud service that receives your chats, page content, or API
            keys. There is no Pagehand account system and no Pagehand analytics/telemetry endpoint.
          </p>

          <h2>2. Data stored on your device</h2>
          <p>The Extension stores the following locally in your Chrome profile:</p>
          <ul>
            <li>
              <strong>LLM settings</strong> — provider choice, model name, base URL (if custom), and
              API key, in <code>chrome.storage.local</code>. Keys are stored unencrypted in the
              browser profile and are not synced to your Google account via Chrome Sync.
            </li>
            <li>
              <strong>Chat threads</strong> — conversation history (including any screenshots kept
              in the thread) in IndexedDB on this device.
            </li>
            <li>
              <strong>Locale preference</strong> — your UI language choice.
            </li>
          </ul>

          <h2>3. Data sent over the network</h2>
          <p>
            When you chat with the agent, prompts, page-derived context (for example accessibility
            snapshots, console/network excerpts, and screenshots you ask it to take), and tool
            results are sent to the large-language-model provider <em>you</em> configured — such as
            DeepSeek, OpenAI, Anthropic, or another OpenAI-compatible endpoint. Pagehand does not
            interpose a proxy; requests go from your browser to that provider.
          </p>
          <p>Those providers’ own privacy policies govern data once it reaches them.</p>

          <h2>4. Permissions and page access</h2>
          <p>
            Pagehand uses Chrome’s <code>debugger</code> permission (Chrome DevTools Protocol) to
            inspect and control the page it is attached to. While attached, Chrome displays a
            persistent banner: “Pagehand is debugging this browser.” That banner is a Chrome safety
            feature and cannot be suppressed by the Extension.
          </p>
          <p>
            Default host permissions are limited to the built-in provider API hosts. Broad site
            access (<code>https://*/*</code>, <code>http://localhost/*</code>) is optional and
            requested only when needed (for example a custom provider base URL).
          </p>

          <h2>5. What we do not collect</h2>
          <ul>
            <li>No crash reports or usage analytics sent to Pagehand</li>
            <li>No advertising identifiers</li>
            <li>No sale of personal information</li>
          </ul>

          <h2>6. Children</h2>
          <p>
            The Extension is not directed at children under 13, and we do not knowingly collect
            personal information from children.
          </p>

          <h2>7. Changes</h2>
          <p>
            If this policy changes in a material way, the “Last updated” date above will be revised.
            Continued use of the Extension after an update means you accept the revised policy.
          </p>

          <h2>8. Contact</h2>
          <p>
            Questions about this policy: open an issue on <a href={GITHUB_URL}>GitHub</a> or email
            the maintainer listed on that repository.
          </p>
        </article>
      </div>

      <Footer navLabel="Footer">
        <a href="/">Home</a>
      </Footer>
    </>
  );
}
