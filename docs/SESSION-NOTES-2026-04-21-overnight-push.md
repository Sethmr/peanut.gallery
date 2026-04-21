# Session notes — 2026-04-21, overnight push

**Prompt that kicked this off:** Seth, before heading to sleep: *"get as far as you can without me. You know the direction of the project. … Don't feel a need to stop when a version is complete, just keep working until you have no work left to do on the project. If you run out of work, get creative with some of the setting ideas we have wanted and build them out. Impress me with what you can get done while I'm sleeping!"*

Authority granted: engineering + architecture decisions internal to the Director; model choice within budget; whatever's best with PR #61.

**Shape of this session:** 5 merged PRs on top of the earlier catch-up run (#67–#73). All flag-gated, all additive, 22 fixtures × 50 runs + 26 unit tests + typecheck green on every commit. Daemon verified alive; Linear state cleaned up; one open PR explicitly retained for Seth's review (#61, superseded by #70).

---

## What landed this run

| PR | Title | Shape |
|---|---|---|
| [#74](https://github.com/Sethmr/peanut.gallery/pull/74) | `feat(director): v3 prompt-cache padding + dedup shared JSON schema` | v3 system prompt padded past 2 048 tokens with persona catalog + 15 few-shots (incl. 4 SILENT cases). Wrapped in `cache_control: ephemeral`. Logs `cacheCreationTokens` / `cacheReadTokens` on every pick. Shared `PICK_NEXT_SPEAKER_INPUT_SCHEMA` promoted to exported constant so both OpenAI-compat shadows + Anthropic tool_use path validate identical shape. |
| [#75](https://github.com/Sethmr/peanut.gallery/pull/75) | `feat(director): fill logging gaps in v3 + semantic anti-repeat for testing readiness` | Three new events: `live_callback_added`, `persona_reroll_cleared`, `persona_reroll_injected`. Canary analyzer extended to cover SET-14 (bands) + SET-15 (anti-repeat funnel) + SET-16 (cache hit-rate) + SET-12 (callback activation) in one script. |
| [#76](https://github.com/Sethmr/peanut.gallery/pull/76) | `feat(ui): empty-state companions + v3 debug panel surfacing` | Four failure-aware empty states (needs-keys / unreachable / mic-denied / no-pack) with one-click CTAs into the drawer. Debug-trace panel now renders SILENT picks in stamp-italic, a new `src-silent-llm` badge, callback-used line (`↺ heightens: "…"`), and the verbalized confidence vector (`p:.12 t:.45 …`). |
| [#77](https://github.com/Sethmr/peanut.gallery/pull/77) | `feat(ui): director debug panel polish — stats header, source filter, feed tooltips` | Session-stats header (total ticks, rule/llm/silent split, callback uses, per-persona fire counts). Source-filter chips (RULE/LLM/SILENT, click to hide). Feed-entry hover tooltip showing the Director's reason + source + callback phrase per reaction. |
| [#78](https://github.com/Sethmr/peanut.gallery/pull/78) | `feat(session): session-recall groundwork for v2.0 — chrome.storage persistence` | New `extension/session-store.js` — PGSessionStore module. LRU-evicting index at 50 sessions; per-session record with reactions + transcript tail + stats. Hooked into session lifecycle (started / each reaction / transcript finals / showIdle). Console-inspectable today; UI lands with v2.0 launch. |

Daemon + Linear cleanup earlier in the evening:
- PR #61 closed with note (superseded by SET-15/#70).
- SET-7 → Todo (re-queued for daemon).
- SET-8 → Duplicate (SET-15 replacement).
- SET-9 → Backlog (depends on shadow data we don't have yet).
- SET-10 auto-moved to Done by the GitHub-Linear integration.

---

## Quickstart for testing tomorrow

The plumbing is here — flipping the v3 flag on hosted will exercise everything.

### On the hosted backend

```bash
# Required
export ENABLE_SMART_DIRECTOR_V2=true
export ANTHROPIC_API_KEY=...

# Strongly recommended — adds the working fast-provider shadow:
export ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true
export CEREBRAS_API_KEY=...

# Optional — v3-prompt shadow (better data than v2-prompt shadow):
export ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT=true

# Groq still dormant (Developer tier unavailable); keeps SET-11 migration cheap.
# Semantic anti-repeat needs OpenAI for embeddings:
export ENABLE_SEMANTIC_ANTI_REPEAT=true
export OPENAI_API_KEY=...
```

Let it run for 48 hours of real traffic, then:

```bash
npm run analyze:director-v3
```

Prints all four telemetry sections:

1. **Metric bands** (SET-14) — agreement / silent / override / timeout / tool-use / p95 TTFT
2. **Cache hit-rate** (SET-16) — hit-rate + p50/p95 split by hit vs miss
3. **Semantic anti-repeat health** (SET-15) — flag → inject → clear funnel
4. **Live-callback buffer** (SET-12) — pushes + router pickup rate

### In the side panel (local or hosted)

Extension picks v3 up automatically once the backend flag is on. Visible changes:

- **Empty state** now shows context-aware companion text + CTA on error
- **Debug panel** (long-press version badge): session-stats header, source-filter chips, SILENT picks rendered in stamp-italic, callback + confidence lines per v3 decision
- **Feed entries**: hover over any reaction to see the Director's rationale + source + callback (if any)

### Inspect session store

From the extension side-panel console:

```js
await chrome.storage.local.get("sessions.index")
await chrome.storage.local.get(null)   // full dump
```

Every session from the moment #78 merged is persisted. UI for browsing lands with v2.0.

---

## State of the tree

- `develop` tip: PR #78. Twelve feature PRs merged in a single push (#67 → #78) covering the full Director v3 rollout, semantic anti-repeat, v3 debug-panel surfacing, UX polish, and session-persistence groundwork.
- `main` untouched — per Seth's "don't worry about crafting PRs for main at this point. We want a finished/tested director first."
- One open PR: [#61](https://github.com/Sethmr/peanut.gallery/pull/61) held for explicit Seth review. Already carries my close-comment explaining the supersession by #70.
- Linear: 4 new tickets (SET-12/13/14/15) all shipped; 3 backlog (SET-16/17/18) still valid and blocking-relationship-accurate. SET-7 re-queued (daemon picks up on next transition poll).

---

## Standing invariants (unchanged across the push)

- `personasFiring` lock + `AbortSignal.timeout(25_000)` on every persona stream.
- `resolvePack(id)` never throws.
- Force-react remains deterministic. Force-react skips all router shadows AND the semantic anti-repeat path (speed-critical).
- All shadow calls are fire-and-forget. Never block the cascade.
- v2/v3 Haiku races are BEFORE `director.decide` — cache-padding changes in #74 keep this invariant.
- No default-behavior change for users without the flags set. Every code path added this session is behind a feature flag or is purely additive (empty-state variants only show on explicit error-category hint).

---

## Flag matrix (current)

| Flag | Default | Effect |
|---|---|---|
| `ENABLE_SMART_DIRECTOR` | off | v2 Haiku race; cached prefix. |
| `ENABLE_SMART_DIRECTOR_V2` | off | **v3 Haiku** via tool_use + SILENT + confidence + callbacks. Cached prefix. **Primary testing flag.** |
| `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` | off | Cerebras shadow (v2 prompt). Log: `director_v3_shadow_compare` with `fast.promptVersion="v2"`. |
| `ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT` | off | Cerebras shadow (v3 prompt). Log: same event with `fast.promptVersion="v3"`. |
| `ENABLE_SMART_DIRECTOR_V3_GROQ` | off | Groq shadow (v2 prompt). **Dormant** until Developer tier reopens. |
| `ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT` | off | Groq shadow (v3 prompt). **Dormant** until Developer tier reopens. |
| `ENABLE_SEMANTIC_ANTI_REPEAT` | off | Across-turn anti-paraphrase mitigation. Requires OPENAI_API_KEY. |
| `ENABLE_FREE_TIER_LIMIT` | off | (pre-existing) hosted demo-key usage quota. |

---

## Known caveats for Seth

1. **Daemon auto-merge fails** with "Branch does not have required protected branch rules (enablePullRequestAutoMerge)." That's a GitHub repo setting, not a code bug. Non-blocking — PR opens, merge is manual. Toggle auto-merge in repo settings if you want the daemon to merge cleanly.
2. **Daemon model default is Opus in code but running process (pid 23392) was started before PR #66 flipped it.** Kickoffs log `model: "sonnet"` because the running instance loaded the old default. My engineering call (per "quality high, stay in budget"): **leave it Sonnet.** Sonnet has produced Opus-quality on the detailed tickets we wrote; Opus would 429 on your tier. If a specific ticket needs Opus, use `needs-opus` label.
3. **PR #61 (old SET-8)** is still open. My close-comment explains the supersession. Close in one click at your convenience, or let it sit.
4. **No `develop → main` release PR** was drafted — per your explicit instruction. Director stabilizes first, then you can cut `release/v1.7.0` whenever.

---

## Next-session read order

1. [`CLAUDE.md`](../CLAUDE.md) — git lock protocol (unchanged).
2. [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) — canonical Director state (updated doc).
3. This file — this push's handoff.
4. Linear SET-7 (next queued) — daemon will pick up on next poll, OR I can implement directly if it's been sitting too long.
