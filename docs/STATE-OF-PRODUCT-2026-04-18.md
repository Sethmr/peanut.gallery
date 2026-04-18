# Peanut Gallery — State of the Product (2026-04-18)

> Snapshot audit, written the afternoon v1.5 went feature-complete. Use this as the entry point for any new contributor or session starting after this date — it points to everything else.

---

## TL;DR

- v1.5 "Smart Director v2" is **feature-complete and tested locally.** Seth signed off. One gate left: **48h canary on hosted.**
- Seven files on the working tree are **uncommitted** (docs + `directorHint` field + marketing polish). Sandbox is currently blocked on `.git/index.lock`; Seth's terminal clears it instantly.
- Subsystem audit (9 subsystems) comes back green: every integration point for Smart Director v2 is explicit, telemetered, and opt-in.
- Near-term roadmap is now fleshed out through v1.8 with concrete sub-steps; v2.0 remains vision-level.

---

## 1. Current version state

| Component | Version | Notes |
|-----------|---------|-------|
| `extension/manifest.json#version` | 1.4.0 | Bumps to 1.5.0 at tag time |
| Web app (`peanutgallery.live`) | v1.4.0 deploy | v1.5 backend not yet deployed — canary target |
| Active branch | `main` | Clean apart from uncommitted docs |
| Last merged commit | `60bcf79` | v1.5 finishing touches (docs/AI-GIT-PROTOCOL + competitive landscape + `docs/V1.5-PLAN.md` + debug panel source badge + fixtures) |

---

## 2. Working tree + recent commits

**Last 4 commits on `main`:**

```
33f71f8 docs: seo plan tuned for a chrome extension, not a plumber
5a27ae4 docs: persona-pack authoring guide + directorHint for Smart Director v2
60bcf79 🥜… (v1.5 finishing touches — landed 13 files, Seth's terminal)
4b5cd2c feat(v1.5): scaffold Smart Director v2 behind ENABLE_SMART_DIRECTOR
```

Commit `5a27ae4` captured the `directorHint` work: `Persona.directorHint?` field on `lib/personas.ts`, routing-prompt emission in `lib/director-llm.ts`, hint backfill on all 8 Howard + TWiST personas, §8 "Create your own persona pack" in `SELF-HOST-INSTALL.md`, §9 `directorHint` note in `BUILD-YOUR-OWN-BACKEND.md`, and the Groq→xAI cleanup in `marketing/cws-listing.md`.

**Currently uncommitted (as of this memo):**

```
M SHIP.md                                       — CWS long-description block synced with marketing/cws-listing
M docs/INDEX.md                                 — add STATE-OF-PRODUCT link; update ROADMAP summary
M docs/ROADMAP.md                               — full rewrite; fleshed-out v1.5.1 → v1.8; adds Pack Lab + Live Moments
M marketing/cws-listing.md                      — TWiST pack mention; podcast-first framing; screenshot caption tweaks; +5 keyword additions
? docs/STATE-OF-PRODUCT-2026-04-18.md           — this memo (new)
```

**Gates before commit:** `npm run check` green (tsc + node --check × 4 + 17/17 director fixtures × 50 runs).

**Suggested commit message:**

```
docs: state-of-product audit + roadmap refresh + CWS polish

- docs/STATE-OF-PRODUCT-2026-04-18.md (new) — v1.5 feature-complete
  snapshot, canary gate, 9-subsystem health check, value framing.
- docs/ROADMAP.md — full rewrite. Near-term releases fleshed out with
  sub-steps: v1.5.1 Smart Director Polish, v1.6 Voice + Clip Share
  (provider bake-off + client-side clip render), v1.7 Pack Lab (visual
  pack authoring + All-In / Acquired / Lex gallery), v1.8 Live Moments
  (danmaku overlay + event triggers + personal context).
- docs/INDEX.md — surface STATE-OF-PRODUCT; update ROADMAP summary.
- marketing/cws-listing.md + SHIP.md — add TWiST pack to long
  description; podcast-first positioning per competitive landscape;
  tighten screenshot captions; five additional search-term slots.
```

---

## 3. Canary gate (what blocks v1.5.0 GA)

Feature code is done. The remaining gate is empirical, not technical:

1. **Deploy hosted with `ENABLE_SMART_DIRECTOR=true`.** The flag is the only runtime change from v1.4.
2. **Run for ≥ 48 hours of real traffic.**
3. **Compute canary metrics** per [`V1.5-PLAN.md §4`](V1.5-PLAN.md#4-canary-checklist):
   - Agreement rate ≥ 0.55
   - Override rate 0.20 – 0.45
   - p95 `llmElapsedMs` < 350 ms
   - Timeout rate < 0.05
4. **Sanity-read 20 override transcripts.** Rationale should read like a producer's note, not a hallucination.
5. **If all four bands hit:** bump `manifest.json` to 1.5.0, tag, push.
6. **If any miss:** do NOT tag. File findings under `docs/SESSION-NOTES-<date>.md`. Either iterate the prompt (cheap) or pull the feature and re-roadmap (expensive).

**Kill switch exists.** Set `ENABLE_SMART_DIRECTOR=false` and redeploy; behavior reverts to v1.4 rule-based routing on the next tick.

---

## 4. Subsystem health (the 9 things Smart Director v2 could have broken)

Re-audited today; every subsystem is explicit about its relationship to the new routing layer.

| Subsystem | Integration with Smart Director v2 | Health |
|-----------|------------------------------------|--------|
| Rule-based Director (`lib/director.ts`) | Unchanged scoring logic. Accepts `opts.llmPick` to hoist the LLM's pick to primary when present. Cascade, cooldown, recency untouched. | ✅ Green |
| Transcribe route (`app/api/transcribe/route.ts`) | Races `pickPersonaLLM` against 400ms before every `director.decide`. Flag-gated by `ENABLE_SMART_DIRECTOR`. Emits `director_v2_compare` telemetry every tick. | ✅ Green |
| PersonaEngine (`lib/persona-engine.ts`) | Pack-agnostic, slot-keyed. Never sees the LLM routing pick directly — the Director already resolved which slot to fire before it's invoked. | ✅ Green |
| Pack system (`lib/packs/`) | `Persona.directorHint?` optional. Both shipping packs now carry hints; omitting the field still works (router falls back to `role`). | ✅ Green |
| Debug panel (`extension/sidepanel.*`) | Renders `RULE` / `LLM` badge on each decision trace row. Surfaces LLM rationale when present. | ✅ Green |
| Test harness (`scripts/test-director.ts`) | Accepts `input.llmPick` + `sourceIn` assertion. 17 fixtures, 50 runs each. 2 fixtures specifically exercise the LLM path (`llm-override-troll-to-joker`, `llm-unknown-id-falls-back`) + 1 agreement case (`llm-agrees-with-rule`). | ✅ Green |
| Force-react path | **Smart Director does NOT run on force-react.** Taps still bypass the Director entirely — v1.4's deterministic fallback is intact. | ✅ Green |
| Self-host + backend docs | `SELF-HOST-INSTALL.md` §5 documents `ENABLE_SMART_DIRECTOR` env var; new §8 walks through pack creation incl. `directorHint`. `BUILD-YOUR-OWN-BACKEND.md` §9 documents the optional field for rewrites. | ✅ Green |
| Hosted demo-key fallback | Smart Director honors the same Anthropic key resolution as persona firing. If the hosted demo key works for Haiku persona calls, it works for routing. No new auth path. | ✅ Green |

**Zero subsystems are blocked. Zero require rework.** The decomposition for v1.5 was right.

---

## 5. Known risks / technical debt

Ordered by severity:

1. **Force-react path is not live-verified in production.** `docs/SESSION-NOTES-2026-04-18.md` §2 flags that the v1.4 force-react fallback shipped via Seth's local test only. First user bug report against v1.5 should be triaged against this path first. Mitigation: fallback is deterministic (archetype-keyed string), so at worst it hands back a bland reaction, never nothing.
2. **Git sandbox lock rule.** `peanut.gallery` FUSE policy blocks removal of `.git/*.lock` and some `releases/*.zip` files from the sandbox. The rule is explicit: one `rm`, one `mv`, then escalate to Seth's terminal. Never a third method. Documented in `CLAUDE.md` + `docs/AI-GIT-PROTOCOL.md`; memory-indexed.
3. **Voice latency is unmeasured.** v1.6 voice features assume p95 TTS first-byte under 800ms. Not yet proven with any provider. The v1.6 provider bake-off (step 1) is essentially a research spike disguised as a dev task; treat its outcome as load-bearing before planning the rest of v1.6.
4. **Canary prompt brittleness.** Routing LLM could systematically favor one slot on edge cases the fixtures don't cover. Canary telemetry (`director_v2_compare`) catches that; iteration on the prompt is cheaper than re-architecture.
5. **Pack system has two path inheritances.** Pre-v1.3 callers can `import { personas } from "@/lib/personas"` and get the Howard array. Post-v1.3 callers use `resolvePack(id).personas`. Both work today; don't add a third pattern.
6. **Cost surprise for self-hosters with `ENABLE_SMART_DIRECTOR=true`.** Documented, not structurally mitigated. The Haiku tier is cheap (~$0.02/hour of director ticks at $0.80/M input tokens) but compounds for hours-long sessions. Worth calling out if we flip the default in v1.5.1.

---

## 6. What each near-term release unlocks (value framing)

The full sub-step breakdowns live in [`ROADMAP.md`](ROADMAP.md). Summarized here so you can sequence:

- **v1.5.1 Smart Director Polish** — turns the canary data into a calibrated default. Unlocks: a credible "our LLM routing beats rule-based" claim, backed by fixture-pinned numbers.
- **v1.6 Voice + Clip Share** — the two biggest perception shifts Peanut Gallery could ship next. Unlocks: the "it talks back" headline + viral clip distribution of the funniest cascades. Voice recovers the Dmooji text-only differentiation gap. Clips turn every session into potential distribution.
- **v1.7 Pack Lab** — broadens the pack surface dramatically. Unlocks: All-In / Acquired / Lex Fridman packs without engineering effort; user-generated packs without PRs; the "install the All-In pack" landing page as a Jason-retweetable artifact.
- **v1.8 Live Moments** — three small reactive-surface upgrades (danmaku overlay + event triggers + personal context). Unlocks: parity with Dmooji on UX modes; reactivity to ad-breaks / chapter-changes; per-viewer relevance. Each is a few days of work standalone.
- **v2.0 3D Bobbleheads** — the visual payoff. Unlocks: Peanut Gallery looks like a *show*. Intentionally vision-level until v1.8 ships.

---

## 7. Where to read next

- [`docs/ROADMAP.md`](ROADMAP.md) — fleshed-out near-term releases (v1.5.1 → v1.8) with sub-steps.
- [`docs/V1.5-PLAN.md`](V1.5-PLAN.md) — canonical canary checklist for the v1.5 tag.
- [`docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`](COMPETITIVE-LANDSCAPE-2026-04-18.md) — market read; refresh every ~90 days.
- [`docs/AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) + [`CLAUDE.md`](../CLAUDE.md) — the git lock rule (read before any git write).
- [`docs/SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) — force-react localhost verification checklist.
- [`docs/CONTEXT.md`](CONTEXT.md) — canonical project context for any new contributor.
