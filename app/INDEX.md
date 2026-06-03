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

## Key env vars

**Required for transcription pipeline:** `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`.

**Fact-check search:** `XAI_API_KEY` powers xAI Live Search. (`BRAVE_SEARCH_API_KEY` was retired in v2.0.1.)

**Gating flags:** `ENABLE_FREE_TIER_LIMIT`, `ENABLE_SUBSCRIPTION`, `ENABLE_SMART_DIRECTOR` (v2), `ENABLE_SMART_DIRECTOR_V2` (v3), `ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT` (shadow router), `ENABLE_SEMANTIC_ANTI_REPEAT`. All off by default. (Retired: `STRIPE_ENABLED` and the Stripe / Resend env surface, 2026-06-03; the Groq shadow flag + `groq-sdk` dep, same date; the v2-prompt shadow flags `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` and `ENABLE_SMART_DIRECTOR_V3_GROQ`, 2026-04-22.)

**Subscription (SET-25):** `SUBSCRIPTION_DB_PATH` (Phase 2 SQLite file), `SUBSCRIPTION_DB_KEY` (optional SQLCipher), `SUBSCRIPTION_KEYS_WHITELIST` (Phase 1 fallback). Full env-surface: [`../.env.example`](../.env.example).

## SSE event protocol

Authoritative table: [`../docs/CONTEXT.md`](../docs/CONTEXT.md) → "SSE Event Protocol". Current events include `persona`, `persona_done`, `personas_complete`, `director_decision`, `transcript`, `status`, `error`, plus every pipeline event that starts with `search_*`.

## Subscription endpoint — invariants

The Stripe / Resend integration was retired on 2026-06-03 (see CHANGELOG); the
`status` endpoint is the only remaining subscription route. License keys are
issued out-of-band via `scripts/subscription-issue.ts`.

1. **Email redaction in logs** still applies — use `emailForLog()` from
   [`../lib/http-validation.ts`](../lib/http-validation.ts) for any field that
   may contain a subscriber email; don't push raw strings into
   `logPipeline.data`.
