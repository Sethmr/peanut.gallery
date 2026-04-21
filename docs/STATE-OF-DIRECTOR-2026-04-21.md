# State of the Director — 2026-04-21

Post-merge audit after the Opus catch-up session. One source of truth for where the Director is today, what's merged, what's pending, and what gates the next move.

> For the wider product state (UI, packs, backend, roadmap), see [`STATE-OF-PRODUCT-2026-04-18.md`](STATE-OF-PRODUCT-2026-04-18.md). This doc is narrow to the Director.

---

## TL;DR

- **Smart Director v3** (5-slot with SILENT, Anthropic tool_use, verbalized confidence, sticky penalty, live-callback ring buffer) landed on `develop`.
- **Two shadow providers** wired: Cerebras (working today) + Groq (dormant until Developer tier reopens — tracked in SET-11).
- **Prompt-cache padding** on the v2 Haiku router is live. v3 doesn't yet benefit — follow-up.
- **All flag-gated off by default.** Hosted + self-host behavior is byte-for-byte unchanged until someone flips `ENABLE_SMART_DIRECTOR_V2` or a shadow flag.
- **Zero production telemetry exists yet.** No v2 canary has run. No v3 canary has run. No shadow provider has seen a live request. Every next decision gates on telemetry we haven't collected.

---

## What's on `develop` right now

### Modules

| File | Purpose | Status |
|---|---|---|
| [`lib/director.ts`](../lib/director.ts) | Rule-based scorer + cascade + recency + dry-spell. SILENT short-circuit added. Live-callback ring buffer added. | Shipping (safety net). |
| [`lib/director-llm.ts`](../lib/director-llm.ts) | Smart Director **v2**. Claude Haiku, 4 slots, free-text JSON parse. Prompt-cache padding (SET-10) lands the stable prefix past 2 048 tokens for ~85 % TTFT / ~90 % cost reduction on warm cache. | Shipped behind `ENABLE_SMART_DIRECTOR`. |
| [`lib/director-llm-v2.ts`](../lib/director-llm-v2.ts) | Smart Director **v3**. Haiku, 5 slots incl. SILENT, `tool_use` strict enum, verbalized confidence vector, randomized persona order, live-callback prompt hook, `applyStickyPenalty` helper. | Shipped behind `ENABLE_SMART_DIRECTOR_V2`. |
| [`lib/director-llm-v3-groq.ts`](../lib/director-llm-v3-groq.ts) | Shadow call against Groq Llama 3.1 8B (`llama-3.1-8b-instant`). Uses v2 prompt. | Shipped behind `ENABLE_SMART_DIRECTOR_V3_GROQ`. Dormant: Groq Developer tier unavailable. |
| [`lib/director-llm-v3-cerebras.ts`](../lib/director-llm-v3-cerebras.ts) | Shadow call against Cerebras Llama 3.1 8B (`llama3.1-8b`). Uses v2 prompt. | Shipped behind `ENABLE_SMART_DIRECTOR_V3_CEREBRAS`. Working today. |

### Flags

| Flag | Default | Effect |
|---|---|---|
| `ENABLE_SMART_DIRECTOR` | off | v2 Haiku race against 400 ms. Cached prefix active when on. |
| `ENABLE_SMART_DIRECTOR_V2` | off | v3 Haiku via tool_use. Supersedes v2 path when both flags set. |
| `ENABLE_SMART_DIRECTOR_V3_GROQ` | off | Fire-and-forget Groq shadow. Logs `director_v3_shadow_compare`. |
| `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` | off | Fire-and-forget Cerebras shadow. Logs `director_v3_shadow_compare`. |

### Env vars

| Var | Required when | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `ENABLE_SMART_DIRECTOR` or `ENABLE_SMART_DIRECTOR_V2` is on | Haiku calls |
| `GROQ_API_KEY` | `ENABLE_SMART_DIRECTOR_V3_GROQ=true` | Shadow calls |
| `CEREBRAS_API_KEY` | `ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true` | Shadow calls |

Header equivalents: `X-Anthropic-Key`, `X-Groq-Key`, `X-Cerebras-Key`.

### Telemetry events

| Event | Fired by | Payload highlights |
|---|---|---|
| `director_decision` | Director (every tick) | pick, top3, cooldownsMs, source in `{rule, llm, silent-llm}`, chainIds |
| `director_v2_compare` | transcribe route (v2 tick) | rulePrimary, llmPrimary, agreed, overrode, llmElapsedMs |
| `director_v3_compare` | transcribe route (v3 tick) | v2-compare fields + confidence, callbackUsed, silentPicked |
| `director_v3_shadow_compare` | transcribe route (shadow tick) | haiku {version, pick, elapsedMs}, fast {provider, model, pick, elapsedMs}, agreed |
| `llm_director_pick` | v2 router | cacheCreationTokens, cacheReadTokens, elapsedMs |
| `llm_director_v2_pick` | v3 router | confidence vector, callbackUsed, rationale |
| `llm_director_v2_timeout` | v3 router | elapsedMs, error |
| `llm_director_v3_pick` | shadow providers | provider, model, elapsedMs |

### Test coverage

- 22 fixtures × 50 runs each — all green.
- 8 unit tests on `applyStickyPenalty` — caught one inverted-penalty bug during development.
- `npm run check` = typecheck + extension syntax + 22 fixtures + 8 unit tests.

---

## Recent PR lineage

| PR | Title | Merged | Notes |
|---|---|---|---|
| [#65](https://github.com/Sethmr/peanut.gallery/pull/65) | feat(director): Groq shadow router (SET-6) | 2026-04-21 | Sonnet-authored. Landed Groq module; clone of v2 prompt. |
| [#67](https://github.com/Sethmr/peanut.gallery/pull/67) | feat(director): prompt-cache padding (SET-10) | 2026-04-21 | Sonnet/Opus daemon. Lands CACHED_ROUTING_STABLE_PREFIX + `cache_control: ephemeral`. |
| [#68](https://github.com/Sethmr/peanut.gallery/pull/68) | feat(director): v3 routing brain + Cerebras shadow | 2026-04-21 | Opus session (this doc's author). Lands SILENT slot, tool_use, confidence, sticky penalty, live-callback ring, Cerebras shadow. |
| [#61](https://github.com/Sethmr/peanut.gallery/pull/61) | claude: SET-8 semantic anti-repetition | **HELD OPEN** | Sonnet-authored. In-band re-roll regresses streaming UX by up to 8 s. Redo tracked in [SET-15](https://linear.app/seth-dev/issue/SET-15). See [`docs/reviews/SET-8-opus-review-2026-04-21.md`](reviews/SET-8-opus-review-2026-04-21.md). |

---

## What's NOT finished

The Director is fully implemented in code. What it's missing is **live data** — nothing has actually run in production.

Ordered by what blocks what:

1. **Live-callback ring buffer is empty in production.** Nothing calls `Director.addLiveCallback`. v3's callback-aware routing has no data to work with. Tracked in [SET-12](https://linear.app/seth-dev/issue/SET-12).
2. **Shadow providers use v2 prompt, not v3.** So shadow comparisons currently answer "is Llama 8B as good as Haiku on v2?" — not the question we care about. Tracked in [SET-13](https://linear.app/seth-dev/issue/SET-13).
3. **v3 canary unrun.** `ENABLE_SMART_DIRECTOR_V2` is off on hosted. Zero `director_v3_compare` events. We don't yet know: agreement rate, silent-rate, override-rate, p95 `llmElapsedMs`. Tracked in [SET-14](https://linear.app/seth-dev/issue/SET-14).
4. **SET-8 (semantic anti-repetition) in wrong shape.** PR #61's in-band re-roll regresses streaming UX. Redesign in SET-15 uses across-turn context injection instead. Tracked in [SET-15](https://linear.app/seth-dev/issue/SET-15).
5. **Prompt-cache hit rate unvalidated.** SET-10 shipped but no production telemetry on `cacheReadTokens`. Tracked in [SET-16](https://linear.app/seth-dev/issue/SET-16).
6. **τ threshold (0.82) unvalidated on real transcripts.** Tracked in [SET-17](https://linear.app/seth-dev/issue/SET-17). Depends on SET-15.
7. **Rule-based scorer not retired yet.** v1.7 Smart Director GA is still blocked on all of the above. Tracked in [SET-18](https://linear.app/seth-dev/issue/SET-18).

---

## Dependency graph

```
                      SET-12 (callback auto-populate)
                            │
                            ▼
SET-13 (v3 prompt on shadows)
                            │
                            ▼
                      SET-14 (v3 canary — 48h hosted)
                            │
                            ▼
                      SET-16 (cache hit-rate validation)
                            │
                            ▼
                      SET-18 (Smart Director GA, retire rule-based)

SET-15 (SET-8 redo Option B) ───► SET-17 (τ calibration) ──► defaults on
```

Parallel tracks:
- SET-11 — eventual Groq migration. Blocked on Groq Developer tier reopening.
- SET-7, SET-9 — in Linear "In Progress" (Sonnet daemon kickoffs). Seth reset them for Opus re-run; status-pending.

---

## Cost table (2-hour episode, under v3)

| Scenario | Director cost | Total session | Delta vs. today (rule-based only) |
|---|---|---|---|
| Rule-based only (today's default) | $0.00 | ~$1.15 | baseline |
| v2 Haiku uncached | ~$0.18 | ~$1.33 | +16 % |
| v2 Haiku **cached** (SET-10 on) | ~$0.03 | ~$1.18 | +3 % |
| v3 Haiku cached (SET-10 on, SET-14 on — TBD) | ~$0.05 | ~$1.20 | +4 % |
| v3 Cerebras (after SET-13) | ~$0.01 | ~$0.99 | **−14 %** |
| v3 Groq (after SET-11 + SET-13) | ~$0.006 | ~$0.99 | ~same as Cerebras |

v3 on cached Haiku is slightly more expensive than v2 cached (richer prompt → more tokens through the cache-write path). v3 on Cerebras beats all Anthropic paths.

---

## Open design questions (parked)

From the earlier `docs/SESSION-NOTES-2026-04-20-director-v3-deep-build.md`:

1. **v3 races v2?** Currently cascades (v3 if flag set, else v2). Racing both would give live v2-vs-v3 shadow data but costs 2× Haiku per tick. Current call: stay cascaded until there's a reason to race.
2. **Live-callback buffer auto-populate — naive vs. curated?** SET-12 ships naive (last 80–120 chars of every persona response). Curated extractor (proper nouns + notable phrases) is a follow-up if naive quality is noisy.
3. **v1.7 vs. v1.5.x naming?** v3 is closer to a v1.5.x point-release (additive, flag-gated) than the v1.7 "Smart Director GA" retirement of rule-based routing. Naming is Seth's call. SET-18 is the hard v1.7 anchor.

---

## Rollback levers (in order of locality)

1. **Per-flag env toggle.** Set any `ENABLE_SMART_DIRECTOR_*=false` and redeploy. Instant revert to prior behavior on next tick.
2. **Per-session key absence.** A session that doesn't carry an Anthropic / Cerebras / Groq key silently skips that path.
3. **Codepath revert.** Every v3 module is additive (new files or new functions). Reverting = comment out the branch in `app/api/transcribe/route.ts`. No schema migration, no stateful carryover.

---

## Standing invariants (do not break)

- `personasFiring` lock + `AbortSignal.timeout(25_000)` on every persona LLM stream + per-engine search timeouts. The v3 race runs BEFORE `director.decide` — it never touches the firing lock.
- `resolvePack(id)` still never throws.
- Force-react remains deterministic and skips all router / shadow paths.
- All shadow calls are fire-and-forget. They can never block the cascade.
- `Director.decide` returns a non-null `TriggerDecision` on every call path, even when the LLM picks SILENT.
