# Session notes — 2026-04-21, Opus catch-up after Sonnet daemon runs

**Prompt that kicked this off:** Seth: "I ran all your issues and some finished, but they all ran with sonnet sadly. Several froze and I don't know why, so now I reset them all after switching to opus, but some already got merged in. Can you have Opus go over the work individually and see what it would have done better and make a pr to do the better work instead."

Follow-up: "After you finished everything you are working on, review all PRs and get them all merged together and then make plan of how to move forward. Then when you finish that get a list of all future work items and add them all to linear in a detailed manner that will be easy to understand. Then document everything about our current state. After you finished all the steps I have mentioned so far, review documentation and make sure its all indexed properly. you can tell me the plan after you finish all that though. Don't worry about crafting PRs for main at this point. We want a finished/tested director first."

**Shape of this session:** one PR authored + pushed + merged (#68), two pre-existing PRs reviewed, one merged (#67) + one held back (#61 — UX regression, redesign filed as SET-15), seven Linear tickets filed to structure the remaining work, two docs added.

---

## What happened in sequence

### 1. Audited Sonnet's merged work

**PR #65 — SET-6 Groq shadow router.** Sonnet landed `lib/director-llm-v3-groq.ts` cleanly. Implementation is correct, but two gaps: (a) shipped Groq even though the ticket was retitled to "Cerebras primary; Groq future" before kickoff — Groq Developer tier is currently unavailable, so the shadow path is dead code until SET-11; (b) cloned v2's 4-slot prompt because v3 hadn't merged to develop yet, so the shadow measures "is Groq as good as Haiku on v2?" instead of the useful question.

Full review at [`docs/reviews/SET-6-opus-review-2026-04-21.md`](reviews/SET-6-opus-review-2026-04-21.md).

**PR #67 — SET-10 prompt-cache padding.** Pads the Haiku routing system prompt past the 2 048-token minimum, marks it `cache_control: { type: "ephemeral" }`, and logs `cacheCreationTokens` / `cacheReadTokens` on every `llm_director_pick` event. Clean work, correct shape. Merged.

**PR #61 — SET-8 semantic anti-repetition.** Still open. The in-band re-roll path (`_firePersonaBuffered` in `lib/persona-engine.ts`) buffers the entire LLM response before emitting any tokens, so a re-roll means up to 8 s of silent dead air before the side panel sees anything. That breaks the streaming-UX property that's Peanut Gallery's moat vs. Neuro-sama-class reactors. Recommended redesign: stream normally, embed at end-of-stream, on similarity-hit inject a "don't repeat yourself" instruction into the *next* context for that persona instead of re-rolling in-band. Filed as SET-15. PR #61 left open for Seth to close or rework. Full review at [`docs/reviews/SET-8-opus-review-2026-04-21.md`](reviews/SET-8-opus-review-2026-04-21.md).

### 2. Opened + merged #68 — Opus follow-up to #65

Branch: `director-v3-opus-improvements-2026-04-21`. PR: [#68](https://github.com/Sethmr/peanut.gallery/pull/68).

Additive — no reverts. Two big moves:

1. **Cerebras shadow provider** (`lib/director-llm-v3-cerebras.ts`) — raw fetch against Cerebras's OpenAI-compatible endpoint. Same Llama 3.1 8B weights as Groq so the eventual Groq migration (SET-11) is a 1-env-flip swap. Independently flag-gated (`ENABLE_SMART_DIRECTOR_V3_CEREBRAS`) so Cerebras and Groq can run head-to-head when both are available.
2. **v3 Director** cherry-picked from `director-v3-silent-slot-2026-04-20`:
   - `lib/director-llm-v2.ts` — new module. Anthropic `tool_use` with `input_schema.enum`, 5-slot enum including SILENT, verbalized confidence vector, per-call persona-order randomization, live-callback prompt hook.
   - `lib/director.ts` extensions — `DecideOptions.llmPickV2`, `TriggerDecision.source="silent-llm"`, SILENT short-circuit (empty chain), live-callback ring buffer (`addLiveCallback`, `getLiveCallbacks`, capped at 8).
   - `app/api/transcribe/route.ts` — v3 race path behind `ENABLE_SMART_DIRECTOR_V2`; `applyStickyPenalty` runs BEFORE argmax to keep recency penalty deterministic and audit-able; `director_v3_compare` event.
   - 5 new fixtures under `scripts/fixtures/director/v3-*.json` covering SILENT (backchannel / disfluency / third-party-addressed), sticky-agent hoist, callback-aware routing.
   - 8 unit tests on `applyStickyPenalty` (caught an inverted-penalty formula on first run).
   - Shadow-compare event restructured: `{ haiku {version: "v2"|"v3", ...}, fast {provider, model, ...}, agreed }`. Each shadow provider emits its own event.

Rebased cleanly after #67 merged. Verification: 22/22 fixtures × 50 runs + 8/8 unit tests + typecheck clean.

### 3. Filed forward-plan Linear tickets

Seven new tickets (4 Todo, 3 Backlog):

| ID | State | Title | Blocks |
|---|---|---|---|
| [SET-12](https://linear.app/seth-dev/issue/SET-12) | Todo | Auto-populate Director live-callback ring buffer from persona responses | SET-14 |
| [SET-13](https://linear.app/seth-dev/issue/SET-13) | Todo | Port v3 prompt (SILENT + tool_use + confidence) to Cerebras/Groq shadows | SET-14 shadow validity |
| [SET-14](https://linear.app/seth-dev/issue/SET-14) | Todo | Smart Director v3 canary on hosted — 48h of `director_v3_compare` telemetry | SET-16, SET-18 |
| [SET-15](https://linear.app/seth-dev/issue/SET-15) | Todo | Redo semantic anti-repetition with across-turn mitigation (supersedes #61) | SET-17 |
| [SET-16](https://linear.app/seth-dev/issue/SET-16) | Backlog | Validate SET-10 prompt-cache gains: ≥ 80 % hit, p95 TTFT ≤ 250 ms | SET-18 |
| [SET-17](https://linear.app/seth-dev/issue/SET-17) | Backlog | Calibrate τ on 20 real session transcripts | SET-15 default-on |
| [SET-18](https://linear.app/seth-dev/issue/SET-18) | Backlog | Smart Director GA (v1.7) — retire rule-based scorer | all of the above |

Existing "In Progress" tickets from Seth's Sonnet daemon run (SET-7 streaming-transcript stability, SET-9 distilled classifier, SET-11 Groq migration): untouched. Seth reset them for Opus re-run.

### 4. Documentation

- **New:** [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) — the one source of truth for where the Director is today. Modules, flags, env vars, telemetry, test coverage, PR lineage, dependency graph, cost table, rollback levers, invariants.
- **New:** [`reviews/SET-6-opus-review-2026-04-21.md`](reviews/SET-6-opus-review-2026-04-21.md) — before-reading for PR #68 ("what Sonnet did on #65 + what we changed").
- **New:** [`reviews/SET-8-opus-review-2026-04-21.md`](reviews/SET-8-opus-review-2026-04-21.md) — advisory review for the still-open PR #61. Not posted to GitHub; Seth's to paste or hand off.
- **This file:** session handoff.

### 5. Tree state

- `develop` tip: PR #68 (9846268) on top of PR #67 (75168d3). Both merged cleanly.
- No open PRs authored this session. PR #61 remains open as a Sonnet artifact.
- `main` untouched — no release PR drafted. Per Seth's explicit ask, "we want a finished/tested director first."

---

## What's NOT done — explicit hand-off list

1. **No production telemetry has been collected yet.** All of v2, v3, both shadow providers, and prompt-cache padding are shipped flag-off. Zero ticks of canary data exists.
2. **Live-callback ring buffer is empty in production.** v3's callback-aware routing plumbing works but `addLiveCallback` is never called. SET-12 addresses.
3. **Shadows use v2 prompt, not v3.** Makes shadow agreement data less useful than it could be. SET-13 addresses.
4. **SET-8 / PR #61 left open.** Seth to decide whether to close-with-note, rework onto SET-15 scope, or keep as-is.
5. **No `develop → main` release PR.** Per explicit instruction — "don't worry about crafting PRs for main at this point."

---

## Next-session read order

1. [`CLAUDE.md`](../CLAUDE.md) — git lock protocol (unchanged).
2. `~/.claude/.../MEMORY.md` — feedback memories (unchanged).
3. This file — handoff.
4. [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) — canonical Director state.
5. Linear: pick SET-12 (smallest unblock) or SET-14 (highest-value — the canary that gates everything else).
