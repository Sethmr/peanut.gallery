# `app/` — Next.js 15 App Router

Parent: [`../INDEX.md`](../INDEX.md). Running on Node 20 via Next.js 15.5.

## Pages (Server Components unless noted)

| File | Route | Purpose |
|---|---|---|
| [`layout.tsx`](layout.tsx) | — | Root layout. Global fonts, metadata defaults, `<body>` shell. |
| [`page.tsx`](page.tsx) | `/` | Landing page (long — the marketing + personas + stack sections). Version label at the top must match `extension/manifest.json`. |
| [`globals.css`](globals.css) | — | Global styles. Tokens + resets. |
| [`landing.css`](landing.css) | — | Landing-page-specific styles. |
| [`robots.ts`](robots.ts) | `/robots.txt` | Generated. |
| [`sitemap.ts`](sitemap.ts) | `/sitemap.xml` | Generated. |
| [`install/page.tsx`](install/page.tsx) | `/install` | Install / get-started page. Also hosts "Build Your Own Backend" callouts. |
| [`privacy/page.tsx`](privacy/page.tsx) | `/privacy` | Privacy policy. Required link from Chrome Web Store listing. |

Note: `/watch` (the legacy hosted reference web app) was retired alongside `components/PersonaColumn` + `components/CombinedFeed` + `components/YouTubePlayer` + `components/ApiKeysModal` + `components/TranscriptBar` as part of the v1.5 "clean out the legacy web-app UI" work. The extension is the canonical UI; the middleware at the Next.js app root 308-redirects non-`/api/*` traffic to `www.peanutgallery.live`.

## API routes

| File | Route | Purpose |
|---|---|---|
| [`api/health/route.ts`](api/health/route.ts) | `GET /api/health` | Liveness probe. No auth. |
| [`api/transcribe/route.ts`](api/transcribe/route.ts) | `POST /api/transcribe` (SSE) + `DELETE` | **The main session endpoint.** Owns the `personasFiring` lock, the director tick `setInterval`, and the SSE event stream. Threads `packId` + `rate` + keys through to `PersonaEngine` + `Director`. Try/finally around every firing branch is load-bearing — do not remove. |
| [`api/personas/route.ts`](api/personas/route.ts) | `POST /api/personas` (SSE) | Single-persona force-fire endpoint used by avatar taps. Routes through `PersonaEngine.fireSingle`. |

## Key env vars (v1.4)

Required: `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`.
Optional: `BRAVE_API_KEY` (only used when `SEARCH_ENGINE=brave`, which is the default).
Gate: `ENABLE_FREE_TIER_LIMIT=true` activates the rolling-24h limiter.

## SSE event protocol

Authoritative table: [`../docs/CONTEXT.md`](../docs/CONTEXT.md) → "SSE Event Protocol". Current v1.4 events include `persona`, `persona_done`, `personas_complete`, `director_decision`, `transcript`, `status`, `error`, plus every pipeline event that starts with `search_*`.
