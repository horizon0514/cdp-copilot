# Pagehand Cloud

Everything that isn't the extension: the marketing site, and — as it lands — the
account pages, billing, and the hosted model proxy. Plan:
[`../docs/PLAN-subscription.md`](../docs/PLAN-subscription.md).

Separate npm project from the extension at the repo root, with its own
`package.json`, `node_modules`, and Vercel project (Root Directory `cloud`).

The marketing site was four static HTML files under `website/` until it moved in
here. Merging them means `/pricing` and `/account` inherit the same
`app/globals.css` the landing page uses, rather than becoming a second design.

## Status: Phase 1a

Only `POST /api/v1/chat/completions` exists, and it has **no auth and no
billing** — every request bills to a stub user and usage is logged, not stored.
The point of this phase is to answer one question: does a real multi-step,
tool-using turn survive the proxy?

## Run it

```sh
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY
npm run dev                  # http://localhost:3000
```

Then in the extension's Settings:

| Field | Value |
| --- | --- |
| Provider | Pagehand (hosted) |
| Base URL | `http://localhost:3000/api/v1` |
| Model | `openai/gpt-4.1-mini` (OpenRouter ids are namespaced) |

Chrome will ask once for permission on `http://localhost` — that origin is
already declared in `optional_host_permissions`.

Watch the dev server for `[usage]` lines. `USAGE MISSING` or `COST MISSING`
invalidates the metering design in §4.4 — the ledger bills from the router's
reported cost, so a request we can't cost is a request we'd serve for free.
Worth stopping for.

## Layout

```
app/(en)/       marketing, English      →  /        /privacy
app/(zh)/       marketing, Chinese      →  /zh      /zh/privacy
app/globals.css the old website/styles.css, byte for byte
components/     nav, footer, release links, language switch
lib/proxy.ts    (Request) => Response, no framework imports — see the file header
lib/usage.ts    pulling the final usage frame — and its cost — out of an SSE stream
lib/config.ts   router endpoint, model allowlist, size caps
app/api/...     the Next route handler: runtime config + dependency injection
```

Two **root layouts**, one per locale, because only a root layout may render
`<html>` and the two need different `lang` attributes and font sets. That is
what the `(en)` / `(zh)` route groups are for — they don't appear in URLs.
