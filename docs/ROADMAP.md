# Peanut Gallery — Roadmap

> Pending work beyond v1.1.1. Everything below is **unstarted and awaiting greenlight** — don't begin implementation without confirming scope with Seth first.

Last updated: 2026-04-17

---

## The "big plan" (greenlight-pending)

These six items form one coherent block of work we deliberately held off on while shipping v1.1.1's QoL fixes. They're listed in the rough order they'd ship.

### 1. Refactor personas into selectable packs
- **Why:** Today `lib/personas.ts` hard-codes the Howard Stern crew (Baba Booey + Troll + Fred + Jackie). A selectable pack lets us ship alternates (notably a TWiST-themed pack — Jason, Molly, Alex, Lon — for the bounty demo) without touching the Director or engine.
- **Shape:** Extract personas into `lib/packs/howard/`, `lib/packs/twist/`, etc. Each pack exports the same `Persona[]` shape plus pack-level metadata (display name, badge color, default voice assignments). `lib/persona-engine.ts` takes a pack instead of importing personas directly.
- **Touches:** `lib/personas.ts` (deleted or becomes re-export shim), `lib/persona-engine.ts`, `lib/director.ts`, `app/api/personas/route.ts`, `app/api/transcribe/route.ts`, extension side panel UI.

### 2. Smart Director v2 — LLM-assisted routing with pattern-match fallback
- **Why:** The current Director (`lib/director.ts`) is a rule-based scorer — pattern hits, cooldowns, randomness. It's fast and deterministic, but it can't weigh context like "this joke already got roasted 10s ago, pick a different angle." An LLM-assisted layer picks the persona and returns a brief routing rationale; the pattern-match scorer remains as the fallback when the LLM times out or errors.
- **Shape:** Add a lightweight `directorLLM.pickPersona(recent, packPersonas)` call that runs in parallel with the existing scorer. If it beats a latency budget (say 400ms), use its pick; otherwise fall back to the rule-based Director. Keep the cascade + cooldown bookkeeping exactly as it is.
- **Touches:** `lib/director.ts`, new `lib/director-llm.ts`, `app/api/transcribe/route.ts` routing block.

### 3. Expanded director logging
- **Why:** Right now it's hard to see *why* the Director picked a particular persona (or nobody) in a given window. For tuning and for debug-panel display (item 4), we need structured JSON lines per routing decision.
- **Shape:** Every Director decision emits one log line like `{ ts, pick, score, top3, cascadeLen, cooldownsMs, reason }`. Routes through existing `lib/debug-logger.ts` at `info+`.
- **Touches:** `lib/director.ts`, `lib/debug-logger.ts`.

### 4. Director debug panel (hidden toggle in side panel)
- **Why:** Surfaces the expanded logs (item 3) in the extension UI so we can see what the Director is doing live — useful for demos and for tuning trigger thresholds.
- **Shape:** A collapsible section in the side panel (off by default, hidden behind a small gear or long-press the version badge) that shows the last N routing decisions as a mini-table: picked persona, score, top alternates, reason. Consumes a new SSE event type `director_decision`.
- **Touches:** `extension/sidepanel.html`, `extension/sidepanel.js`, `app/api/transcribe/route.ts` (emits the new SSE event).

### 5. Pack swap UI in side panel
- **Why:** Surfaces item 1. Dropdown at the top of the side panel — Howard / TWiST / (future packs). Persists selection to `chrome.storage.local`. Sends the pack ID on session start; backend uses it to instantiate the right persona set.
- **Shape:** Small select element, server accepts `X-Pack-Id` header (or query param on the SSE URL) and passes it through to `PersonaEngine` + Director.
- **Touches:** `extension/sidepanel.html`, `extension/sidepanel.js`, `app/api/transcribe/route.ts`, persona-engine wiring.

### 6. tsc + lint + local smoke test of the director v2 + TWiST pack
- **Why:** Gate on this before any merge that touches the persona/director path. We've shipped pipeline fixes in the past that passed types but failed at runtime (see ISSUE-006 and ISSUE-004 in `DEBUGGING.md`).
- **Shape:** `npm run typecheck && npm run lint && scripts/test-personas.ts --pack twist --fixture astroforge` as part of the pre-commit flow or CI.

---

## Smaller standalone items

Not part of the big plan — can be picked off independently:

- Broader test coverage for `lib/director.ts` (especially the silence path added in v1.1.1). Today coverage is informal.
- Revisit cascade-delay randomness — early feedback suggests it sometimes feels too spaced-out during fast exchanges.

---

## Out of scope (for now)

- Voice synthesis / TTS per persona. Explored early on; parked because latency budget is already tight and the written-reaction experience is differentiated enough.
- Non-YouTube sources (Twitch, Kick, arbitrary MediaStream). The Chrome extension's `tabCapture` theoretically works for any tab, but personas are tuned for podcast-style pacing; other content types would need their own pack + director tuning.

---

## How to start any of this

1. Re-read [`docs/CONTEXT.md`](CONTEXT.md) end-to-end.
2. Read [`docs/SESSION-NOTES-2026-04-17.md`](SESSION-NOTES-2026-04-17.md) for the most recent state.
3. Confirm scope + priority with Seth before writing code. This roadmap is a menu, not a queue.
