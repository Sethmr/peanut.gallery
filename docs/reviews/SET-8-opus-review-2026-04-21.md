# Opus review — SET-8 (PR #61, Sonnet-authored)

**Purpose.** Seth asked Opus to audit Sonnet's SET-8 implementation and suggest improvements for the Opus re-run. This is advisory — paste to PR #61 if useful, or feed directly to the next Opus kickoff of SET-8 as context.

**Files reviewed** (from the `claude/set-8-semantic-anti-repetition-on-persona-outputs-senten` worktree):
- `lib/semantic-cache.ts` (new, 134 lines)
- `lib/persona-engine.ts` (+353 lines)
- `app/api/personas/route.ts` (+1)
- `app/api/transcribe/route.ts` (+3)
- `scripts/test-personas.ts` (+68)

---

## The good

- `lib/semantic-cache.ts` is a clean single-responsibility module. OpenAI embed via raw fetch (no new SDK dep) is the right pattern — matches how xAI is called elsewhere in the repo.
- Threshold 0.82, ring size 5, `text-embedding-3-small` — all match the ticket spec.
- Fail-open posture on embed errors (`semantic_embed_error` → emit anyway) is correct.
- Telemetry names (`persona_reroll_ok` / `persona_reroll_exhausted` / `semantic_embed_error`) are useful for canary triage.

---

## The one blocker — streaming UX regression

The buffered path (`_firePersonaBuffered`) collects the *entire* LLM draft before emitting anything to the SSE client. Latency impact:

- **Happy path:** user waits 2–4 s of dead air + ~50–100 ms embed round-trip before tokens appear.
- **Re-roll path:** up to **8 s of silence** before any visible text. The reactor reads as frozen.

The current streaming UX (tokens stream into the persona bubble as generated) is the reason Peanut Gallery feels alive vs. Neuro-sama-class single-persona reactors. Losing it to fix paraphrase-repeat is a bad trade — the repeat is an occasional annoyance; a silent reactor is a broken product.

### Suggested fix

Stream normally (unchanged). At end-of-stream, embed the completed text. If `maxSim > τ`, log `persona_reroll_flagged` but **do not re-roll in-band**. Three options in priority order:

1. **Option A (cleanest — not recommended):** suppress the response entirely and let the Director's next tick fire someone else. UX sees a momentary bubble-then-gone. Feels broken.
2. **Option B (recommended):** ship the mitigation out-of-band. Store the flagged draft and on the *next* fire for that persona, inject the "don't repeat yourself — here's what you just said" instruction into the context. No re-roll latency; aligns with how the failure mode actually manifests ("the Troll keeps making the same joke five different ways" is an across-turns problem, not a within-turn one). Can feed into the live-callback ring-buffer infrastructure that landed in the Opus v3 Director PR.
3. **Option C (complex):** begin streaming response A while firing response B in parallel. At end-of-stream compare A's embedding to ring; if similar, cancel A's closing frame and send B's closing frame with a replacement token. Much more complex — probably not worth it.

My vote: **Option B.**

---

## Other concerns (non-blocking but worth addressing)

### 1. Force-react should skip the semantic path entirely
Force-react (🔥 tap on an avatar) is the "I want a fast reaction" path — Baba's Producer fact-check already skips pre-stream search for exactly this reason. Adding embed + possible re-roll to force-react doubles the slow tail. Skip semantic check when `isForceReact === true`.

### 2. Re-roll cost is material
At 0.82 threshold, expect 10–20% of fires to re-roll. That's ~$0.05–0.10/episode extra on top of the embeddings. Worth noting in `docs/CONTEXT.md` cost table and the SET-8 ticket rationale.

### 3. Duplicated LLM-streaming logic
`_streamLLMDeltas` and the inline loop in `firePersona` are ~90% identical. The comment acknowledges this ("two paths stay independently auditable") but duplicated logic drifts. Better: make `_streamLLMDeltas` the single source and have the streaming path use it.

### 4. Re-roll-also-similar branch emits the re-roll, not the original
If both drafts cross τ, we arbitrarily pick the newer one. Unclear why. If both were similar, the original was already known-similar; emitting the first draft (and logging both similarities) is more defensible.

### 5. Search-result cache on re-roll
Re-roll rebuilds context from scratch — including potentially re-running the fact-check search pipeline for Producer. That's a second 5–8 s spend. Cache the search results from the first draft's context so the re-roll reuses them. (Goes away entirely under Option B above.)

### 6. Ring K=5 may be short
The failure mode is "the Troll keeps making the same joke five different ways" — in a 2-hour session with the Troll firing 20+ times, K=5 means the 6th-ago fire escapes detection. K=10 is probably closer to the intent without meaningfully increasing compute.

### 7. τ=0.82 is unvalidated
Ticket explicitly said to validate on 20 real transcripts and tune. Worth doing before default-on.

### 8. No cosine-similarity unit test
`SemanticCache.cosineSimilarity` is the single point of failure for the whole feature. Five lines of `scripts/test-semantic-cache.ts` asserting known pairs would be cheap insurance.

---

## Net verdict

The schema and telemetry shape are right. The mechanism (buffered path + in-band re-roll) is wrong — it trades a streaming-UX regression for a mitigation of a less severe problem. Re-approaching with Option B above keeps everything that landed cleanly (cache module, threshold, embedding provider, telemetry names) and swaps the in-band re-roll for an across-turn self-correction that's cheaper, faster, and better-aligned with how the failure mode actually manifests.

## Suggested SET-8 ticket update

Add to the existing ticket body, under a new section:

> **Design update (2026-04-21, post-Sonnet run):** in-band re-rolling regresses the streaming UX — up to 8 s of silent dead air before any tokens appear. Ship the mitigation *across turns* instead: embed at end-of-stream as before, but on similarity-hit, store the flagged draft and inject a "don't repeat yourself — here's what you just said" instruction into the NEXT context for that persona. The live-callback ring-buffer infrastructure in the Opus v3 Director PR is the natural place to thread this through.
