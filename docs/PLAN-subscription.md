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
| Hosting | **All-in Vercel.** The 60s Hobby function ceiling is a known, accepted risk |
| Model transport | **Option A** (OpenAI-compatible proxy), see §4.2 |

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

> **Unresolved — this recommendation is probably backwards for mainland China.**
> The hosted chain is extension → our API → OpenRouter → provider; every hop
> after the first is overseas, so a mainland user without a VPN cannot use
> hosted mode at all, no matter where we host. BYOK + DeepSeek (domestic,
> directly reachable) is their *only* working path — which is exactly why
> `DEFAULT_PROVIDER` is `deepseek` today. Putting BYOK behind Pro tells those
> users the extension installs but does not run. Either open BYOK on Free, or
> decide explicitly that hosted mode targets non-China markets only.
>
> Note also that Vercel and Cloudflare are equivalent here — neither has
> mainland PoPs on non-enterprise plans, and both default domains
> (`*.vercel.app`, `*.workers.dev`) have a history of being blocked. Bind a
> custom domain either way.

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
balances          user_id, period_start, granted_micros, used_micros, in_flight
usage_events      user_id, ts, model, tokens_in/out/cached, micro_usd, turn_id
```

**No `model_prices` table.** An earlier revision had one; OpenRouter reports
`usage.cost` per request, so we store what we were charged instead of
recomputing it from a price list that could silently go stale (§2).

**Two mechanics that are easy to get wrong:**

1. **Usage arrives only in the final SSE frame.** OpenRouter includes it
   unconditionally, so nothing has to be requested — but the proxy still forces
   `stream_options.include_usage`, since that is the requirement we place on
   *any* upstream, and this one merely happens to satisfy it already. Parse the
   tee’d stream and debit after it closes (`after()` on Next).
   **A missing usage frame must raise, not default to zero** — zero is
   indistinguishable from a free request and would serve tokens for nothing.
2. **Debiting is post-hoc**, so a user at zero balance can fire N requests in
   parallel and have them all pass the pre-check. Needs a per-user in-flight
   counter (the `balances.in_flight` column, or Upstash Redis) reserved before
   the upstream call and released after.

### 4.5 Abuse controls (non-optional)

- Auth required for hosted mode
- Per-user rate limit (rpm + concurrent turns)
- Max steps / max episodes already in orchestrator — enforce server-side mirrors where possible (e.g. reject absurd `max_tokens`)
- Router key spend limit + alert
- Content size caps on request body (snapshots can be large — truncate server-side too)

## 5. Code impact (extension)

| Area | Change |
| --- | --- |
| `src/lib/storage/schema.ts` | Add `hosted` to `ProviderId`; make `apiKey` optional (hosted has none); store auth session |
| `src/lib/llm/providers.ts` | Hosted branch → Pagehand baseURL, auth via `hostedFetch`; keep existing BYOK switch |
| `src/lib/llm/hostedFetch.ts` | **New.** Per-request token injection + refresh; never a static `apiKey` (§4.3) |
| `src/lib/llm/agentLoop.ts` | No semantic change. Hosted path should run a **lower `maxSteps`** than BYOK’s 100 (§3.2.1) |
| `SettingsPanel` | Default: account + plan + model picker; Advanced: BYOK providers |
| Onboarding | Gate on **signed in** (hosted), not on API key |
| `store/LISTING.md` + privacy + website | Rewrite backend/privacy claims |
| `extract_content` sub-`generateText` | Must also go hosted path / count against quota |

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
already has that signature, so if the 60s ceiling ever forces a move to
Cloudflare Workers, one file moves unchanged. That hedge is free; take it.

**DB:** Supabase Postgres (same project as auth).

### 6.1 Accepted risk: Vercel Hobby

- Hobby caps functions at **60s**, and a step carrying a large snapshot to a slow
  model can exceed it — the stream is then cut mid-turn. Accepted for now.
- The default timeout is well below 60s, so the proxy route **must** declare
  `export const maxDuration = 60` or it will cut out far earlier than that.
- Hobby is a non-commercial plan. Fine for the spike; **Pro is required before
  charging anyone.**

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

**1a — transport (local only, no auth, no billing)**

- [ ] `cloud/` Next project + `lib/proxy.ts` → OpenRouter, streaming passthrough
- [ ] Force `stream_options.include_usage`; tee the stream and log the usage
      object (proves the §4.4 accounting assumption while we’re here)
- [ ] Model allowlist + request body size cap
- [ ] Extension: `hosted` provider branch pointed at `http://localhost:3000/api/v1`
- [ ] **Verify a real multi-step tool-using turn survives the proxy**

**1b — auth**

- [ ] Supabase project; `launchWebAuthFlow` sign-in from the extension
- [ ] Local JWT verification in the route handler
- [ ] `hostedFetch` refreshing the access token per request
- [ ] Hard-coded allowlist of emails / still no billing

**Exit:** you can sign in and run “Summarize this page” / “console errors” without any provider key in Settings.

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
- [ ] LISTING + privacy + website messaging
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

## 11. Immediate next step

**Phase 1a only** (§7): a `cloud/` Next route that proxies a streaming
chat-completions call through OpenRouter with no auth and no billing, plus a
`hosted` branch in `providers.ts` pointed at localhost. Do not build Supabase or
Stripe until that path runs a real tool-using turn in the side panel.
