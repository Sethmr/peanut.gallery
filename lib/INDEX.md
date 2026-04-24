# `lib/` — Server-side core

Everything the Next.js API routes import. Parent: [`../INDEX.md`](../INDEX.md). Architecture: [`../docs/CONTEXT.md`](../docs/CONTEXT.md).

## Files

| File | Purpose |
|---|---|
| [`director.ts`](director.ts) | Rule-based cascade director. Scores the transcript, picks a lead persona, cascades to others with decreasing probability and staggered delays. Owns `director_decision` log line. v1.5: `decide(…, opts?: { llmPick })` substitutes the primary when the Smart Director v2 race wins. v1.7 (2026-04-21): adds `llmPickV2` with SILENT short-circuit + `addLiveCallback` / `getLiveCallbacks` ring buffer. `TriggerDecision.source` is `"rule" \| "llm" \| "silent-llm"`. |
| [`director-llm.ts`](director-llm.ts) | Smart Director **v2** routing module. `pickPersonaLLM(ctx)` runs a short Claude Haiku completion, validates the returned archetype, resolves null on timeout / upstream error / malformed output. Never throws. Caller races against `AbortSignal.timeout(400)`. Gated by `ENABLE_SMART_DIRECTOR=true`. 2026-04-21: system prompt padded past the 2 048-token cache minimum with `cache_control: ephemeral` (SET-10). Also exports `ROUTING_SYSTEM_PROMPT`, `buildRoutingUserPrompt`, `extractFirstJsonObject`, `validatePick` for shadow-provider reuse. |
| [`director-llm-v2.ts`](director-llm-v2.ts) | Smart Director **v3** routing module (2026-04-21). Anthropic `tool_use` with `input_schema.enum` for hard-guarantee valid slots including SILENT. Output: `{personaId, confidence {producer, troll, soundfx, joker, silent}, rationale, callbackUsed}`. Per-call random persona ordering. `applyStickyPenalty` helper applies recency penalty BEFORE argmax externally. Accepts optional `liveCallbacks` context. Gated by `ENABLE_SMART_DIRECTOR_V2=true`. |
| [`director-llm-v3-cerebras-v3prompt.ts`](director-llm-v3-cerebras-v3prompt.ts) | Shadow call against Cerebras Llama 3.1 8B (`llama3.1-8b`) via raw fetch to their OpenAI-compatible endpoint. Uses the v3 prompt (5-slot + confidence) with `response_format: { type: "json_schema" }` for hard-enum enforcement on `personaId`. Fire-and-forget; never feeds `director.decide`. Gated by `ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT=true`. Working path today; 1-env-flip migration back to Groq once SET-11 fires. |
| [`director-llm-v3-groq-v3prompt.ts`](director-llm-v3-groq-v3prompt.ts) | Shadow call against Groq Llama 3.1 8B (`llama-3.1-8b-instant`) via `groq-sdk`. Same v3 prompt + `json_schema` structured output as the Cerebras module. Fire-and-forget; never feeds `director.decide`. Gated by `ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT=true`. Dormant until Groq Developer tier reopens — tracked in [SET-11](https://linear.app/seth-dev/issue/SET-11). |
| [`persona-engine.ts`](persona-engine.ts) | Fires personas via their configured LLM. Owns `firePersona`, `fireAll`, `fireSingle`, Anthropic streaming, `streamXai` SSE reader, `searchXai` (fact-check grounding — Brave Search deprecated in v2.0.1), claim-extraction, `getForceReactFallback`. Handles per-stream `AbortSignal.timeout(25_000)` and the 8s xAI search timeout. |
| [`personas.ts`](personas.ts) | Back-compat shim: re-exports `howardPersonas as personas` for v1.2-era call sites. Contains `buildPersonaContext` with the silence / force-react phrase gates. New code should import from [`packs/`](packs/INDEX.md) directly. |
| [`transcription.ts`](transcription.ts) | `TranscriptionManager` — Deepgram WebSocket client. Owns silence detection (18s threshold), timing constants, `setPaceMultiplier(mult)` for the response-rate dial. |
| [`debug-logger.ts`](debug-logger.ts) | `logPipeline` JSONL writer at `logs/pipeline-debug.jsonl`. Every downstream file logs through this. New v1.4 events: `search_skip`, `search_no_claims_detected`, `search_timeout`, `search_upstream_error`, `search_empty_result`, `search_complete`, `search_pipeline_error`, `force_react_fallback`. |
| [`free-tier-limiter.ts`](free-tier-limiter.ts) | In-memory per-install quota (15 min / 24h rolling window, env-overridable). Returns 402 `TRIAL_EXHAUSTED`. Inert until operator sets `ENABLE_FREE_TIER_LIMIT=true`. |
| [`subscription.ts`](subscription.ts) | Subscription public API (v2 — SET-25): `isSubscriptionEnabled`, `getSubscriptionStatus`, `recordSubscriptionUsage`, `subscriptionDeniedBody`, `findActiveKeyByEmail`, `findSubscriptionByEmail`, `revokeSubscription`. Delegates to the {@link subscription-store.SubscriptionStore} singleton; public API is stable across Phase 1 → Phase 2. Inert until `ENABLE_SUBSCRIPTION=true`. |
| [`subscription-store.ts`](subscription-store.ts) | SET-25 store abstraction. `SubscriptionStore` interface + `MemorySubscriptionStore` (Phase 1 env-whitelist) + `SqliteSubscriptionStore` (Phase 2 durable via `better-sqlite3`, optional SQLCipher). Factory picks between them on `SUBSCRIPTION_DB_PATH`. Exposes `createSubscription`, `reserveUniqueLicenseKey`, `getSubscriptionStoreKind`. Hot-reload-safe via `globalThis`. |
| [`subscription-keys.ts`](subscription-keys.ts) | SET-25 pure module: `generateLicenseKey()` → `pg-xxxx-xxxx-xxxx` (11 hex from `crypto.randomBytes` + mod-16 Luhn-style checksum), `isValidLicenseKey()`, `luhnHexChecksum()`. 44 bits of entropy; checksum catches single-char typos + adjacent-digit transpositions. |
| [`stripe-webhook.ts`](stripe-webhook.ts) | SET-26 Stripe webhook signature verifier. Manual HMAC-SHA256 over `${timestamp}.${rawBody}`, 5-min skew tolerance, `crypto.timingSafeEqual`, multi-`v1` signature support for key rotation. `signStripeBody()` exported for tests only. Zero `stripe` npm dep. |
| [`http-validation.ts`](http-validation.ts) | Shared HTTP util for the subscription + feedback routes. `isValidEmail(s)` + `emailForLog(s)` (redacts local part: `alice@x.com → al***@x.com`). Pure functions; import from any route handler. |
| [`email.ts`](email.ts) | Transactional email transport for Peanut Gallery Plus (Phase 4 / SET-27). Resend (default) + Postmark fallback over raw `fetch`, `EMAIL_API_KEY` / `EMAIL_FROM` / `EMAIL_REPLY_TO` / `EMAIL_PROVIDER` env-driven. Public API: `sendWelcomeEmail`, `sendRecoveryEmail`, `sendCancellationEmail`, `sendMagicLinkEmail`. Send failures log loud + return `{ok:false}` — never throw, never swallow the original operation. `DISABLE_EMAIL_SEND=true` is the self-host opt-out. |
| [`email-templates.ts`](email-templates.ts) | Pure functions returning `{subject, html, text}` for each Plus transactional email. HTML escapes all interpolated values; no remote assets (inline styles only — survives client-side image blocking + avoids tracking-pixel optics). |

## Subdirectories

| Dir | Index |
|---|---|
| [`packs/`](packs/) | Pack abstraction + Howard + TWiST personas. | [`packs/INDEX.md`](packs/INDEX.md) |

## Load-bearing invariants (do not break)

- `personasFiring` in `/api/transcribe` must be released via `finally`. Paired with `AbortSignal.timeout(25_000)` on every stream — do not remove either layer.
- `director.ts` and `persona-engine.ts` are pack-agnostic. Packs are injected via constructor. Do not hard-code Howard persona ids inside the director.
- `resolvePack(id)` in [`packs/index.ts`](packs/index.ts) never throws. Unknown / missing / malformed ids always resolve to Howard.
- Force-react is deterministic: a tap commits the persona to speak. Silent-spin fallbacks live in `getForceReactFallback`. Model decides **how**, not **if**.
