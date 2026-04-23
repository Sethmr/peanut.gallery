# `app/` — Next.js 15 App Router

Parent: [`../INDEX.md`](../INDEX.md). Running on Node 20 via Next.js 15.5.

## Pages (Server Components unless noted)

| File | Route | Purpose |
|---|---|---|
| [`layout.tsx`](layout.tsx) | — | Root layout. Global fonts, metadata defaults, Google Analytics loader gated on the cookie-consent banner (`window.__pgLoadAnalytics` only fires after `pg-analytics-consent=granted` is set), `<CookieBanner />` mount at end of `<body>`. |
| [`page.tsx`](page.tsx) | `/` | Landing page (long — the marketing + personas + stack sections). Version label at the top must match `extension/manifest.json`. |
| [`globals.css`](globals.css) | — | Global styles. Tokens + resets. |
| [`landing.css`](landing.css) | — | Landing-page-specific styles. |
| [`robots.ts`](robots.ts) | `/robots.txt` | Generated. |
| [`sitemap.ts`](sitemap.ts) | `/sitemap.xml` | Generated. |
| [`install/page.tsx`](install/page.tsx) | `/install` | Install / get-started page. Also hosts "Build Your Own Backend" callouts. |
| [`privacy/page.tsx`](privacy/page.tsx) | `/privacy` | Privacy Policy. US-only callout up top + cookie-banner disclosure. Required link from the Chrome Web Store listing. |
| [`terms/page.tsx`](terms/page.tsx) | `/terms` | Terms of Service (NEW in v1.7). US-only Plus + NC governing law + Macon County forum + AI-output disclaimer. |

Note: `/watch` (the legacy hosted reference web app) was retired alongside `components/PersonaColumn` + `components/CombinedFeed` + `components/YouTubePlayer` + `components/ApiKeysModal` + `components/TranscriptBar` as part of the v1.5 "clean out the legacy web-app UI" work. The extension is the canonical UI; the middleware at the Next.js app root 308-redirects non-`/api/*` traffic to `www.peanutgallery.live`.

## API routes

| File | Route | Purpose |
|---|---|---|
| [`api/health/route.ts`](api/health/route.ts) | `GET /api/health` | Liveness probe. No auth. |
| [`api/transcribe/route.ts`](api/transcribe/route.ts) | `POST /api/transcribe` (SSE) + `DELETE` | **The main session endpoint.** Owns the `personasFiring` lock, the director tick `setInterval`, and the SSE event stream. Threads `packId` + `rate` + keys through to `PersonaEngine` + `Director`. Try/finally around every firing branch is load-bearing — do not remove. |
| [`api/personas/route.ts`](api/personas/route.ts) | `POST /api/personas` (SSE) | Single-persona force-fire endpoint used by avatar taps. Routes through `PersonaEngine.fireSingle`. |
| [`api/feedback/route.ts`](api/feedback/route.ts) | `POST /api/feedback` | Telemetry sink for feed-entry actions (upvote / downvote / pin / quote-card). `installId`-only; no email. Writes `persona_feedback` events to the pipeline log. Feeds the smart-highlight picker (SET-24) + future persona-refinement corpus. `DISABLE_FEEDBACK_LOGGING=true` short-circuits. |
| [`api/subscription/status/route.ts`](api/subscription/status/route.ts) | `GET /api/subscription/status` | Returns `SubscriptionStatus` (valid, usedMs, remainingMs, resetAt, email) for the Plus progress bar. Header: `X-Subscription-Key`. |
| [`api/subscription/checkout/route.ts`](api/subscription/checkout/route.ts) | `POST /api/subscription/checkout` | SET-26 Phase 3: real Stripe Checkout Session creation via `POST /v1/checkout/sessions`, `billing_address_collection=required`, `shipping_address_collection.allowed_countries=[US]`. Phase 1 stub fallback when `STRIPE_ENABLED=false`. US-only gate at HTTP 451. |
| [`api/subscription/manage/route.ts`](api/subscription/manage/route.ts) | `POST /api/subscription/manage` | SET-27 recover/cancel/billing flows. Sends magic-link or recovery email via Resend; `emailConfigSnapshot()` in logs; all email values now redacted via `emailForLog`. |
| [`api/subscription/webhook/route.ts`](api/subscription/webhook/route.ts) | `POST /api/subscription/webhook` | SET-26 Stripe event handler. Signature verification first (via `lib/stripe-webhook.ts`), then switch on `event.type` — `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Idempotent via `stripe_sub_id` correlation. US-only defense in depth: non-US billing country → Stripe cancel + no key. |

## Key env vars

**Required for transcription pipeline:** `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`.

**Optional (search):** `BRAVE_SEARCH_API_KEY` — only used when `SEARCH_ENGINE=brave` (default). When `SEARCH_ENGINE=xai`, the xAI Live Search path uses `XAI_API_KEY`.

**Gating flags:** `ENABLE_FREE_TIER_LIMIT`, `ENABLE_SUBSCRIPTION`, `STRIPE_ENABLED`, `ENABLE_SMART_DIRECTOR` (v2), `ENABLE_SMART_DIRECTOR_V2` (v3), `ENABLE_SMART_DIRECTOR_V3_{CEREBRAS,GROQ}_V3PROMPT` (shadow routers), `ENABLE_SEMANTIC_ANTI_REPEAT`. All off by default. (The earlier v2-prompt shadow flags `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` and `ENABLE_SMART_DIRECTOR_V3_GROQ` were retired 2026-04-22 along with their deprecated modules.)

**Subscription (SET-25/26/27):** `SUBSCRIPTION_DB_PATH` (Phase 2 SQLite file), `SUBSCRIPTION_DB_KEY` (optional SQLCipher), `SUBSCRIPTION_KEYS_WHITELIST` (Phase 1 fallback). `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_URL`. `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `DISABLE_EMAIL_SEND`. Full env-surface: [`../.env.example`](../.env.example).

## SSE event protocol

Authoritative table: [`../docs/CONTEXT.md`](../docs/CONTEXT.md) → "SSE Event Protocol". Current events include `persona`, `persona_done`, `personas_complete`, `director_decision`, `transcript`, `status`, `error`, plus every pipeline event that starts with `search_*`.

## Subscription routes — defense-in-depth invariants

1. **Webhook signature verification runs FIRST.** No branch past `verifyStripeSignature` executes without a valid header. Reject is 400.
2. **US-only at four layers:** extension `confirm()` → checkout HTTP 451 → Stripe `shipping_address_collection.allowed_countries: ['US']` → webhook `customer_details.address.country !== "US"` → refund + cancel + no key.
3. **Idempotency via `stripe_sub_id`.** If a row already exists for the incoming subscription ID, look it up, re-send the welcome email, don't mint a new key. Stripe retries on 5xx.
4. **Persist BEFORE email.** If the welcome email fails, the key is still in the DB and recoverable via `/api/subscription/manage` → `recover_key`.
5. **Emails are redacted in logs** via `emailForLog()` from [`../lib/http-validation.ts`](../lib/http-validation.ts). Don't push raw `email` strings into `logPipeline.data`.
