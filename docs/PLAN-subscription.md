# Pagehand Subscription Plan

> Status: settled enough to build · Target: subscription-first + optional BYOK · LLM routing: **OpenRouter**
>
> Related product decision: move primary UX off “paste your own API key” to “sign in and use.”

## 0. Decisions taken since the first draft

The sections below were written before these were settled; where they disagree,
this list wins.

| Question | Decision |
| --- | --- |
| Model router | **OpenRouter**, not Vercel AI Gateway — see §2 |
| Billing unit | **micro-USD, reported by the router** — not “agent turns”, and not tokens we price ourselves. See §3.2.1 |
| Pricing model | **Flat subscription with a hard cost ceiling**, not prepaid credits, not a soft cap |
| Auth + DB | **Supabase** (auth + Postgres in one; JWTs verified locally, see §4.3) |
| Backend stack | **One Next.js App Router project** on Vercel — pages *and* API, see §6 |
| Hosting | **All-in Vercel**, functions in `hkg1` (§6.2). The "60s Hobby ceiling" this row used to cite does not exist — see §6.1 |
| Model transport | **Option A** (OpenAI-compatible proxy), see §4.2 |
| Enforcement unit | **The server never reasons about turns.** It sees one step and cannot see turn boundaries; anything a client sends about them can be forged. Enforcement is per-period budget plus a rolling per-user spend window. See §4.4 |

Still open: whether BYOK is Pro-only (§10 Q4) — it has a China-market wrinkle
that §3.1 gets backwards. Does not block Phase 1.

## 1. Goal

Make the default path **install → sign in → chat**, with a paid subscription funding hosted model usage.

Keep the product differentiator intact:

- **Brain can be hosted** (model calls via Pagehand → OpenRouter)
- **Hands stay local** (CDP / `chrome.debugger` / tools still run in the side panel)

BYOK becomes an **advanced / Pro option**, not the onboarding gate.

## 2. Model router: OpenRouter

The first draft chose Vercel AI Gateway. Changed to **OpenRouter** for one
reason that outweighs everything else on the list.

### Why the usual comparison doesn’t apply

We settled on Option A (§4.2): the server is a **transparent proxy** that
forwards raw HTTP. So every “AI SDK-native” argument — `createGateway`,
`streamText`, typed model strings, Vercel OIDC — is worth nothing to us. We
never call the router from an SDK. Only three properties matter:

| | Vercel AI Gateway | OpenRouter |
| --- | --- | --- |
| OpenAI-compatible wire format | yes | yes |
| **Reports actual cost per request** | no — we must price tokens ourselves | **yes** |
| Markup on inference | — | **none**; provider list price |

### The deciding property

OpenRouter returns `usage.cost` (what it charged us) and
`usage.cost_details.upstream_inference_cost` (what the provider charged), on the
final SSE frame for streams. **Unconditionally** — the older `usage.include` and
`stream_options.include_usage` flags are documented as deprecated and inert.

That deletes the `model_prices` table and the price-weighting arithmetic from
§4.4. It was the most fragile part of the billing design: a stale price row bills
every user wrongly, silently, until someone notices. The router already knows the
number, so it should be the one to say it.

The ledger unit stays micro-USD. Only its source changes — from *we compute it*
to *the router reports it*.

### Cost of the switch

- Fees land on **credit purchases**, not inference: 5.5% via Stripe ($0.80 min),
  5% via crypto. Inference itself is pass-through at provider list price.
- Our cost accounting now trusts a third party’s metering. Acceptable: it is the
  same number they invoice us for, so we are reconciling our own bill.

### Bonus, not load-bearing

Gateway-level BYOK (users attaching their own provider keys) is free for the
first 1M requests/month, then 5%. §7 Phase 4 wanted this; it now comes for free.

### Hard constraint (unchanged)

**Never ship the router API key inside the extension.**  
A leaked key = anyone burning Pagehand credits. The extension must call **our**
API; only the server holds the router credential. This was the original reason
for the proxy and it survives the router change intact.

### What did *not* improve

- **Mainland China access.** `openrouter.ai` is as unreachable as any other
  overseas host; having DeepSeek in the catalog doesn’t help when the route to
  the catalog is the problem. §3.1 stays unresolved.
- **Single point of failure.** Router down = hosted mode down, same as before.
  Mitigation is also the same: the proxy is transparent, so swapping to any
  OpenAI-compatible upstream is a one-constant change.

## 3. Product model

### 3.1 Modes

| Mode | Who | Model path | Key storage |
| --- | --- | --- | --- |
| **Hosted (default)** | Free + Pro | Extension → Pagehand API → OpenRouter → provider | None in extension |
| **BYOK (advanced)** | Pro (or later Free with limits) | Extension → provider directly (today’s path) **or** via router-level BYOK | User key in `chrome.storage.local` (unchanged) |

Recommendation: ship **hosted-only for Free**; unlock BYOK on Pro so privacy-sensitive users can keep keys off our servers.

> **Mainland China — corrected.** An earlier revision of this section claimed a
> mainland user could not use hosted mode at all, on the grounds that every hop
> after the extension is overseas. That reasoning was wrong: the *browser*
> crosses the border exactly once, to `pagehand.app`. Everything past that —
> OpenRouter, the provider — is server-to-server inside a US datacentre and
> never touches the GFW. If the first hop works, hosted works.
>
> So the open question is narrower than it looked, and it is about the first hop
> only:
>
> - **Reachability.** Vercel has no mainland PoP; requests land on the nearest
>   Anycast edge (`hkg1` in practice). That usually works and is not guaranteed
>   — it varies by carrier and time of day, so it is a reliability question, not
>   a yes/no one. A custom domain avoids the separate problem of `*.vercel.app`
>   being DNS-poisoned. Measure from an unproxied mainland network; a developer
>   machine behind a proxy proves nothing.
> - **Latency, which is the bigger risk.** One turn is up to 100 *sequential*
>   requests. Each pays China → edge → function region → OpenRouter → provider
>   and back. Server-side alone we measured 3.2s and 4.5s per step in §3.2.2;
>   adding a transpacific round trip to each is what decides whether hosted is
>   usable there, not whether it connects.
> - **Function region is a lever with a trap.** Moving functions to `hkg1` cuts
>   that latency, but OpenRouter gates models on the *caller's* region — the
>   same mechanism that returned "This model is not available in your region"
>   for OpenAI and Anthropic during Phase 1a testing. A Hong Kong function may
>   inherit a smaller catalogue. Decide this deliberately rather than by
>   default.
>
> BYOK + DeepSeek stays the better mainland experience regardless: it is a
> domestic connection that never crosses the border. That is an argument for
> keeping BYOK available on Free, but a weaker one than "hosted cannot work
> there" — because hosted can.

### 3.2 Plans (starting point — tune before launch)

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | TBD (e.g. $12–20 / mo) |
| Hosted allowance / month | Small, hard-capped (§3.2.1) | Larger, still hard-capped |
| Models | 1–2 cheap defaults (e.g. flash-class) | Default + stronger model(s) |
| Tools | Full v1 tool surface | Same (+ later Pro-only tools) |
| BYOK | No | Yes |
| Threads / ledger | Current local behavior | Same |

**Bill the subscription in Stripe; bill LLM cost to Pagehand via OpenRouter credits.**  
Do **not** start with pure metered “pass-through token billing” to end users — UX is worse and support load is higher. Use flat sub + quota; tighten quotas once we see real spend per user.

### 3.2.1 Unit of quota: micro-USD, as reported by the router

The ledger records **micro-USD**, taken from `usage.cost` on each response (§2).
Three units were considered; two don’t survive contact with the architecture:

- **Agent turns — not observable server-side.** The agent loop runs in the panel;
  the server only ever sees one step. Turn boundaries are known only to the
  client, which can lie about them. Cost, by contrast, is measured where it is
  incurred.
- **Raw tokens — not one quantity.** Model prices span ~30x (flash-class
  ~$0.1/Mtok vs frontier ~$3/Mtok), so “1M tokens” means nothing on its own.
- **Cost in micro-USD — what we actually care about**, and since the router
  reports it per request, we neither maintain a price table nor recompute it.

The UI never shows tokens or dollars-of-cost — it shows **credits / percent of
allowance remaining**. micro-USD is an internal accounting unit.

**Consequence for pricing:** the cap must be **hard** (402 when the period budget
is spent), not a “soft cap.” The unit economics leave no room for a soft one:

| | per step | per heavy turn (~40 steps) |
| --- | --- | --- |
| Input tokens | ~20K (snapshot + resent history) | ~500K–1M |
| Cost @ flash-class | ~$0.002 | **$0.05–0.10** |

### 3.2.2 Measured, Phase 1a

Real numbers from `deepseek/deepseek-v4-flash-0731` through the proxy, replacing
the estimates above where they disagree:

| | measured |
| --- | --- |
| Prompt, uncached | **~$0.09 / Mtok** |
| Completion | **~$0.18 / Mtok** |
| Prompt, cache hit | **~1/10 of uncached** |

Two consecutive steps of one tool-using turn, showing history growth and what
caching is worth:

| | step 1 | step 2 |
| --- | --- | --- |
| prompt_tokens | 4,439 | 8,518 (tool result appended) |
| cached_tokens | 4,352 | 4,352 |
| cost | 99 µUSD | 533 µUSD |

An earlier step of nearly identical size (4,436 prompt) but only 64 cached
tokens cost **407 µUSD** — four times as much. **Prompt caching is the single
biggest lever on cost per turn**, worth more than the choice of model.

**Diagnosed and fixed.** The 407 µUSD outlier was not the message trimming — it
was the *front* of the prompt moving. The ledger digest and reflection note were
appended to `instructions`, which sits ahead of everything else, and every
provider's prompt cache matches a **prefix**: one changed byte at position zero
and nothing after it can be reused. So every step following a ledger write paid
full price for the entire history. Both volatile blocks now ride as a live note
at the *end* of the messages instead (`src/lib/llm/liveNote.ts`), where the
break lands on the last step's assistant and tool messages — new and uncacheable
anyway. `instructions` is now byte-stable for the whole turn, and there is a
test asserting exactly that, because it is a property that would regress
silently.

**Anthropic needs a second fix, already landed.** DeepSeek and OpenAI cache
without being asked; Anthropic caches only up to an explicit breakpoint, so a
Claude model served without one pays full price for the whole resent history on
every step — silently, since the requests all succeed. The proxy now sends the
router's request-root form, `cache_control: { type: 'ephemeral' }`, for
`anthropic/*` models only (it advances the breakpoint as the conversation grows,
which is the shape an agent loop needs; the per-block form caps at four and
would need the extension to place them). Gated on the model prefix because an
unrecognised root field is a 400 waiting to happen elsewhere. Nothing on the
allowlist uses it yet — that is the point, it cannot be forgotten on the day
Claude joins.

`elideStaleSnapshots` and `compactHistory` were left alone. They do break the
prefix, but the trade is closer than it looks: carrying a stale 12K-token
snapshot costs ~1.2K tokens-equivalent *per step* at the cache-hit rate, while
eliding it costs the uncached suffix *once*. Around a dozen remaining steps they
break even, and the context-window argument then decides it. Not worth churning
without a measurement that says otherwise.

The $0.05–0.10 heavy-turn figure should therefore be read as an **upper bound**
(no cache reuse), not an expected value.

`MAX_STEPS` is 100 and every step resends the whole turn, so a single user can
burn a month of a $20 subscription in a day. Mitigations, all required:

- Hard per-period micro-USD ceiling
- A **lower `maxSteps` on the hosted path** than the BYOK path’s 100
- Per-turn cost ceiling, enforced by the server (see §4.4)

### 3.3 Positioning rewrite (when we ship)

Old: “No Pagehand backend, accounts, or telemetry” / pure BYOK.

New:

- Local execution of page actions via CDP
- Hosted optional brain with your Pagehand account
- Advanced: bring your own key — then prompts go only to your provider
- Privacy policy must state: in hosted mode, chat + tool context needed for the model are sent to Pagehand and then to the configured model provider via OpenRouter

## 4. Target architecture

```
┌─────────────────────────────────────────────────────────┐
│ Chrome side panel                                       │
│  • agentLoop / orchestrator (unchanged locus)           │
│  • CDP tools (unchanged)                                │
│  • auth session (cookie / token)                        │
│  • resolveModel():                                      │
│      hosted → Pagehand LanguageModel / proxy            │
│      byok   → existing providers.ts path                │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS (stream)
                            ▼
┌─────────────────────────────────────────────────────────┐
│ `cloud/` — one Next.js App Router project on Vercel     │
│  pages:                                                 │
│    /pricing  /account  /auth/callback                   │
│  routes:                                                │
│    /api/billing/checkout   → Stripe hosted Checkout     │
│    /api/billing/webhook    → subscription state         │
│    /api/me                 → plan + remaining allowance │
│    /api/v1/chat/completions ← the only long-lived one   │
│      · verify Supabase JWT locally (no round-trip)      │
│      · pre-check balance → 402 / concurrency → 429      │
│      · forward to the router with the server key        │
│      · attribution: user = userId, HTTP-Referer/X-Title │
│      · tee stream → read usage.cost → debit (after())   │
└───────────────────────────┬─────────────────────────────┘
                            ▼
                       OpenRouter
                            ▼
                   OpenAI / Anthropic / …

        Supabase (auth + Postgres) alongside, for both.
```

Payment UI is **not** ours: Stripe Checkout hosts the card form, Stripe Customer
Portal hosts card changes / invoices / cancellation. The pages we write are
`/pricing` and `/account`; “top up” is a button that redirects.

The extension never embeds payment UI — “Upgrade” opens `/account` in a browser
tab via `chrome.tabs.create`. (Confirm current CWS payments policy before
listing.)

### 4.1 Keep the agent loop in the extension

Do **not** move `runAgentTurn` / tool execution to the server.

Reasons:

- Tools need `chrome.debugger` in the side panel
- Round-tripping every `click` / `take_snapshot` through the server adds latency and failure modes
- Current stack (`agentLoop` + `orchestrator` + local tools) already fits “remote model, local tools”

Server responsibility per model call: **auth → quota → stream one `streamText` / chat-completions step (with tool definitions in the request) → return stream**.  
Client still executes tools and calls the API again for the next step (same as today’s multi-step loop, different transport).

### 4.2 Two implementation options for the model transport

**Option A — OpenAI-compatible proxy (recommended for reuse)**  
Pagehand exposes something like `POST /api/v1/chat/completions` that:

1. Validates session + quota
2. Forwards to `https://openrouter.ai/api/v1` with the server key
3. Injects attribution (`user`, `HTTP-Referer`, `X-Title`)
4. Streams SSE back

Extension hosted path ≈ today’s `openai-compatible` provider with `baseURL = https://pagehand…/api/v1`, authenticated by a **user session token** (never the router key) injected per request — see §4.3.

Pros: smallest change to `providers.ts` / `agentLoop.ts`.  
Cons: must carefully forward tool-call streaming semantics.

Note the model id format is unchanged: OpenRouter also namespaces as
`vendor/model` (`openai/gpt-4.1-mini`), so the extension needed no edit for the
router switch.

**Option B — AI SDK UI message / custom protocol**  
Server runs `streamText` and returns `toUIMessageStreamResponse()`; client adapts events into `AgentEvent`.

Pros: idiomatic AI SDK on server.  
Cons: more client adapter work; farther from current `streamText`-in-panel shape.

**Decision for v1:** Option A unless proxying tool streams proves painful — then fall back to B for the hosted path only.

### 4.3 Auth — Supabase

Chosen over Clerk and Auth.js because its refresh-token flow works from an
extension without cookies, and it brings the Postgres the usage ledger needs
anyway (Clerk would still require a separate DB).

- Extension: `chrome.identity.launchWebAuthFlow` → Supabase OAuth (Google) →
  refresh token into `chrome.storage.local` (session token, not provider keys)
- Access token rides as the `Authorization` bearer on every hosted model call

**Verify the JWT locally in the route handler** (`jose` + the project’s JWT
secret). One turn is up to 100 requests; calling Supabase to validate each one
would add a network round-trip 100 times per turn. Only login and refresh
actually talk to Supabase.

**Token refresh must not use a static `apiKey`.** A turn spans minutes and
hundreds of requests, so an access token can expire mid-turn and 401 halfway
through. The hosted branch passes a custom `fetch` to `createOpenAI` that
fetches a live token per request — see `src/lib/llm/hostedFetch.ts`.

Chrome extension OAuth is the fiddliest UI piece — budget explicit time in Phase 1.

### 4.4 Billing

- **Stripe Checkout** + Customer Portal for Pro
- Webhook → mark `users.plan = pro` / period end
- Reject hosted requests with `402` / `429` when over Free cap; UI CTA to upgrade

Tables:

- OpenRouter: pre-purchased credits + a **per-key spend limit** as a circuit breaker for abuse
- Send `user = userId` plus `HTTP-Referer` / `X-Title` on every hosted call, for spend forensics on their dashboard

Tables:

```
auth.users        -- Supabase built-in
subscriptions     user_id, stripe_customer_id, plan, current_period_end
users             user_id, blocked, normalized_email (unique — §4.5)
balances          user_id, period_start, granted_micros, used_micros, in_flight
usage_events      user_id, ts, model, tokens_in/out/cached, micro_usd, turn_id
```

**No `model_prices` table.** An earlier revision had one; OpenRouter reports
`usage.cost` per request, so we store what we were charged instead of
recomputing it from a price list that could silently go stale (§2).

**What the server can and cannot enforce.** It cannot enforce anything
per-turn. The agent loop runs in the panel, so a request arriving at the proxy
is one step with no way to tell which turn it belongs to — and a `turn_id`
supplied by the client is a claim from the party being metered, so it is fine
for grouping `usage_events` in a dashboard and worthless as a control. Drop the
per-turn cost ceiling that earlier revisions listed here. What survives:

- **Hard per-period budget.** `granted_micros` vs `used_micros`; 402 when spent.
  This is the real ceiling.
- **Rolling per-user spend window** (e.g. µUSD per 5 minutes, alongside rpm and
  concurrency). Needs no client cooperation and is what actually contains a
  runaway loop or a scripted abuser between period boundaries.
- **Per-request caps** — model allowlist, `max_tokens` clamp, body size.

**Three mechanics that are easy to get wrong:**

1. **Usage arrives only in the final SSE frame.** OpenRouter includes it
   unconditionally, so nothing has to be requested — but the proxy still forces
   `stream_options.include_usage`, since that is the requirement we place on
   *any* upstream, and this one merely happens to satisfy it already. Parse the
   tee’d stream and debit after it closes (`after()` on Next).
   **A missing usage frame must raise, not default to zero** — zero is
   indistinguishable from a free request and would serve tokens for nothing.
2. **The final frame often never arrives, and that is not an edge case.** A turn
   is up to a hundred steps behind a stop button, so streams torn down
   mid-flight are routine — and the router still charges us for what was
   generated first (providers with stream cancellation bill the partial
   completion; providers without it keep generating and bill the whole thing).
   Without a recovery path, "press stop" is a working way to use the hosted
   model for free, and an easy one to stumble into. So `readUsage` also returns
   the **generation id** from the stream's frames, and the proxy falls back to
   `GET /generation?id=` (`lookupGeneration`, retried — the record settles
   slightly after the stream dies) to learn what a torn-down request cost.
   `onUsage` reports `source: 'stream' | 'lookup' | 'missing'`; **`missing` is
   the leak counter and belongs on a dashboard.**
   Still outstanding: `after()` is not guaranteed to survive a client
   disconnect, which is exactly when the lookup fires. If `missing` turns out to
   be non-trivial in practice, the fix is a `pending_generations` row written
   *before* the upstream call and swept by a cron that settles it from the same
   lookup — so the account survives the function being killed.
3. **Debiting is post-hoc**, so a user at zero balance can fire N requests in
   parallel and have them all pass the pre-check. Needs a per-user in-flight
   counter (the `balances.in_flight` column, or Upstash Redis) reserved before
   the upstream call and released after.

**Design the block flag into the balance pre-check, not after it.** Today
`authenticate()` verifies the JWT locally and touches no database — deliberately,
because a turn verifies a hundred times (§4.3). That means there is currently no
point at which a ban could take effect: a blocked user keeps working until their
token expires. Adding a lookup *for the ban alone* would put a database round
trip on the hot path and undo the reason local verification exists.

But the balance pre-check has to read the user's row anyway. So `users.blocked`
must be **selected and cached in the same query and the same short TTL** as
`granted_micros` / `used_micros` — then banning costs nothing extra and takes
effect within the cache TTL. Done in that order it is free; retrofitted
afterwards it is either a second round trip or a ban that does not bite.

The corollary is that **no admin UI is on the critical path**. With `blocked` in
the schema and `granted_micros` writable, banning and comping are one edit each
in the Supabase table editor. Build a `/admin` page in `cloud/` when doing it by
hand starts to hurt — gated the way `ALLOWED_EMAILS` gates the preview — rather
than standing up a separate admin vendor for a handful of rows.

### 4.5 Abuse controls (non-optional)

- Auth required for hosted mode
- Per-user rate limit: rpm, concurrent requests, and a **rolling µUSD window**
  (§4.4). Not "concurrent turns" — the server cannot see a turn.
- Max steps / max episodes live in the orchestrator, client-side, so they are a
  cost *estimate*, not a control. Mirror what can be mirrored per request
  (reject absurd `max_tokens`, allowlist models) and let the rolling window
  catch the rest.
- Router key spend limit + alert
- Content size caps on request body (snapshots can be large — truncate server-side too)

**Free-tier farming.** A hard per-account cap moves the attack from "burn one
account" to "make more accounts", so the free grant has to be worth less than
the effort of a fresh mailbox. Cheapest measures, in the order they pay off:

1. **Normalize the email before the uniqueness check** — strip Gmail dots and
   everything after `+`. Nearly all casual farming is `me+1@gmail.com`, and a
   unique index on the normalized address ends it for one migration's work.
2. **Block disposable domains** with a maintained list. Cheap, catches the lazy
   majority, needs occasional refresh.
3. **Size the free grant so farming is not worth it.** A heavy turn is
   $0.05–0.45 (§3.2.1). A free grant worth a few turns is a demo; one worth a
   week of work is a target. This is the actual defense — the other two only
   raise the cost per identity.
4. **Cap accounts per install.** Generate a UUID in `chrome.storage` at install
   and send it at sign-up. Trivially bypassed by a determined user, which is
   fine: it is aimed at the undetermined one.

Deliberately not doing: phone verification, or a card on file for Free. Both cost
more conversion than the tokens they save at this stage.

## 5. Code impact (extension)

| Area | Change |
| --- | --- |
| `src/lib/storage/schema.ts` | Add `hosted` to `ProviderId`; make `apiKey` optional (hosted has none); store auth session |
| `src/lib/llm/providers.ts` | Hosted branch → Pagehand baseURL, auth via `hostedFetch`; keep existing BYOK switch |
| `src/lib/llm/hostedFetch.ts` | **New.** Per-request token injection + refresh; never a static `apiKey` (§4.3) |
| `src/lib/llm/agentLoop.ts` | **Done.** `turnLimits(provider)` gives the hosted path 60 steps × 5 episodes against BYOK’s 100 × 8 — worst case per user message drops from ~900 model calls (~$0.45) to ~360 (~$0.18). Both axes had to move: they multiply |
| `src/lib/llm/liveNote.ts` | **Done.** Volatile per-step state moved out of `instructions` so the prompt prefix stays cacheable (§3.2.2) |
| `SettingsPanel` | Default: account + plan + model picker; Advanced: BYOK providers |
| Onboarding | Gate on **signed in** (hosted), not on API key |
| Store listing + privacy + website | Rewrite backend/privacy claims. Site and policy done; the listing text lives in the Web Store dashboard and still says "no Pagehand backend" |
| `extract_content` sub-call | Goes through `resolveModel`, so it is already on the hosted path and billable. **Done:** switched from `generateText` to a collected `streamText` with an output cap and a 45s deadline — it is the one call that can reach the proxy's own 60s `maxDuration`, where the kill loses both the response *and* the usage frame (§6.1) |

## 6. Backend shape

One new Next.js App Router project, `cloud/`, deployed as its own Vercel
project. The existing static `website/` stays exactly as it is — rewriting
marketing buys nothing right now, and its landing page just needs a link.

```
website/          # untouched: static marketing, own Vercel project
cloud/            # Next.js App Router — pages AND api
  app/
    pricing/      # page
    account/      # page: allowance, usage, subscription
    auth/callback/
    api/
      v1/chat/completions/route.ts   # the proxy
      billing/{checkout,webhook}/
      me/
  lib/
    proxy.ts      # (Request) => Response — framework-agnostic on purpose
```

Next.js rather than Hono because `cloud/` has real pages to render, and Next is
the zero-friction path on Vercel. The proxy itself is still written as a plain
`(Request) => Promise<Response>` in `lib/proxy.ts` — a Next route handler
already has that signature, so if a platform limit or a pricing change ever
forces a move to another runtime, one file moves unchanged. That hedge is free;
take it — even though the duration limit it was originally hedging against
turned out not to exist (§6.1).

**DB:** Supabase Postgres (same project as auth).

### 6.1 Vercel Hobby — the duration risk is gone; the plan restriction is not

**Corrected.** Earlier revisions of this document treated a **60s Hobby function
ceiling** as an accepted risk and as an argument for Pro. That ceiling no longer
exists: with fluid compute (default for new projects) the platform allows **300s
default and maximum on Hobby**, and 300s default / 800s maximum on Pro. Nothing
about a long agent step is blocked by the plan.

What remains true:

- The route must still declare `maxDuration` explicitly, since the framework
  default is well below the platform maximum. It is set to **60s — our bound,
  not the platform's** (see the comment on the route). A step that has not
  answered in a minute has gone wrong.
- Request/response bodies are capped at **4.5 MB** by the platform. Our
  `MAX_REQUEST_BYTES` is 4 MB, deliberately just under, so an oversized snapshot
  gets our 413 with a message rather than the platform's.
- **Hobby is a non-commercial plan.** This is the actual reason Pro is required
  before charging anyone — not duration.

### 6.2 Where the proxy runs — latency for mainland users

Today functions run in `iad1` (Washington D.C.), the default. That is the wrong
side of the planet for the users we have, and the cost compounds: a turn is up
to a hundred sequential steps, so every millisecond of round trip is paid a
hundred times. Vercel's PoPs terminate TCP near the user but **TLS terminates at
the function's region**, so the handshake itself currently crosses the Pacific
too.

The move is smaller than it looks. Region choice is **not** a Pro feature — every
plan runs in one region and every plan can choose which one; Pro only buys the
ability to run in several. So **set `regions: ["hkg1"]` (Hong Kong, `ap-east-1`)
now, on Hobby**, and let the Pro upgrade happen on its own schedule for the
commercial-use reason (§6.1). No migration, no new vendor, no waiting.

Hong Kong specifically, and not a mainland region: hosting inside mainland China
requires ICP 备案 (a filing tied to a domestic host and a real corporate entity,
with an approval wait). Hong Kong, Macau and Taiwan do not count as mainland for
that rule, so a Hong Kong region carries none of it while still reaching
mainland users at tens of milliseconds instead of hundreds.

Two things this does *not* fix, worth stating so nobody expects them:

- **The proxy → OpenRouter leg still crosses the Pacific.** OpenRouter is US
  infrastructure. Hong Kong shortens the leg that carries the streamed tokens
  and the handshake, which is the leg whose quality actually varies; it does not
  shorten the total path.
- **Possibly a third crossing.** If OpenRouter routes our DeepSeek traffic to
  DeepSeek's own API rather than to a US reseller of the same weights, the path
  is CN → HK → US → CN. Worth measuring before assuming it; if it is real, the
  answer is a direct DeepSeek call for that one model — which costs us
  `usage.cost` and reintroduces the price table §2 exists to avoid, so it is a
  trade to make on evidence, not on suspicion.

Keep `maxDuration = 60` and the 45s `extract_content` deadline regardless of
plan. They were originally sized against a platform ceiling that turned out not
to exist (§6.1), but a bound on a single model call is a good idea on its own
merits — the failure it prevents is an expensive step nobody is watching.

## 7. Phased delivery

### Phase 0 — Decisions (short)

- [x] Auth vendor → **Supabase** (§4.3)
- [x] Confirm Option A vs B for transport → **Option A** (§4.2)
- [x] Quota unit → **micro-USD** (§3.2.1)
- [ ] Stripe price point + Free allowance (in micro-USD)
- [ ] Default hosted model id on OpenRouter
- [ ] BYOK on Free or Pro-only (§3.1 — China wrinkle)
- [ ] Legal: privacy policy + CWS single-purpose / data-use updates

### Phase 1 — Vertical slice (internal)

Split in two: the transport is the real unknown, and it can be proven with no
auth and no billing at all. Do 1a before touching Supabase.

**1a — transport (local only, no auth, no billing) — DONE**

- [x] `cloud/` Next project + `lib/proxy.ts` → OpenRouter, streaming passthrough
- [x] Force `stream_options.include_usage`; tee the stream and log the usage
      object (proves the §4.4 accounting assumption while we’re here)
- [x] Model allowlist + request body size cap
- [x] Extension: `hosted` provider branch, endpoint chosen at build time
- [x] **Verified: a multi-step tool-using turn survives the proxy.** Consecutive
      steps with the prompt growing 4,439 → 8,518 as tool results append, both
      200, usage and cost captured on each. Option A holds; **Option B is not
      needed** and §4.2's open question is closed.

**1b — auth — DONE**

- [x] Supabase project, sign-in from the extension
- [x] Local JWT verification in the route handler
- [x] `hostedFetch` refreshing the access token per request
- [x] Hard-coded allowlist of emails / still no billing

**Exit met:** signing in and running a turn with no provider key in Settings.

Three things the plan had wrong, worth carrying forward:

- **Not `launchWebAuthFlow`.** It watches a window it opened for the redirect
  that ends the flow, and an emailed link opens wherever the mail client sends
  it — a window Chrome is not watching. Sign-in runs in an ordinary tab and the
  page returns the session through `chrome.runtime.sendMessage`, which the
  manifest's `externally_connectable` permits for one origin. The cost: the
  link must be opened in this Chrome profile.
- **No shared JWT secret.** The project signs with ES256 and publishes a JWKS,
  so verification needs no secret at all — better than §4.3 assumed.
- **Email templates need SMTP.** The free tier refuses template changes while
  the built-in mail service is in use, so the email carries a link and not a
  code. That service is also rate-limited to a handful of messages an hour and
  cannot carry a real sign-in flow. `supabase/templates/magic_link.html` is
  written and commented out, waiting on an SMTP sender — at which point the
  email can carry both, and the code becomes the fallback for anyone reading
  their mail outside this browser.

### Phase 1c — before anyone else can sign in

- [ ] Custom SMTP (the built-in sender cannot serve more than a test account)
- [ ] Pin the extension id with a manifest `key`, so unpacked and published
      builds share one id and the allow-lists stop needing two entries

### Phase 2 — Entitlements

- [ ] Free quota enforcement
- [ ] Stripe Checkout + Portal + webhooks
- [ ] Settings: plan badge, remaining turns, Upgrade
- [ ] Router attribution (`user`, `X-Title`) reporting
- [ ] Basic admin: spend by user from the OpenRouter dashboard

**Exit:** unknown user hits Free cap → upgrade → Pro quota applies.

### Phase 3 — BYOK as advanced + polish

- [ ] Pro unlocks existing BYOK settings
- [ ] Empty-state / onboarding copy for hosted-first
- [x] Privacy policy + website messaging (hosted-first, private preview stated)
- [ ] Store listing messaging — dashboard copy + data-safety answers still claim no backend
- [ ] Failure UX: quota, auth expired, router outage
- [ ] Telemetry: turn success rate, cost per turn (internal)

### Phase 4 — Hardening (post-launch)

- [ ] Model picker (Free vs Pro catalogs)
- [ ] Spend alerts / automatic throttle when router burn spikes
- [ ] Optional overage or “buy turn packs”
- [ ] Consider router-level BYOK for users who want routing/fallback but own provider keys

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Token cost >> subscription price | Hard Free cap; prefer flash defaults; monitor `$ / turn` from `usage.cost` in the ledger |
| Router key leak | Server-only; rotate; per-key spend limit |
| Extension OAuth pain | Phase 1 spike before building billing |
| Privacy backlash vs old “no backend” claim | Honest hosted/BYOK split; BYOK for Pro; update store copy **before** review |
| Tool-call streaming quirks through proxy | Phase 1 must prove multi-step tools; else Option B |
| `extract_content` double-spend | Count nested generations toward same quota |
| CWS policy / remote code | Keep tool execution local; API is data/LLM only — no remote code execution |

## 9. Success metrics

- **Activation:** % installs that complete first hosted turn within 24h (vs today’s “saved API key”)
- **Conversion:** Free → Pro within 14 days
- **Unit economics:** OpenRouter spend / Pro revenue &lt; target (e.g. 40%)
- **Retention:** weekly hosted turns among Pro
- **Support:** “how do I get an API key?” tickets → near zero

## 10. Open questions

1. Price, and the Free / Pro allowance in micro-USD?
2. ~~Auth vendor~~ → Supabase (§4.3)
3. Hosted default model (cost vs quality for “summarize / click / console”)?
4. **Is BYOK Pro-only at launch, or available on Free?** — see the China note in §3.1
5. Regions / compliance: any need to keep EU traffic separate?
6. Keep DeepSeek as BYOK default for existing users during migration?
7. What is the hosted `maxSteps`, and what is the per-turn cost ceiling?
8. Is compaction worth its cost now that caching is measured (§3.2.2)? Trimming
   history to fit the context window throws away the cached prefix that makes a
   step 4x cheaper.

## 11. Immediate next step

**Phase 1a only** (§7): a `cloud/` Next route that proxies a streaming
chat-completions call through OpenRouter with no auth and no billing, plus a
`hosted` branch in `providers.ts` pointed at localhost. Do not build Supabase or
Stripe until that path runs a real tool-using turn in the side panel.
