# Pagehand Cloud

Everything that isn't the extension: the marketing site, and — as it lands — the
account pages, billing, and the hosted model proxy. Plan:
[`../docs/PLAN-subscription.md`](../docs/PLAN-subscription.md).

Separate npm project from the extension at the repo root, with its own
`package.json`, `node_modules`, and Vercel project (Root Directory `cloud`).

## Build settings live in the Vercel dashboard, not here

A `vercel.json` will **not** override them — project settings win, which is the
opposite of what you might expect. The project predates this app and was set up
to serve static HTML, so its commands were explicitly blank; a blank command
means "run nothing", and the deployment then ships an empty output directory
that 404s on every route while still reporting success.

If deploys start 404ing, check these first
(Settings → Build & Deployment) — a build log with no `npm install` line and a
sub-100ms duration is the signature:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `cloud` |
| Install Command | `npm install` |
| Build Command | `next build` |
| Output Directory | `.next` |

The marketing site was four static HTML files under `website/` until it moved in
here. Merging them means `/pricing` and `/account` inherit the same
`app/globals.css` the landing page uses, rather than becoming a second design.

### Pushing to `main` deploys again — the skip rule is gone

Three consecutive pushes on 2026-08-06 shipped nothing, in two different ways:

- Head commit touched only files outside `cloud/` (`supabase/.gitignore`, then a
  docs edit): a deployment was created and immediately **"Canceled by Ignored
  Build Step"** — 1s, no build. The site commit sat in the middle of the pushed
  range and was never considered. GitHub reports that cancellation as a
  **success** status, so nothing looks wrong.
- Head commit touched `cloud/README.md`: **no deployment was created at all**,
  still nothing 15 minutes later, with the commit status stuck at `pending`.

**Cause of the first, fixed 2026-08-07.** The project's Ignored Build Step was
`git diff --quiet HEAD^ HEAD -- .` — a one-commit comparison, where exit 0 means
skip. A push whose *head* commit misses `cloud/` was skipped no matter what the
rest of the range touched, which is the normal shape of a push. The setting is
now cleared, so **every push to `main` builds.** A build is ~9s; the saving was
never worth a deploy that silently doesn't happen.

**The second case is still unexplained.** `cloud/README.md` is inside the root
directory, so the skip rule would have let it through — it was something else.
Until it recurs and can be diagnosed, the habit below stays: do not assume a
push shipped. Symptom is always the same — production serves the old copy and
`x-vercel-cache: HIT` reports an `age` older than the push.

Check, and deploy by hand when it didn't:

```sh
vercel ls pagehand --scope horizon0514s-projects   # Canceled/1s = skipped

# From the repo root, NOT from cloud/ — the project applies Root Directory
# `cloud` to whatever the CLI uploads, so deploying from inside cloud/ makes it
# look for cloud/cloud.
vercel deploy --yes                 # builds a preview; ~30s if it's real
vercel promote <preview-url> --yes  # same build, straight to pagehand.app
```

`vercel link` on a fresh clone pulls production env into a root `.env.local`
(including `OPENROUTER_API_KEY`) and appends duplicate entries to `.gitignore`.
Both are gitignored, but the file is a live router key at the repo root: delete
it once the link exists — the one the dev server reads is `cloud/.env.local`.

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
| Model | `deepseek/deepseek-v4-flash-0731` (OpenRouter ids are namespaced) |

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
