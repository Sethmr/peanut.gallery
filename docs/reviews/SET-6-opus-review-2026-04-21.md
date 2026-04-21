# Opus review — SET-6 (PR #65, Sonnet-authored, MERGED)

**Purpose.** Seth asked Opus to audit Sonnet's merged SET-6 implementation and open a follow-up PR with improvements. This doc is the before-reading; the follow-up PR (`director-v3-opus-improvements-2026-04-21` branch) is the after-action.

**Files reviewed** (from commit `d8e4ff3`):
- `lib/director-llm-v3-groq.ts` (new, 213 lines)
- `lib/director-llm.ts` (refactor: export shared prompt + validator)
- `app/api/transcribe/route.ts` (+71: Groq shadow wiring)
- `package.json` (+1: `groq-sdk` dep)

---

## The good

- Clean module shape. Reused shared `ROUTING_SYSTEM_PROMPT`, `buildRoutingUserPrompt`, `extractFirstJsonObject`, `validatePick` from `director-llm.ts` via export. Keeps one source of truth for the routing prompt.
- Used Groq's JSON-mode `response_format: { type: "json_object" }` — correct choice for strict-schema output.
- Fire-and-forget shadow promise with `.catch(() => null)` plus 2 s timeout. Correct not to await before routing.
- Commit message explains *why* (non-blocking parallel fire keeps routing latency identical to pre-SET-6).
- Telemetry event `director_v3_shadow_compare` has clean `v2 { … } / v3 { … } / agreed` shape.

---

## The blockers

### 1. Wrong provider — shipped Groq, not Cerebras

Seth retitled SET-6 during the planning conversation on 2026-04-20 *before* kickoff to **"Cerebras primary; Groq future"** because Groq's Developer tier is "temporarily unavailable due to high demand" and Free tier's ~6k TPM cap will 429 on real production traffic. The Sonnet daemon either fetched the original ticket body or ignored the update — result: **the shadow path is dead code until Groq reopens.**

Migration to Groq is tracked separately in Linear SET-11. The working fast-provider path today is Cerebras (same Llama 3.1 8B weights, paid self-serve available, 1-env-flip migration back to Groq later).

**The follow-up PR adds `lib/director-llm-v3-cerebras.ts`** alongside the existing Groq module. Both are independently flag-gated (`ENABLE_SMART_DIRECTOR_V3_CEREBRAS`, `ENABLE_SMART_DIRECTOR_V3_GROQ`) and can run concurrently for head-to-head comparison. Groq module is preserved unchanged so SET-11's eventual migration is zero-risk.

### 2. Shadow compares against v2, not v3

Ticket text (as it existed at kickoff) said `mirrors lib/director-llm-v2.ts's interface`. But `director-llm-v2.ts` didn't exist on `develop` at kickoff — my v3 work (SILENT slot, tool_use, confidence head, sticky penalty, live callbacks) was still on a branch. Sonnet cloned v2's shape (4-slot enum, free-text JSON, no confidence) because that's what was on develop.

Net effect: the shadow is testing "is Groq Llama 8B as good as Haiku on the 4-slot problem?" — not the interesting question. The interesting question is "is Cerebras/Groq Llama 8B as good as Haiku on the 5-slot + confidence + callback-aware routing?" Answering that requires v3 on develop first.

**The follow-up PR lands v3** and updates the shadow-compare handler to capture the active Haiku version (v2 or v3) based on which flag is on. Shadow still compares flat 4-slot picks — Cerebras/Groq's routing calls still use the v2 prompt — but the *Haiku side* of the comparison is now v3 when `ENABLE_SMART_DIRECTOR_V2=true`. Good enough for the first wave of agreement-rate data; upgrading Groq/Cerebras to the v3 prompt (with tool_use on their OpenAI-compatible endpoints) is a follow-up spike.

### 3. 2 s shadow timeout is too generous

Groq's stated p50 TTFT is 50–120 ms and p95 is ~400 ms. A 2 s timeout accepts any tail spike into the comparison, which pollutes the latency-agreement data. Better: match the routing budget (400 ms) and let the timeouts be part of the data — the whole point is "does this provider actually hit the 400 ms target?"

(Not blocking for v1 — the 2 s cap is safe, just too generous. Address in a follow-up tune once real data lands.)

### 4. Shadow-compare event is v2-shaped

`director_v3_shadow_compare { v2: { … }, v3: { … }, agreed }` hardcodes the Haiku side as "v2." With the v3 path now landing, the shadow event should say which Haiku version fired. The follow-up PR restructures this to `{ haiku: { version: "v2"|"v3", … }, fast: { provider, model, … }, agreed }`.

---

## What the follow-up PR does

Branch: `director-v3-opus-improvements-2026-04-21`. Builds cleanly on top of the merged SET-6 work (no reverts).

1. **Restores v3 Director** from the `director-v3-silent-slot-2026-04-20` branch that never got merged:
   - `lib/director-llm-v2.ts` (tool_use + SILENT slot + confidence head + randomized order + live-callback prompt hook)
   - `lib/director.ts` extensions (SILENT short-circuit, live-callback ring buffer, `source="silent-llm"`)
   - 5 new fixtures covering the SILENT / sticky-agent / callback-aware paths
   - 8 unit tests for `applyStickyPenalty`
2. **Adds Cerebras** as a second shadow provider (`lib/director-llm-v3-cerebras.ts`, `X-Cerebras-Key` header, `CEREBRAS_API_KEY` env, `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` flag).
3. **Preserves Groq** — the Sonnet module stays unchanged. Groq's path re-lights the moment Developer tier is available.
4. **Upgrades the shadow-compare event shape** to `haiku { version } / fast { provider, model }` so the log schema handles v2/v3 + Groq/Cerebras cleanly.
5. **All green:** 22/22 fixtures × 50 runs + 8/8 unit tests + clean typecheck.

## Non-goals for the follow-up PR

- Retrofitting Cerebras/Groq to the v3 prompt (tool_use on OpenAI-compatible endpoints). Scoped as a separate spike.
- Tuning the 2 s shadow timeout. Waiting on real data.
- Disabling the Groq path by default. It's already gated behind its own flag; no user-facing behavior change.
