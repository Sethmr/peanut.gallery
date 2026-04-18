# Peanut Gallery — Session Notes (2026-04-18)

> Handoff from a long post-v1.3.0 bug-fixing session. **Key meta-note:** most of
> the force-react work below was tested against a non-localhost build for hours
> without either party realizing it, so the server-side fixes from this session
> have never actually run under a real test. Treat the "Changes made" list as
> **uncommitted, unverified-in-production, tests-green-only**. Start a fresh
> session by running localhost and re-testing before changing anything else.

---

## 1. Current state at end of session

- **v1.3.0 "TWiST Pack" is shipped** (commit `21dae70`, plus three post-release
  bug-fix commits: `17d83a2`, `e0bbaf1`, `4e25131`).
- Working on **post-v1.3 persona tap / force-react reliability**. Two uncommitted
  modified files on the working tree:
  - `lib/persona-engine.ts` — added deterministic force-react fallback + helper.
  - `lib/personas.ts` — added force-react preamble at top of context + rewrote
    the end-of-prompt override.
- All existing checks still green: `npm run check` passes (tsc + extension
  node --check + 14/14 director fixtures × 50 runs).
- Git is clean apart from those two files. No WIP branches.

## 2. The bug being chased

**Symptom:** when the user taps Baba Booey or The Troll avatars (or hits 🔥 React),
the spinner animates but no text bubble ever appears. Fred and Jackie work every
time. Seen repeatedly in Seth's manual testing from ~2026-04-17 evening through
2026-04-18 ~12:49 AM (screen recording in uploads).

**Root cause (hypothesis, partially validated):** model is respecting the pass
rules baked into each persona's system prompt more aggressively than it's
following the force-react override.

- Baba's Howard prompt (`lib/packs/howard/personas.ts` line ~76): `If none of
  these tiers apply, you DO NOT speak. Output a single "-" and the director
  will pass to someone funnier.` Plus a FORMAT rule requiring a
  `[FACT CHECK]/[CONTEXT]/[HEADS UP]/[CALLBACK]` tag prefix.
- Troll's Howard prompt (same file, line ~183–189): `Output a single "-" to
  pass... Always prefer silence to a mid take.`
- Fred and Jackie don't mandate a tag-format, so they always land something.
- Both Baba and Jackie are on Claude Haiku, so "Haiku overcompliance" is
  **not** the whole story — it's the tag/tier structure in Baba's prompt
  specifically.

**Why we don't know if the server-side fixes worked:** Seth was not running
localhost during the test window. He was testing against `peanutgallery.live`
(production), which had the old v1.3.0 prompt. So the four prompt rewrites +
the fallback safety net below have **never been exercised** against a live
transcript. Director test fixtures (`scripts/test-director.ts`) still pass,
but those are routing tests, not content-generation tests.

## 3. Changes made this session (uncommitted)

### 3a. `lib/personas.ts` — `buildPersonaContext`

Two edits. Both survive `tsc` and the director harness, neither is live-tested.

- **Added a FORCE-REACT PREAMBLE at the TOP of the context** (before
  `persona.systemPrompt`). The theory: Claude Haiku reads the tier/tag rules
  *after* being told those rules are suspended for this turn. Preamble lists
  the specific rule shapes to ignore (`[TAG]` prefix requirement, `"-"` pass,
  "only speak when [tier] fits", "prefer silence to a mid take").
- **Rewrote the end-of-prompt override** into a short recency reminder. No
  more priority-ordered ladder (earlier versions biased fact-check as option
  #1 which pushed Troll toward silence since he doesn't fact-check). Flat
  bullet list, "minor / weak take is totally fine."

### 3b. `lib/persona-engine.ts` — `firePersona`

**Added a deterministic force-react safety net.** When `passed && isForceReact`,
we no longer emit an empty-done. We emit a short archetype-keyed fallback
string and treat it as the persona's response (stored in history, logged).

Fallback table (keyed by archetype slot so any pack works):

```ts
const FORCE_REACT_FALLBACKS: Record<string, string> = {
  producer: "Eh — nothing clean on that one. Let me keep my ears open.",
  troll:    "Not enough meat on that bone. I'll get the next one.",
  soundfx:  "[crickets]",
  joker:    "*still writing — hold.*",
};
```

Logged as a warn-level `force_react_fallback` event so we can count its
fire rate during director-tuning work next phase. Lines are deliberately
hedge-shaped and short; Seth has not approved their voice — treat them as
placeholders worth tuning.

### 3c. Reverted client-side gate (from earlier in session, before my tweaks)

Commit `4e25131` reverted the `data.fromForceReact` gate on the React-button
spinner-reset handler in `extension/sidepanel.js`. That gate was too strict —
any burst event arriving without the flag stranded the spinner for the full
`FORCE_REACT_TIMEOUT_MS` (15s). Server-side still emits `fromForceReact: true`
on the burst events; client no longer gates on it.

## 4. Principles Seth established this session (load-bearing)

Direct quotes — these should shape future work:

> "the persona model decides how it responds not if it responds"

Translation: the *whether* question is owned by the director (for scheduled
fires) or by the user (for taps / React). The model's only job is *how* —
the content, voice, style. If the model tries to pass on a force-react call,
that's a failure mode we patch server-side, not a valid outcome.

> "that should be saved for the director. Once all of this is built and
> testing director is next."

Translation: the director phase is where model-based judgment calls belong.
For personas themselves, prefer deterministic mechanisms (fallbacks, explicit
instructions) over nudging the model with prompt-language.

> "Baba Booey doesn't have to fact check 100% of times and a tap is a good
> reason to not fact check unless he just wants to."

Translation: the fact-check tiers in Baba's prompt are a *bias*, not a
hard gate. The prompt-override language that earlier prioritized fact-check
as option #1 was wrong and was rewritten.

## 5. How to verify (do this first in the next session)

1. **Run localhost.** `cd ~/peanut.gallery && npm run dev` in one terminal;
   confirm the extension is pointed at `http://localhost:3000` (not
   `peanutgallery.live`) via the extension settings in the side panel.
2. **Tap Baba Booey three or four times** with various transcripts. Expected:
   either a real fact-check/context note, or the hedge-shaped fallback
   (`"Eh — nothing clean on that one. Let me keep my ears open."`). Never
   silent spinner, never empty bubble.
3. **Tap The Troll** same way. Expected: either a real dunk/observation, or
   `"Not enough meat on that bone. I'll get the next one."`
4. **Check the server log for `force_react_fallback`** events. If they're
   firing on *every* tap, the preamble is being ignored — drop back to pure
   fallback and cut the preamble. If they're firing only occasionally, the
   preamble is helping and we can keep it as a nudge.
5. **Director fires still work normally.** The fallback only activates on
   `isForceReact=true`. Director-driven Baba passes should still be empty
   (silent pass is legitimate behavior there).

## 6. Potential regressions to double-check

The force-react plumbing touches enough surfaces that a smoke test of
non-tap flows is cheap insurance:

- [ ] Normal director cascade — Baba/Troll can still pass with "-" silently
      in regular flow. Fallback must NOT fire.
- [ ] 🔥 React-button burst — all 4 personas fire; Baba/Troll get fallback
      if they try to pass; Fred/Jackie's normal output still streams.
- [ ] Pack swap (Howard ↔ TWiST) mid-session — archetype keys
      (`producer/troll/soundfx/joker`) line up across packs, so fallback
      strings should apply identically. Spot-check with a TWiST tap.
- [ ] Director fixture harness (`npm run test:director`) still 14/14 × 50.
      Confirmed at end of session; re-run after any further changes.
- [ ] `tsc --noEmit` clean. Confirmed at end of session.

## 7. Pending work (post-verification)

- **Task #27 — Phase 3 cascade retune.** Has been pending since v1.3 plan.
  Depends on real-session JSONL logs, which can only be captured once the
  persona tap path is confirmed working. No change this session.
- **Director phase (next major focus per Seth).** Director = where model
  judgment legitimately gates *whether* to speak. Persona reliability has
  to be solid first so we can trust director test signal.
- **Tune the fallback lines** if the force-react safety net is firing
  frequently. Current lines are placeholders — Seth is creative director.

## 8. Files worth knowing about

| File | Why it matters |
|---|---|
| `lib/personas.ts` | `buildPersonaContext` — preamble + end override. Modified, uncommitted. |
| `lib/persona-engine.ts` | `firePersona` pass-detection + new fallback. `FORCE_REACT_FALLBACKS` table. Modified, uncommitted. |
| `lib/packs/howard/personas.ts` | Baba's tier/tag format rules are here (~line 76, ~line 100). Troll's pass rule ~line 183. Not modified. |
| `app/api/transcribe/route.ts` | `fire_persona` path passes `isForceReact=true` to `fireSingle`. Cascade uses `session.resolvedPack.personas`. Not modified this session. |
| `extension/sidepanel.js` | Spinner reset gate reverted in commit `4e25131`. Not modified since. |
| `scripts/test-director.ts` | 14 fixtures × 50 runs = 700 director-routing regression checks. Green. |

## 9. What broke / false starts during this session

A short honest log so the next session doesn't repeat these:

- **Iteration 1 override** led with "fact-check" as priority option #1.
  Biased Baba toward tier-gated silence and gave Troll no natural fallback.
  Replaced.
- **Iteration 2 override** was louder but still end-of-prompt only. Claude
  Haiku still obeyed the system-prompt tier rules it had already internalized.
  Augmented with the top-of-context preamble in iteration 3.
- **Iteration 3 preamble + softer reminder** at the end. Not verified.
- **Deterministic fallback** added in `firePersona` as the belt-and-suspenders
  safety net. Not verified.
- **Hours of testing** against `peanutgallery.live` instead of localhost —
  the actual reason nothing appeared to be working. Addressed by writing
  this handoff.

---

**Start next session by:** running `npm run dev`, pointing the extension at
localhost, and doing the §5 verification before touching code.
