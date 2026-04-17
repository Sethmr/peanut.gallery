# Peanut Gallery — Roadmap

> Version-staged plan from v1.2.0 through v2.0. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

Last updated: 2026-04-17

---

## v1.2.0 — "Mise en place" (shipping next)

Low-risk QoL + observability + the pre-merge quality bar. Everything here is additive and wire-compatible with v1.1.x backends, so we can ship while v1.1.1 is still in Chrome Web Store review.

### 1. Director debug panel
- **Why:** Hard to tune the Director or demo it credibly without seeing *why* it picked a given persona. Also the single best tool for debugging "nothing fired" complaints.
- **Shape:** Collapsible section in the side panel, off by default, revealed by long-pressing the version badge. Shows the last N routing decisions as a mini-table — picked persona, score, top alternates, reason. Consumes a new SSE event type `director_decision`.
- **Touches:** `extension/sidepanel.html`, `extension/sidepanel.js`, `app/api/transcribe/route.ts`.

### 2. Expanded director logging
- **Why:** Feeds item 1. Also gives us offline tuning data for the cascade retune and the v1.4 Director v2 work.
- **Shape:** Every Director decision emits one JSON line: `{ ts, pick, score, top3, cascadeLen, cooldownsMs, reason }`. Routes through `lib/debug-logger.ts` at `info+`.
- **Touches:** `lib/director.ts`, `lib/debug-logger.ts`.

### 3. Cascade-delay retune
- **Why:** Early feedback says it feels too spaced-out during fast exchanges.
- **Shape:** Tighten the lower bound, narrow the jitter window. Slow stretches keep their full spread. Bake the new numbers once the debug logs give us real data.
- **Touches:** `lib/director.ts` cascade scheduling.

### 4. Real director test coverage
- **Why:** Coverage today is informal. ISSUE-004 (force-fire no-op) and ISSUE-006 (pause repeat) both shipped through types and only showed up at runtime. We need fixtures.
- **Shape:** `scripts/test-director.ts` with fixtures covering rule-based scoring, cooldowns, cascade probability, and the v1.1.1 silence path.
- **Touches:** `scripts/test-director.ts` (new), `lib/director.ts` (minor test-seams only).

### 5. Pre-merge gate: `tsc` + lint + smoke test
- **Why:** Enforce 1–4 and prevent the whole silent-failure class.
- **Shape:** `npm run typecheck && npm run lint && scripts/test-director.ts` wired into pre-commit. Upgrade to `--pack twist` once v1.3 lands.
- **Touches:** `.husky/pre-commit` (or equivalent), `package.json` scripts.

---

## v1.3.0 — "TWiST Pack" (flagship)

The bounty-aligned release. Swappable persona packs, a shipped TWiST pack, and a guided installer so the community can build new packs that match our quality bar.

### 1. Refactor personas into selectable packs
- **Why:** Today `lib/personas.ts` hard-codes the Howard Stern crew. A pack abstraction lets us ship the TWiST lineup (Jason Calacanis, Molly Wood, Alex Wilhelm, Lon Harris) and any future lineups without touching the Director or engine.
- **Shape:** Extract into `lib/packs/howard/`, `lib/packs/twist/`. Each pack exports a `Persona[]` + pack metadata (display name, badge color, default voice assignments, pack prompt). `lib/persona-engine.ts` takes a pack instead of importing personas directly.
- **Touches:** `lib/personas.ts` (shim), `lib/persona-engine.ts`, `lib/director.ts`, `app/api/personas/route.ts`, `app/api/transcribe/route.ts`, extension side panel.

### 2. TWiST pack
- **Why:** The flagship. Jason Calacanis + Molly Wood + Alex Wilhelm + Lon Harris, researched and written to the same depth as the Howard pack.
- **Shape:** `lib/packs/twist/personas.ts` with character research in `docs/packs/twist/RESEARCH.md`. Includes taboo topics, callback patterns, mannerisms.
- **Touches:** `lib/packs/twist/`, `docs/packs/twist/`.

### 3. Pack swap UI in side panel
- **Why:** Makes the refactor user-visible.
- **Shape:** Select element at the top of the side panel. Persists to `chrome.storage.local`. Sends `X-Pack-Id` header (or query param on the SSE URL) on session start; server passes it through to `PersonaEngine` + Director.
- **Touches:** `extension/sidepanel.html`, `extension/sidepanel.js`, `app/api/transcribe/route.ts`.

### 4. Pack-creation installer
- **Why:** We want the community building packs at our quality bar, not half-baked ones. A guided installer produces a scaffold + a lint-style checklist so every new pack has character research, taboo topics, cross-persona callbacks, and a test fixture.
- **Shape:** CLI / Claude skill that: (a) scaffolds `lib/packs/<id>/`, (b) prompts the author through persona count, voice, taboo topics, signature patterns, (c) generates a research doc template, (d) writes a smoke-test fixture. Exposed via `scripts/new-pack.ts` + a published prompt in the README.
- **Touches:** `scripts/new-pack.ts` (new), possibly a new skill under `.claude/skills/`, README.

### 5. Tests + smoke gate upgrade
- Re-run the v1.2 pre-merge gate with `--pack twist` added. Both packs must pass fixtures before merge.

---

## v1.4.0 — "Smart Director v2"

The brains upgrade. Runs on top of the observability and tests from v1.2.

### Smart Director v2 — LLM-assisted routing with pattern-match fallback
- **Why:** The rule-based scorer can't weigh context like "this joke already got roasted 10s ago, pick a different angle." An LLM pick — with a brief routing rationale — wins those cases. The pattern-match scorer stays as the guaranteed-cheap, guaranteed-fast fallback.
- **Shape:** `lib/director-llm.ts::pickPersona(recent, packPersonas)` runs in parallel with the existing scorer. If it returns under 400ms, use its pick + rationale. Otherwise fall back to the rule-based Director. Cascade + cooldown bookkeeping is unchanged. Rationale flows into the v1.2 debug panel automatically.
- **Touches:** `lib/director.ts`, `lib/director-llm.ts` (new), `app/api/transcribe/route.ts` routing block.

---

## v1.5.0 — "Voice + Clip Share"

### 1. Voice / TTS per persona
- **Why:** Written reactions are differentiated, but voice turns Peanut Gallery into a companion broadcast. Latency budget was the blocker in 2025 — revisit now that per-persona TTS is cheaper and streaming-native.
- **Shape:** Per-persona voice assignments in each pack. Duck under the original audio during playback (use the existing passthrough graph). Opt-in, off by default. Probably ElevenLabs / OpenAI TTS / Cartesia — pick based on latency + cost at implementation time.
- **Touches:** `lib/packs/*/` (voice ids), `extension/offscreen.js` (playback + ducking), side panel setting.

### 2. Clip-sharing / highlight export
- **Why:** The funniest cascades deserve to escape the side panel. Clip + personas = organic distribution.
- **Shape:** "Clip last ~30s" button. Exports transcript snippet + persona reactions as either (a) a styled video / GIF with captions, or (b) a permalinked HTML clip page. Starts client-side; server-side render is a v1.5.x stretch if we need it.
- **Touches:** `extension/sidepanel.js`, new render path (likely `app/clip/[id]/page.tsx` or client-side canvas).

---

## v2.0.0 — "Bobbleheads"

### 3D avatars on screen
- **Why:** The visual payoff. Peanut Gallery becomes a show, not just a text sidebar.
- **Shape:** Animated 3D character models per persona. Lean-in + reaction animations tied to fire events. Sentiment-driven idle loops (Fred Norris deadpan stare, Troll eye-roll, Baba Booey fact-check lean). Probably Three.js in the side panel, with procedural rig animation driven by the existing SSE stream.
- **Touches:** New `extension/avatars/` subtree, new SSE fields for animation hints, possibly WASM for rig solves.

---

## Deliberately not on the roadmap

- **Non-YouTube sources (Twitch, Kick, arbitrary tab audio).** Already works today — `chrome.tabCapture` is tab-agnostic. Persona pacing is tuned for podcast/interview rhythm, so it's "supported, not marketed" until a pack is tuned for a different format.
- Anything else not listed above is explicitly unscoped until we finish the items above.

---

## How to start any of this

1. Re-read [`docs/CONTEXT.md`](CONTEXT.md) end-to-end.
2. Read [`docs/SESSION-NOTES-2026-04-17.md`](SESSION-NOTES-2026-04-17.md) for the most recent state.
3. Confirm scope + priority with Seth before writing code. Release boundaries are load-bearing — don't pull work forward without confirming.
