# Pagehand Subscription Plan

> Status: draft · Target: subscription-first + optional BYOK · LLM routing: **Vercel AI Gateway**
>
> Related product decision: move primary UX off “paste your own API key” to “sign in and use.”

## 1. Goal

Make the default path **install → sign in → chat**, with a paid subscription funding hosted model usage.

Keep the product differentiator intact:

- **Brain can be hosted** (model calls via Pagehand → AI Gateway)
- **Hands stay local** (CDP / `chrome.debugger` / tools still run in the side panel)

BYOK becomes an **advanced / Pro option**, not the onboarding gate.

## 2. Verdict: Vercel AI Gateway — yes, with one hard constraint

**Use AI Gateway** as the unified model router, spend ledger, and fallback layer.

| AI Gateway gives us | It does **not** replace |
| --- | --- |
| One key → many models (`openai/…`, `anthropic/…`, `deepseek/…`) | User auth / accounts |
| AI SDK-native (`createGateway`, `streamText`, model strings) | Stripe subscriptions & entitlements |
| Per-request user attribution (`providerOptions.gateway.user`) | Per-user quota enforcement (we still gate) |
| Observability, budgets, provider fallbacks | Putting secrets in the extension |
| Optional team/request BYOK at gateway level | Chrome Web Store listing / privacy copy |

### Hard constraint

**Never ship `AI_GATEWAY_API_KEY` (or OIDC) inside the extension.**  
A leaked gateway key = anyone burning Pagehand credits. The extension must call **our** API; only the server holds the gateway credential.

Vercel’s own realtime guidance matches this: short-lived / server-issued access; browser never sees the master key.

## 3. Product model

### 3.1 Modes

| Mode | Who | Model path | Key storage |
| --- | --- | --- | --- |
| **Hosted (default)** | Free + Pro | Extension → Pagehand API → AI Gateway → provider | None in extension |
| **BYOK (advanced)** | Pro (or later Free with limits) | Extension → provider directly (today’s path) **or** via gateway request-scoped BYOK | User key in `chrome.storage.local` (unchanged) |

Recommendation: ship **hosted-only for Free**; unlock BYOK on Pro so privacy-sensitive users can keep keys off our servers.

### 3.2 Plans (starting point — tune before launch)

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | TBD (e.g. $12–20 / mo) |
| Hosted turns / month | Small (e.g. 30–50 agent turns) | Higher soft cap (e.g. 1k turns) or generous daily cap |
| Models | 1–2 cheap defaults (e.g. flash-class) | Default + stronger model(s) |
| Tools | Full v1 tool surface | Same (+ later Pro-only tools) |
| BYOK | No | Yes |
| Threads / ledger | Current local behavior | Same |

**Bill the subscription in Stripe; bill LLM cost to Pagehand via AI Gateway credits.**  
Do **not** start with pure metered “pass-through token billing” to end users — UX is worse and support load is higher. Use flat sub + quota; tighten quotas once we see Gateway spend per user (`gateway.user`).

**Unit of quota:** prefer **agent turn** (one user send → one orchestrated run) or **model step** over raw tokens. Tokens are hard to explain; turns map to product value. Record both (turns for UX, tokens for cost).

### 3.3 Positioning rewrite (when we ship)

Old: “No Pagehand backend, accounts, or telemetry” / pure BYOK.

New:

- Local execution of page actions via CDP
- Hosted optional brain with your Pagehand account
- Advanced: bring your own key — then prompts go only to your provider
- Privacy policy must state: in hosted mode, chat + tool context needed for the model are sent to Pagehand and then to the configured model provider via AI Gateway

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
│ Pagehand API (Vercel, expand `website/` or `apps/api`)  │
│  • Auth (session)                                       │
│  • Entitlements + quota (Free/Pro)                      │
│  • Stripe webhooks                                      │
│  • POST /api/chat (or OpenAI-compatible proxy)          │
│      → createGateway({ apiKey: AI_GATEWAY_API_KEY })    │
│      → providerOptions.gateway.user = userId            │
│      → tags: [plan, model, surface]                     │
└───────────────────────────┬─────────────────────────────┘
                            ▼
                   Vercel AI Gateway
                            ▼
                   OpenAI / Anthropic / …
```

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
2. Forwards to `https://ai-gateway.vercel.sh/v1` with the server key
3. Injects reporting user / tags
4. Streams SSE back

Extension hosted path ≈ today’s `openai-compatible` provider with `baseURL = https://pagehand…/api/v1` and a **user session token** as `apiKey` (not the gateway key).

Pros: smallest change to `providers.ts` / `agentLoop.ts`.  
Cons: must carefully forward tool-call streaming semantics.

**Option B — AI SDK UI message / custom protocol**  
Server runs `streamText` and returns `toUIMessageStreamResponse()`; client adapts events into `AgentEvent`.

Pros: idiomatic AI SDK on server.  
Cons: more client adapter work; farther from current `streamText`-in-panel shape.

**Decision for v1:** Option A unless proxying tool streams proves painful — then fall back to B for the hosted path only.

### 4.3 Auth

Pick one and stick to it for v1:

- **Clerk** or **Auth.js (Google + email)** on the Vercel app
- Extension: Chrome identity / loopback OAuth / PKCE against the same app
- Persist session refresh in `chrome.storage.local` (session token, not provider keys)

Chrome extension OAuth is the fiddliest UI piece — budget explicit time in Phase 1.

### 4.4 Billing

- **Stripe Checkout** + Customer Portal for Pro
- Webhook → mark `users.plan = pro` / period end
- Quota table: `user_id`, `period`, `turns_used`, `tokens_in/out` (optional)
- Reject hosted requests with `402` / `429` when over Free cap; UI CTA to upgrade
- AI Gateway: pre-purchased credits + **API key budget** as a circuit breaker for abuse
- Use `providerOptions.gateway.user = userId` on every hosted call for spend forensics

(Gateway’s Stripe metered headers are optional later if we add usage-based overage; not required for flat subscription v1.)

### 4.5 Abuse controls (non-optional)

- Auth required for hosted mode
- Per-user rate limit (rpm + concurrent turns)
- Max steps / max episodes already in orchestrator — enforce server-side mirrors where possible (e.g. reject absurd `max_tokens`)
- Gateway key budget + alert
- Content size caps on request body (snapshots can be large — truncate server-side too)

## 5. Code impact (extension)

| Area | Change |
| --- | --- |
| `src/lib/storage/schema.ts` | Add `mode: 'hosted' \| 'byok'`; make `apiKey` optional when hosted; store auth session |
| `src/lib/llm/providers.ts` | Hosted branch → Pagehand baseURL + session token; keep existing BYOK switch |
| `src/lib/llm/agentLoop.ts` | Prefer no semantic change; may pass user/plan headers |
| `SettingsPanel` | Default: account + plan + model picker; Advanced: BYOK providers |
| Onboarding | Gate on **signed in** (hosted), not on API key |
| `store/LISTING.md` + privacy + website | Rewrite backend/privacy claims |
| `extract_content` sub-`generateText` | Must also go hosted path / count against quota |

## 6. Backend shape (suggested)

Colocate with the marketing site on Vercel (already `website/` → Vercel):

```
website/          # or apps/web — marketing
apps/api/         # or website/app/api if migrating site to Next.js
  auth/
  billing/        # Stripe webhook, checkout session
  chat/           # proxy or streamText
  me/             # plan + quota remaining
```

If the current `website/` is static HTML, either:

1. Add a **Next.js** app for API + auth and keep static marketing as-is, or  
2. Migrate marketing into Next.js and put routes under `app/api/*`.

Prefer (2) only if marketing rewrite is already planned; otherwise a small Next API project is fine.

**DB:** Vercel Postgres / Supabase / PlanetScale — any light SQL store for `users`, `subscriptions`, `usage_periods`.

## 7. Phased delivery

### Phase 0 — Decisions (short)

- [ ] Stripe price point + Free turn cap
- [ ] Auth vendor
- [ ] Default hosted model id on AI Gateway
- [ ] Confirm Option A vs B for transport
- [ ] Legal: privacy policy + CWS single-purpose / data-use updates

### Phase 1 — Vertical slice (internal)

- [ ] Vercel project with `AI_GATEWAY_API_KEY`, OIDC in prod
- [ ] Auth: sign-in works from extension
- [ ] `POST` chat proxy → Gateway → stream back one completion
- [ ] Wire hosted `resolveModel` in extension
- [ ] Hard-coded allowlist of emails / no billing yet
- [ ] Verify tool calling + multi-step loop still works hosted

**Exit:** you can sign in and run “Summarize this page” / “console errors” without any provider key in Settings.

### Phase 2 — Entitlements

- [ ] Free quota enforcement
- [ ] Stripe Checkout + Portal + webhooks
- [ ] Settings: plan badge, remaining turns, Upgrade
- [ ] Gateway `user` + tags reporting
- [ ] Basic admin: spend by user from Gateway dashboard

**Exit:** unknown user hits Free cap → upgrade → Pro quota applies.

### Phase 3 — BYOK as advanced + polish

- [ ] Pro unlocks existing BYOK settings
- [ ] Empty-state / onboarding copy for hosted-first
- [ ] LISTING + privacy + website messaging
- [ ] Failure UX: quota, auth expired, gateway outage
- [ ] Telemetry: turn success rate, cost per turn (internal)

### Phase 4 — Hardening (post-launch)

- [ ] Model picker (Free vs Pro catalogs)
- [ ] Spend alerts / automatic throttle when Gateway burn spikes
- [ ] Optional overage or “buy turn packs”
- [ ] Consider gateway request-scoped BYOK for users who want routing/fallback but own provider keys

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Token cost >> subscription price | Tight Free cap; Pro soft cap; prefer flash defaults; monitor `$ / turn` via Gateway user tags |
| Gateway key leak | Server-only; rotate; key budget |
| Extension OAuth pain | Phase 1 spike before building billing |
| Privacy backlash vs old “no backend” claim | Honest hosted/BYOK split; BYOK for Pro; update store copy **before** review |
| Tool-call streaming quirks through proxy | Phase 1 must prove multi-step tools; else Option B |
| `extract_content` double-spend | Count nested generations toward same quota |
| CWS policy / remote code | Keep tool execution local; API is data/LLM only — no remote code execution |

## 9. Success metrics

- **Activation:** % installs that complete first hosted turn within 24h (vs today’s “saved API key”)
- **Conversion:** Free → Pro within 14 days
- **Unit economics:** AI Gateway spend / Pro revenue &lt; target (e.g. 40%)
- **Retention:** weekly hosted turns among Pro
- **Support:** “how do I get an API key?” tickets → near zero

## 10. Open questions

1. Price and Free cap numbers?
2. Auth: Clerk vs Auth.js vs Supabase Auth?
3. Hosted default model (cost vs quality for “summarize / click / console”)?
4. Is BYOK Pro-only at launch, or available on Free?
5. Regions / compliance: any need to keep EU traffic separate?
6. Keep DeepSeek as BYOK default for existing users during migration?

## 11. Immediate next step

Spike **Phase 1 vertical slice** only: Auth.js (or Clerk) + one Next route that proxies a streaming chat-completions call through AI Gateway, and a temporary hosted provider branch in `providers.ts`. Do not build Stripe until that path runs a real tool-using turn in the side panel.
