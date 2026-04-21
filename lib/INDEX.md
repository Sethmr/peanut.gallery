# `lib/` — Server-side core

Everything the Next.js API routes import. Parent: [`../INDEX.md`](../INDEX.md). Architecture: [`../docs/CONTEXT.md`](../docs/CONTEXT.md).

## Files

| File | Purpose |
|---|---|
| [`director.ts`](director.ts) | Rule-based cascade director. Scores the transcript, picks a lead persona, cascades to others with decreasing probability and staggered delays. Owns `director_decision` log line. v1.5: `decide(…, opts?: { llmPick })` substitutes the primary when the Smart Director v2 race wins. v1.7 (2026-04-21): adds `llmPickV2` with SILENT short-circuit + `addLiveCallback` / `getLiveCallbacks` ring buffer. `TriggerDecision.source` is `"rule" \| "llm" \| "silent-llm"`. |
| [`director-llm.ts`](director-llm.ts) | Smart Director **v2** routing module. `pickPersonaLLM(ctx)` runs a short Claude Haiku completion, validates the returned archetype, resolves null on timeout / upstream error / malformed output. Never throws. Caller races against `AbortSignal.timeout(400)`. Gated by `ENABLE_SMART_DIRECTOR=true`. 2026-04-21: system prompt padded past the 2 048-token cache minimum with `cache_control: ephemeral` (SET-10). Also exports `ROUTING_SYSTEM_PROMPT`, `buildRoutingUserPrompt`, `extractFirstJsonObject`, `validatePick` for shadow-provider reuse. |
| [`director-llm-v2.ts`](director-llm-v2.ts) | Smart Director **v3** routing module (2026-04-21). Anthropic `tool_use` with `input_schema.enum` for hard-guarantee valid slots including SILENT. Output: `{personaId, confidence {producer, troll, soundfx, joker, silent}, rationale, callbackUsed}`. Per-call random persona ordering. `applyStickyPenalty` helper applies recency penalty BEFORE argmax externally. Accepts optional `liveCallbacks` context. Gated by `ENABLE_SMART_DIRECTOR_V2=true`. |
| [`director-llm-v3-groq.ts`](director-llm-v3-groq.ts) | Shadow call against Groq Llama 3.1 8B (`llama-3.1-8b-instant`) via `groq-sdk`. Fire-and-forget from the route; never feeds `director.decide`. Gated by `ENABLE_SMART_DIRECTOR_V3_GROQ=true`. Dormant until Groq Developer tier reopens — tracked in [SET-11](https://linear.app/seth-dev/issue/SET-11). |
| [`director-llm-v3-cerebras.ts`](director-llm-v3-cerebras.ts) | Shadow call against Cerebras Llama 3.1 8B (`llama3.1-8b`) via raw fetch to their OpenAI-compatible endpoint. Fire-and-forget; never feeds `director.decide`. Gated by `ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true`. Working path today; 1-env-flip migration back to Groq once SET-11 fires. |
| [`persona-engine.ts`](persona-engine.ts) | Fires personas via their configured LLM. Owns `firePersona`, `fireAll`, `fireSingle`, Anthropic streaming, `streamXai` SSE reader, `searchBrave`, `searchXai`, claim-extraction, `getForceReactFallback`. Handles per-stream `AbortSignal.timeout(25_000)` and per-engine search timeouts (5s Brave, 8s xAI). |
| [`personas.ts`](personas.ts) | Back-compat shim: re-exports `howardPersonas as personas` for v1.2-era call sites. Contains `buildPersonaContext` with the silence / force-react phrase gates. New code should import from [`packs/`](packs/INDEX.md) directly. |
| [`transcription.ts`](transcription.ts) | `TranscriptionManager` — Deepgram WebSocket client. Owns silence detection (18s threshold), timing constants, `setPaceMultiplier(mult)` for the response-rate dial. |
| [`debug-logger.ts`](debug-logger.ts) | `logPipeline` JSONL writer at `logs/pipeline-debug.jsonl`. Every downstream file logs through this. New v1.4 events: `search_skip`, `search_no_claims_detected`, `search_timeout`, `search_upstream_error`, `search_empty_result`, `search_complete`, `search_pipeline_error`, `force_react_fallback`. |
| [`free-tier-limiter.ts`](free-tier-limiter.ts) | In-memory per-install quota (15 min / 24h rolling window, env-overridable). Returns 402 `TRIAL_EXHAUSTED`. Inert until operator sets `ENABLE_FREE_TIER_LIMIT=true`. |

## Subdirectories

| Dir | Index |
|---|---|
| [`packs/`](packs/) | Pack abstraction + Howard + TWiST personas. | [`packs/INDEX.md`](packs/INDEX.md) |

## Load-bearing invariants (do not break)

- `personasFiring` in `/api/transcribe` must be released via `finally`. Paired with `AbortSignal.timeout(25_000)` on every stream — do not remove either layer.
- `director.ts` and `persona-engine.ts` are pack-agnostic. Packs are injected via constructor. Do not hard-code Howard persona ids inside the director.
- `resolvePack(id)` in [`packs/index.ts`](packs/index.ts) never throws. Unknown / missing / malformed ids always resolve to Howard.
- Force-react is deterministic: a tap commits the persona to speak. Silent-spin fallbacks live in `getForceReactFallback`. Model decides **how**, not **if**.
