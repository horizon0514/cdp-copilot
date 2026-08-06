import type { Metadata } from 'next';
import { LangSwitch } from '@/components/lang-switch';
import { CONTACT_EMAIL, Footer, GITHUB_URL, Grain, Nav, SITE_URL } from '@/components/site';

export const metadata: Metadata = {
  title: 'Privacy Policy — Pagehand',
  description: 'Privacy policy for the Pagehand Chrome extension.',
  alternates: {
    canonical: `${SITE_URL}/privacy`,
    languages: {
      en: `${SITE_URL}/privacy`,
      'zh-CN': `${SITE_URL}/zh/privacy`,
      'x-default': `${SITE_URL}/privacy`,
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
          <p className="updated">Last updated: August 6, 2026</p>

          <p>
            Pagehand (“the Extension”) is a Chrome extension that helps you read and automate the
            current page using the Chrome DevTools Protocol. This policy explains what data the
            Extension handles and what it does <em>not</em> do.
          </p>

          <h2>1. Two ways Pagehand reaches a model</h2>
          <p>
            Which one you use decides whether Pagehand’s servers see anything at all. In both, the
            agent loop and every page tool run inside the Extension, and your chat threads are
            stored only on your device.
          </p>
          <ul>
            <li>
              <strong>Hosted (the default)</strong> — you sign in with an email address, and model
              calls go from the Extension to Pagehand’s API at <code>pagehand.app</code>, which
              forwards them to the model router (OpenRouter) and on to the provider serving that
              model.
            </li>
            <li>
              <strong>Your own API key</strong> — you supply a provider key, and requests go from
              your browser straight to that provider. Pagehand operates no server on this path and
              receives nothing.
            </li>
          </ul>

          <h2>2. Account data (hosted mode only)</h2>
          <p>
            If you never sign in, none of this exists. Signing in creates an account that holds:
          </p>
          <ul>
            <li>
              <strong>Your email address</strong> — used to send the sign-in link and to identify
              the account. Authentication and the account database are provided by Supabase.
            </li>
            <li>
              <strong>Session tokens</strong> — issued on sign-in and stored on your device (see
              §3), so the Extension can call the hosted API without re-authenticating each time.
            </li>
            <li>
              <strong>Usage records</strong> — for each hosted request: account id, the model asked
              for, a timestamp, and what the request cost. Used for metering, quotas, and abuse
              prevention. The content of your messages is not part of this record and is not stored.
            </li>
          </ul>
          <p>
            You can sign out from the side panel at any time, which removes the session from your
            device. To have the account itself deleted, contact us (§9).
          </p>

          <h2>3. Data stored on your device</h2>
          <p>The Extension stores the following locally in your Chrome profile:</p>
          <ul>
            <li>
              <strong>LLM settings</strong> — provider choice, model name, base URL (if custom), and
              API key, in <code>chrome.storage.local</code>. Keys are stored unencrypted in the
              browser profile and are not synced to your Google account via Chrome Sync.
            </li>
            <li>
              <strong>Hosted session</strong> — the access and refresh tokens for your account, in{' '}
              <code>chrome.storage.local</code>, with the same exposure as the keys above.
            </li>
            <li>
              <strong>Chat threads</strong> — conversation history (including any screenshots kept
              in the thread) in IndexedDB on this device.
            </li>
            <li>
              <strong>Locale preference</strong> — your UI language choice.
            </li>
          </ul>

          <h2>4. Data sent over the network</h2>
          <p>
            When you chat with the agent, prompts, page-derived context (for example accessibility
            snapshots, console/network excerpts, and screenshots you ask it to take), and tool
            results are sent to a large-language-model provider — the one <em>you</em> configured,
            or the one serving the hosted model.
          </p>
          <p>
            In hosted mode that traffic passes through Pagehand’s API on its way to the router and
            the provider. It is forwarded in transit and not written to a database by us; only the
            usage record in §2 is kept. With your own key, nothing is routed through us at all.
          </p>
          <p>
            Those providers’ own privacy policies govern data once it reaches them — as does
            OpenRouter’s on the hosted path.
          </p>

          <h2>5. Permissions and page access</h2>
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

          <h2>6. What we do not collect</h2>
          <ul>
            <li>No storage of your chats, page content, or screenshots on Pagehand’s servers</li>
            <li>No crash reports or usage analytics sent to Pagehand</li>
            <li>No advertising identifiers</li>
            <li>No sale of personal information</li>
          </ul>
          <p>
            Server logs for the hosted API record request metadata — time, account id, model, size,
            and cost — not message content.
          </p>

          <h2>7. Children</h2>
          <p>
            The Extension is not directed at children under 13, and we do not knowingly collect
            personal information from children.
          </p>

          <h2>8. Changes</h2>
          <p>
            If this policy changes in a material way, the “Last updated” date above will be revised.
            Continued use of the Extension after an update means you accept the revised policy.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about this policy, or a request to delete your account: email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or open an issue on{' '}
            <a href={GITHUB_URL}>GitHub</a>.
          </p>
        </article>
      </div>

      <Footer navLabel="Footer">
        <a href="/">Home</a>
      </Footer>
    </>
  );
}
