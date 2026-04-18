# `lib/` — Server-side core

Everything the Next.js API routes import. Parent: [`../INDEX.md`](../INDEX.md). Architecture: [`../docs/CONTEXT.md`](../docs/CONTEXT.md).

## Files

| File | Purpose |
|---|---|
| [`director.ts`](director.ts) | Rule-based cascade director. Scores the transcript, picks a lead persona, cascades to others with decreasing probability and staggered delays. Owns `director_decision` log line. **v1.5 target for Smart Director v2 — LLM-assisted routing under a 400ms budget with fallback to the existing rules.** |
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
