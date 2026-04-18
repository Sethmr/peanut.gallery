# Peanut Gallery — Roadmap

> Version-staged plan. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

Last updated: 2026-04-18 (v1.4.0 is current)

---

## Shipped

### v1.2.0 — "Mise en place" — shipped

Director debug panel + `director_decision` SSE, expanded `lib/director.ts` logging, cascade-delay retune, `scripts/test-director.ts` fixtures, pre-merge `tsc` + lint + smoke-test gate.

### v1.3.0 — "TWiST Pack" (flagship) — shipped

- Persona-pack refactor: `lib/packs/howard/` + `lib/packs/twist/`, each exporting `Persona[]` + pack metadata. `lib/personas.ts` is now a thin shim. Engine + Director + both routes take a pack argument.
- TWiST pack: Molly Wood (producer), Jason Calacanis (troll), Lon Harris (soundfx), Alex Wilhelm (joker). Character research in [`docs/packs/twist/RESEARCH.md`](packs/twist/RESEARCH.md).
- Pack-swap UI in the side panel, persisted to `chrome.storage.local`, `X-Pack-Id` on the session POST.
- Pack-creation scaffolding + smoke-gate upgrade (`--pack twist` runs against both packs).

### v1.4.0 — "Grok-powered Troll + search toggle" — current

- **Provider migration:** Troll + Sound FX moved from Groq Llama to xAI **Grok 4.1 Fast non-reasoning** (same models across both packs). `groq-sdk` removed from dependencies and runtime. `GROQ_API_KEY` / `X-Groq-Key` no longer read.
- **New env + header surface:** `XAI_API_KEY`, `SEARCH_ENGINE` (`brave` | `xai`, default `brave`), `X-XAI-Key`, `X-Search-Engine`. Full wire spec in [`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md).
- **Search-engine toggle:** Producer's fact-check pipeline picks Brave REST or xAI Live Search per session. Timeouts: Brave 5s, xAI Live Search 8s, LLM streams `AbortSignal.timeout(25_000)`.
- **Pipeline log events** for fact-check observability: `search_skip`, `search_no_claims_detected`, `search_timeout`, `search_upstream_error`, `search_empty_result`, `search_complete`, `search_pipeline_error`. See [`DEBUGGING.md`](DEBUGGING.md).
- **Force-react hardening:** Baba's force-react tap now skips pre-stream search for latency. `firePersona` logs `force_react_fallback` at warn and substitutes an archetype-keyed string when a persona tries to pass on a tap, so taps never leave an empty bubble. Working-tree fixes for the persona-tap path are **unverified in production** — see [`SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) §5 for the localhost verification checklist.

---

## v1.5.0 — "Smart Director v2" (in progress — scaffolding landed 2026-04-18)

The brains upgrade. Runs on top of the v1.2 observability + tests, and depends on the v1.4 force-react work being verified first.

### Smart Director v2 — LLM-assisted routing with pattern-match fallback
- **Why:** The rule-based scorer can't weigh context like "this joke already got roasted 10s ago, pick a different angle." An LLM pick — with a brief routing rationale — wins those cases. The pattern-match scorer stays as the guaranteed-cheap, guaranteed-fast fallback.
- **Shape:** `lib/director-llm.ts::pickPersonaLLM(ctx)` runs in parallel with the existing scorer. If it returns under **400 ms**, use its pick + rationale. Otherwise fall back to the rule-based Director. Cascade + cooldown bookkeeping is unchanged. Rationale flows into the v1.2 debug panel automatically.
- **Touches:** `lib/director.ts`, `lib/director-llm.ts` (new), `app/api/transcribe/route.ts` routing block, `scripts/test-director.ts` (`input.llmPick`, `sourceIn` assertion).
- **Status (2026-04-18):** Scaffold shipped behind `ENABLE_SMART_DIRECTOR=true` flag. New module, decide-opts passthrough, route race, two new fixtures — harness stays 16/16 green. Remaining for 1.5.0 tag: (1) side-panel `source` badge on the debug panel decision card, (2) canary latency + agreement-rate telemetry from a flag-enabled deploy, (3) `docs/V1.5-PLAN.md` with the rollout + guardrail checklist, (4) decide whether to default the flag ON for self-hosters who have `ANTHROPIC_API_KEY`.

---

## v1.6.0 — "Voice + Clip Share"

### 1. Voice / TTS per persona
- **Why:** Written reactions are differentiated, but voice turns Peanut Gallery into a companion broadcast. Latency budget was the blocker in 2025 — revisit now that per-persona TTS is cheaper and streaming-native.
- **Shape:** Per-persona voice assignments in each pack. Duck under the original audio during playback (use the existing passthrough graph). Opt-in, off by default. Probably ElevenLabs / OpenAI TTS / Cartesia — pick based on latency + cost at implementation time.
- **Touches:** `lib/packs/*/` (voice ids), `extension/offscreen.js` (playback + ducking), side panel setting.

### 2. Clip-sharing / highlight export
- **Why:** The funniest cascades deserve to escape the side panel. Clip + personas = organic distribution.
- **Shape:** "Clip last ~30s" button. Exports transcript snippet + persona reactions as either (a) a styled video / GIF with captions, or (b) a permalinked HTML clip page. Starts client-side; server-side render is a v1.6.x stretch if we need it.
- **Touches:** `extension/sidepanel.js`, new render path (likely `app/clip/[id]/page.tsx` or client-side canvas).

---

## v2.0.0 — "3D Bobbleheads"

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
2. Read [`docs/SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) for the most recent state — §5 is the localhost verification checklist to run before changing anything.
3. Confirm scope + priority with Seth before writing code. Release boundaries are load-bearing — don't pull work forward without confirming.
