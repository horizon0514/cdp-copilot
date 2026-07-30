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
API key.

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
- `npm test` / `npm run test:watch` — Vitest
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

What tests do **not** cover: real `chrome.debugger` attachment, actual CDP responses,
and provider HTTP calls. Those still need a manual pass in the browser.
