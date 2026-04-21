# Session notes — 2026-04-20, Director v3 deep build

**Prompt that kicked this off:** Seth came back from an external deep-research pass on the Director with a prioritization brief (the "Peanut Gallery Director: 2026 reference brief" that lives in this session's chat history). He asked to "go deep and test" on the Director, prioritizing our product's customer value over industry norms, and to file any independently-PR-able research spikes in Linear rather than doing them in-session.

**Shape of this session:** one feature branch, `director-v3-silent-slot-2026-04-20`, not merged yet. All code flag-gated behind `ENABLE_SMART_DIRECTOR_V2=true` so production behavior is byte-for-byte identical to pre-session unless Seth flips the flag. Full check green: 22/22 fixtures × 50 runs + 8/8 new unit tests.

---

## What landed on the branch

### 1. New module — `lib/director-llm-v2.ts`

Parallel implementation of the routing brain. Does NOT disturb the shipped `lib/director-llm.ts` (which the v1.5.0 canary still depends on).

Deltas from v2:

1. **SILENT as a first-class 5th slot.** Not a fallback. Positive few-shots in the prompt cover backchannel invites, disfluency tails, third-party-addressed moments, post-punchline beats. Rationale: Kadavath et al. 2022 ("replacing an option with None of the Above harms performance") + Feng et al. 2024 (up to 19.3% reliable-accuracy improvements from proper abstention design). The 2026-04 research brief flags false-positive firing as the dominant failure mode of LLM turn-takers (ICASSP 2026 HumDial).
2. **Strict JSON schema via Anthropic `tool_use`.** The `pick_next_speaker` tool's `input_schema` has `enum: [producer, troll, soundfx, joker, silent]` on personaId. The model cannot return an invalid slot. No free-text parsing, no "extract first JSON object" regex hack, no runtime adherence rate to worry about.
3. **Per-call random persona ordering.** The roster shuffles on every call; the cooldown readout also shuffles. Kills position bias (Wang et al. 2023 flipped 66/80 pairwise outcomes by swapping option order; Zhao et al. 2021 "Calibrate Before Use" dropped accuracy 88.5 → 51.3 by reordering two in-context examples).
4. **Verbalized confidence distribution.** Model returns a 5-vector `{producer, troll, soundfx, joker, silent}` that should sum to ~1. The Director / route applies an **external sticky-agent penalty** to that vector before argmax — the LLM is explicitly told NOT to penalize recent speakers itself, so the specialty signal stays honest and the recency penalty is deterministic + audit-able (Tian et al. 2023: verbalized beats token-logit confidence; ~50% ECE reduction).
5. **Live callback candidates.** The prompt optionally surfaces up to 3 notable phrases from the last ~5 minutes. The model is rewarded for picking a persona that can legitimately heighten one — the Del Close / UCB "Harold" payoff beat, and per the brief the primary differentiator vs. Neuro-sama-class single-persona reactors.

Telemetry:

- `llm_director_v2_pick` (info)
- `llm_director_v2_no_tool_use`, `llm_director_v2_invalid_shape` (warn)
- `llm_director_v2_timeout` (debug — expected on the fallback path)
- `llm_director_v2_error` (warn)

### 2. Director extensions — `lib/director.ts`

- `DecideOptions.llmPickV2`: v3 pick shape with `"silent"` as a valid slot + optional `callbackUsed`.
- `TriggerDecision.source`: added `"silent-llm"` variant.
- `decide()` short-circuit: when the v3 pick is `"silent"`, returns an empty chain with `source = "silent-llm"`, advances every persona's dry-spell counter, does NOT touch `lastFiredAt`. The cascade loop in `/api/transcribe` iterates over `decision.personaIds` so an empty chain naturally skips firing — no downstream changes needed.
- A non-silent v3 pick converts to the v2 shape so the existing hoist logic applies unchanged.
- `addLiveCallback(phrase)` + `getLiveCallbacks()`: ring buffer capped at 8, dedupes, oldest-drops-off. Not yet wired into the persona engine (next session).

### 3. Route wiring — `app/api/transcribe/route.ts`

- New flag `ENABLE_SMART_DIRECTOR_V2` (separate from existing `ENABLE_SMART_DIRECTOR`). v3 wins if both are set.
- Calls `pickPersonaLLMv2` with the same 400 ms budget.
- Applies `applyStickyPenalty(confidence, recentFirings)` BEFORE argmax — the v3 prompt explicitly told the model not to penalize recent speakers, so we handle it here deterministically.
- Emits `director_v3_compare` (parallel to `director_v2_compare`) with the confidence vector, callbackUsed, and a `silentPicked` boolean.

### 4. Fixture harness + unit tests

- `scripts/test-director.ts` gained `llmPickV2` + `liveCallbacks` fixture inputs, `chainEmpty` + `cascadeLenMax` assertions, and a `silent-llm` source value. The `returnShapeComplete` strict check relaxes for `silent-llm` decisions (empty top3 is legit).
- `scripts/test-director-llm-v2.ts`: pure-logic unit tests for `applyStickyPenalty`. 8 cases. Caught an inverted penalty formula on first run — the bug would have penalized OLDER firings harder than recent ones. Fixed.
- 5 new fixtures (all v1.7, all under `scripts/fixtures/director/v3-*.json`):
  - `v3-silent-backchannel-invite` — tag-question tail → SILENT
  - `v3-silent-disfluency-tail` — mid-restart → SILENT
  - `v3-silent-third-party-addressed` — "Molly, what do you think?" → SILENT
  - `v3-sticky-agent-seed` — recentFirings=[troll, troll], v3 picks joker, asserts hoist
  - `v3-callback-memory-seed` — ring buffer seeded, v3 picks soundfx with callbackUsed
- `npm run check` extended to also run the v2 unit tests.

### 5. What's NOT in this branch

Deliberately. Each of these is a standalone PR, tracked in Linear:

- Provider swap (Haiku → Groq Llama 3.1 8B) — [SET-6](https://linear.app/seth-dev/issue/SET-6).
- Streaming-transcript stability heuristic — [SET-7](https://linear.app/seth-dev/issue/SET-7).
- Semantic anti-repetition (sentence-embedding cosine) — [SET-8](https://linear.app/seth-dev/issue/SET-8).
- Distilled 1.5B classifier primary path (E4) — [SET-9](https://linear.app/seth-dev/issue/SET-9), Backlog, gated on real shadow data.
- Prompt-cache padding if we keep Haiku — [SET-10](https://linear.app/seth-dev/issue/SET-10), Backlog, contingent on SET-6 results.

---

## Flag posture

- `ENABLE_SMART_DIRECTOR` (v2, shipped): unchanged. Still off by default on hosted.
- `ENABLE_SMART_DIRECTOR_V2` (v3, new this session): **off by default**. No behavior change to hosted or self-host installs that don't opt in. To flip it on in a canary, set the env var + ensure an Anthropic key is available; production traffic will then race v3 against the 400 ms budget and fall back to the rule-based scorer on timeout.

Rollback is a single env-var flip — same contract as v2.

---

## Open questions for Seth

1. **Do we want v3 to race v2 (both callers in parallel, faster one wins) or is a simple "v3 if flag set, else v2" cascade enough?** Current implementation is the simpler cascade. Racing both costs 2× Haiku per tick but would give us live v2-vs-v3 shadow data without needing separate canary runs. Leaning cascade (current), but flagging.
2. **Should `addLiveCallback` be called automatically by the persona engine on every persona response?** Right now nothing calls it — the ring buffer is wired but empty in production. A naive approach: push the last 80 chars of every persona response into the buffer. A smarter approach: extract notable phrases (proper nouns + metaphors + punchlines) first. The current PR keeps it manual-only so the next session can decide.
3. **v1.7 vs v1.5.x.** Per `ROADMAP.md`, v1.7 "Smart Director GA" is the next major, and it retires the rule-based scorer entirely. This session's work is closer to a v1.5.x point-release scoped to "add SILENT + tool_use + callback plumbing behind a flag, no default change." Naming is Seth's call.

---

## Checklist before cutting a PR

- [x] `npm run check` green on the branch (22/22 fixtures × 50 runs + 8/8 unit tests).
- [x] No changes to shipped files' default behavior — every new path is flag-gated.
- [ ] SESSION-NOTES signed off by Seth before opening the PR (standing practice this repo).
- [ ] Follow the branching model in `docs/RELEASE.md` — this branch is a feature branch off `develop`, and the PR target is `develop`.

---

## Next-session read order

1. [`CLAUDE.md`](../CLAUDE.md) — git-lock protocol (unchanged).
2. `~/.claude/.../MEMORY.md` — feedback memories.
3. This file.
4. [`docs/V1.5-PLAN.md`](V1.5-PLAN.md) — still relevant as the v2 canary reference.
5. Linear SET-6 / SET-7 / SET-8 — pick one and ship.
