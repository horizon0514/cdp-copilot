# cdp-copilot

An AI copilot, packaged as a Chrome extension, that reads and automates the
current tab using the Chrome DevTools Protocol — no external MCP client or
Node process required. Bring your own OpenAI / Anthropic / OpenAI-compatible
API key, chat with it from the side panel, and let it read page content,
click, fill forms, navigate, and inspect console/network activity.

This is a from-scratch port of the *capability* behind
[chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
(read page state + automate the browser via CDP) into a self-contained
Manifest V3 extension. It does not reuse chrome-devtools-mcp's code — CDP
access here comes from `chrome.debugger`, which exposes the same protocol
directly to extensions.

## How it works

- The **side panel** (not the background service worker) is the brain: it
  holds the chat/agent loop and owns the `chrome.debugger` session for the
  currently attached tab. This sidesteps MV3 service-worker lifecycle issues
  entirely, since the worker is never involved in tool execution.
- Tool calls (`take_snapshot`, `click`, `fill`, `navigate_page`,
  `evaluate_script`, `list_network_requests`, …) are implemented directly
  against CDP domains (`Accessibility`, `DOM`, `Input`, `Page`, `Network`,
  `Log`, `Runtime`), the same domains Puppeteer speaks over a debug port.
- The LLM layer uses the [Vercel AI SDK](https://ai-sdk.dev) for unified
  tool-calling across providers.

See the code under `src/lib/tools` for the full v1 tool list.

## Setup

```bash
npm install
npm run dev      # CRXJS dev build with HMR, writes to dist/
# or
npm run build    # production build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the `dist/` folder. Click the extension's action icon to
open the side panel, then open Settings (⚙) to enter your LLM provider and
API key. It defaults to DeepSeek (`deepseek-v4-flash`), so a key is the only
thing you have to supply; OpenAI, Anthropic and any OpenAI-compatible endpoint
are in the same dropdown.

## Security notes

- Your API key is stored **unencrypted** in `chrome.storage.local`, scoped to
  this browser profile. It is never synced to your Google account and never
  leaves your machine except in requests to the provider you configured.
- While the extension is attached to a tab, Chrome shows a persistent
  **"cdp-copilot is debugging this browser"** banner on that tab. This is a
  Chrome safety feature and cannot be suppressed — it's your signal that the
  extension currently has full CDP-level access to that tab's content.
- Custom OpenAI-compatible base URLs (OpenRouter, Azure OpenAI, local Ollama,
  etc.) require an extra one-time permission grant, requested the first time
  you save a non-default base URL in Settings. This keeps the extension's
  default install-time permissions narrow.

## Known limitations (v1)

- Single attached tab at a time — switching pages detaches from the previous
  one (its console/network capture history is frozen at that point).
- Single window at a time — a second browser window's side panel will refuse
  to attach while another window is active.
- Closing the side panel mid-conversation loses in-memory chat/tool state.
- Cross-origin iframes are not visible to `take_snapshot`.
- No performance tracing, heap snapshots, Lighthouse audits, or extension
  management tools (all present in upstream chrome-devtools-mcp) — deferred
  to a later version.

## Development

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm test` / `npm run test:watch` — Vitest (unit)
- `npm run build:e2e && npm run test:e2e` — Playwright (end-to-end)
- `npm run build` — production build to `dist/`

### Testing

The agent loop and all page-state logic run headlessly under Vitest, so most
changes can be verified without building, reloading the extension, and clicking
through the side panel:

- `src/test/mockModel.ts` — a scripted `LanguageModelV4` mock. Give it a list of
  per-step actions (`tool` / `text` / `silent` / `error`) and it replays them, so
  a full multi-step ReAct turn runs deterministically with no API key.
- `agentLoop.test.ts` — multi-step tool loops, recovery from a throwing tool, and
  the `StopInfo` diagnostics (step-limit cutoff vs. clean stop vs. tools-with-no-answer).
- `formatSnapshot.test.ts` — uid assignment, AX-tree pruning, and the line/character
  budgets that keep a huge page from exhausting the model's context.
- `navigationInvalidation.test.ts` — drives fake CDP events through a stub session to
  check that a main-frame navigation clears console, network, and uid state (and that
  a subframe navigation does not).
- `keyTable.test.ts`, `uidMap.test.ts` — key-combo parsing and uid lifetime.

#### End-to-end (Playwright)

```bash
npm run build:e2e && npm run test:e2e
```

Runs headless against a real Chromium with the extension loaded, covering the
things unit tests structurally cannot: a genuine `chrome.debugger` attachment,
live CDP responses from a real renderer, and input dispatched through the
browser rather than simulated.

`e2e/fixtures/` is served over HTTP (extensions need an explicit opt-in for
`file://`) and includes a pre-filled input, a click counter, real console output,
and a `fetch` — so assertions can prove effects rather than just that a call
returned. Notably, `click` is verified by the page's own handler running, and
`type_text` by the keystrokes the page actually received.

`npm run build:e2e` sets `VITE_E2E=true`, which exposes a `window.__cdp` bridge
(`src/e2e/hook.ts`) on the side panel page so Playwright can invoke tools the way
the agent loop does. The flag is statically false in normal builds, so the branch
and its chunk are dropped — **never ship an E2E build.**

Two bugs found by this suite that unit tests had passed clean on: `fill`
prepending instead of replacing (synthetic Ctrl/Cmd+A does not trigger
select-all; CDP's `commands: ['selectAll']` does), and `parseKeyCombo('+')`
throwing.

#### Live-LLM E2E (optional)

One spec (`e2e/live-llm.spec.ts`) runs the whole stack for real — a live model
chooses the tools, the tool layer executes them over CDP, and the fixture page
actually changes. It **skips by default**; to enable it:

```bash
cp .env.example .env.local   # then paste your key
npm run build:e2e && npm run test:e2e
```

`.env.local` is gitignored, and the key name is deliberately **not**
`VITE_`-prefixed — Vite only exposes `VITE_*` to the client bundle, so the key
stays on the Node side and is written into `chrome.storage.local` at test time
rather than compiled in. This was verified with a canary value: it appears in
neither the E2E nor the production bundle.

Because a live model is non-deterministic, these assert observable effects (a
tool call happened; `#counter` really reads "Clicked 1 times") rather than exact
wording. They cost tokens and need network, so they stay out of CI.

Note that E2E builds pre-grant wildcard `host_permissions`, since
`chrome.permissions.request()` opens a native dialog Playwright cannot dismiss.
Production builds keep those optional and ask at runtime.

What still needs a manual pass: the side panel opening as an actual Chrome side
panel rather than a tab, and the debugger permission banner.
