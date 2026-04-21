# Peanut Gallery — Design Principles

Durable product direction from Seth. If you find yourself unsure whether a change is on-brand for Peanut Gallery, read this. If something here is wrong or outdated, propose a change before editing.

Every rule here exists because something went wrong (or almost did) and Seth articulated the lesson. Each rule carries the date it was added + the shorthand rationale so the next reader doesn't have to re-litigate it.

---

## Product direction

### 1. A committed UI surface must always land with visible content
*(2026-04-21 — see [SESSION-NOTES-2026-04-21](SESSION-NOTES-2026-04-21-overnight-push.md), PR [#82](https://github.com/Sethmr/peanut.gallery/pull/82).)*

If the side panel has started a persona's speaking animation, that persona MUST produce visible content before the animation ends.

**Applies to:**
- Force-react taps (avatar click / 🔥 button) — protected since v1.4 via `getForceReactFallback`.
- Director-driven producer fires — the producer slot has a dedicated status event so the UI pre-animates Baba/Molly specifically. Safety net in `lib/persona-engine.ts` emits `producer_pass_safety_net` + the fallback string on pass.

**Does NOT apply to:**
- Director cascades for troll / sfx / joker. The UI doesn't pre-animate those, so a silent `-` pass is invisible.

**Corollary:** Wrong fact-check content > empty speaking animation. Aggressive fact-check sensitivity (e.g. Baba's `factCheckMode: "loose"`) is a feature, not a bug.

### 2. The Director balances characters
*(2026-04-21 reaffirmed while designing the fact-check gate.)*

No single persona should dominate for long. Even when the Director has a strong content-match or a fact-check gate, the other three slots must still surface regularly.

**Mechanisms:**
- Dry-spell boost (+0.8 per idle cycle, capped at +6) in `lib/director.ts`
- Cascade rolls (non-zero probability on every non-primary slot)
- Troll cascade floor (fires after 2 silent cycles even when the scorer disagrees)
- v3: sticky-agent penalty on the confidence vector (previous speaker's probability multiplied by ~0.6)
- Random tiebreak when scores are equal

**Implication:** **Gates on specific personas MUST be soft** (additive/subtractive score adjustments), never hard vetoes. A hard "never pick X" rule breaks this invariant. See `lib/director.ts` `PRODUCER_NO_CLAIM_PENALTY` as the pattern.

### 3. Fact-check sensitivity is per-pack character design
*(2026-04-21 — PR [#82](https://github.com/Sethmr/peanut.gallery/pull/82).)*

Each pack's producer declares `Persona.factCheckMode: "strict" | "loose"`.

- **Loose** — fires on speculation, predictions, "everyone knows" claims, name-drops, confidence-stacking. Howard's Baba Booey default. Being wrong-sometimes is part of the character.
- **Strict** — hard claims only (numbers, dates, attributions, corporate actions). TWiST's Molly Wood default (veteran journalist).

The mode is a pack-design decision, NOT a user setting. When adding a new pack, pick the mode that fits the character.

### 3a. Persona prompts are the lever, not the Director
*(2026-04-21 — codified after the Baba Booey false-pass audit; see [PACK-AUTHORING-GUIDE.md § Refinement loop](PACK-AUTHORING-GUIDE.md#refinement-loop-how-we-evolve-packs-over-time).)*

When a pack's behavior is off, the fix order is:

1. **Persona system prompt** (your main lever). The Director has had multiple iterations; the personas haven't been retuned with the same rigor. Most behavioral problems live in the persona's tier definitions or escape hatches.
2. **`directorHint`** — shapes when the Director's LLM picks that persona.
3. **`factCheckMode`** (producer only, rare — character-design decision, not a calibration knob).
4. **Claim-detector patterns or Director penalties** — last resort; changes affect every pack.

Tightening the Director to fix one pack's behavior violates design principle #2 (Director balances characters) by accident — it makes every future pack inherit a constraint that was really a one-pack prompt problem. Fix at the closest layer to the behavior.

### 4. Customer value wins over industry norms
*(2026-04-20 — explicit during the Director research review.)*

Research conventions (RouterBench agreement rates, calibration ECE, standard fallback patterns) are useful signal but not gospel. Peanut Gallery is a specialized product for a specialized audience.

Features that help **customers** (streaming UX, callback heightening, per-pack sensitivity, "correct everything" DNA) win over features that maximize **abstract correctness** (in-band re-rolling, perfect calibration scores, universal fact-check strictness). The SET-8 redo (in-band re-roll → across-turn mitigation in PR #70) is the canonical example.

### 5. Privacy posture — keys in the browser
*(2026-04-17 canonical; pre-existing.)*

User credentials live on the user's machine. The hosted tier has demo keys but never stores user keys. No account system. No "upload your transcript to our server" feature.

Session-recall (v2.0, PR [#78](https://github.com/Sethmr/peanut.gallery/pull/78)) is local-only: `chrome.storage.local`, one-click clear, never uploaded. Source: [`SESSION-NOTES-2026-04-17.md §3`](SESSION-NOTES-2026-04-17.md) (marked immutable).

### 5a. Subscription is an alternative to BYOK, never a replacement
*(2026-04-21 — planned for v1.9.x; full plan in [`ROADMAP.md § Subscription tier`](ROADMAP.md#v19x-subscription-tier--pre-20-revenue-test).)*

When the in-app subscription ships (pre-v2.0 revenue test), it adds a third radio option alongside "Hosted demo" and "My own keys" — it does NOT remove either existing path.

- **Open-source + self-host flows keep BYOK unchanged.** Anyone running the Next.js backend themselves, or loading the extension against `localhost:3000`, still gets the same key-in-browser experience. The subscription code is open-source too.
- **Weekly-hours cap, not token-counting.** Users understand hours of live listening. The cap is set slightly above the top-10%-user usage; lean high initially to cover dev fees, tighten only if economics warrant. If the cap has to be tightened to hostile levels, that's a signal to rework the stack (cheaper Deepgram, Cerebras as primary once v1.7 GA, cheaper persona models), not to keep cutting users.
- **Privacy posture holds.** The backend sees the audio stream + the subscription identity; session transcripts and reactions stay in `chrome.storage.local`. No server-side transcript storage, no analytics on user content, no advertising. Ever.
- **No account-system creep before v2.0.** One tier, one price. No free-tier-with-aggressive-limits (demo-keys flow already covers "try-before-buy"). No teams / multi-seat until post-v2.0.

### 6. War-zone restraint; other politics are normal territory
*(Memory: `feedback_persona_political_restraint.md`.)*

Fact-checker personas don't defend the merits of war/military action. Other political content — climate, elections, immigration, culture — is normal fact-check territory. This is a narrow carveout driven by a specific past Stern-Show misfire; don't generalize it.

---

## Director internals

### 7. SILENT is a first-class choice, not a fallback
*(2026-04-20 v3 design — PR [#68](https://github.com/Sethmr/peanut.gallery/pull/68).)*

v3 router returns `"silent"` as a positive pick when:
- Mid-clause / mid-disfluency tail
- Backchannel-inviting tag question ("right?", "you know?")
- Another participant directly addressed by name
- Post-punchline moment (1–3 beats to breathe)
- Content-free filler agreement

False-positive firing is the #1 LLM-reactor failure mode (ICASSP 2026 HumDial). SILENT as a real slot is how we avoid it. Positive few-shots + tool_use enum enforce the choice.

### 8. "Model decides HOW, not IF" for user-committed surfaces
*(2026-04-18 — see [SESSION-NOTES-2026-04-18](SESSION-NOTES-2026-04-18.md) §4.)*

When the user explicitly taps an avatar or hits 🔥, the model CANNOT pass. The force-react preamble in `buildPersonaContext` emphasizes this; a `-` pass falls through to `getForceReactFallback`. Director-driven fires for non-producer slots still allow `-` (no UI commitment); director-driven producer fires catch `-` with the safety net (rule #1).

### 9. Every async router call is fire-and-forget or strictly time-bounded
*(2026-04-20 v3 design.)*

- Shadow providers (Groq, Cerebras, v2-prompt + v3-prompt variants) NEVER block the cascade. They log to `director_v3_shadow_compare` and move on.
- The v3 Haiku call is raced against `AbortSignal.timeout(400)`. Past the budget, the rule-based scorer takes over.
- Every persona stream has `AbortSignal.timeout(25_000)` — never leak a hung provider into a locked `personasFiring` flag.

### 10. Unstable-tail heuristic
*(2026-04-21 — PR [#80](https://github.com/Sethmr/peanut.gallery/pull/80), SET-7.)*

v3 router knows which transcript tail chars are new-this-tick vs stable-for-two-ticks. If the only reactable signal lives in the new tail, router prefers SILENT — lets the next tick confirm rather than misfiring mid-clause.

---

## For AI working in this repo

### 11. Read the principles before proposing "cleanups"
If a change would violate any rule above, pitch it in chat and let Seth decide before editing.

### 12. Tight PRs, clear commit messages
One idea per PR. Commit message body explains **why**, not just **what**. Reference the Linear ticket.

### 13. Model choice: Sonnet for daemons, interactive sessions pick per-budget
*(Memory: `feedback_opus_tier_rate_limit.md`.)*

Opus 4.7 is capped at 30k input TPM on Seth's tier — the daemon would 429 under real load. Sonnet 4.6 has produced Opus-quality work on the detailed Linear tickets we write. Default is Sonnet; `needs-opus` label exists as nominal opt-in but currently 429s until the tier is upgraded. Don't silently re-default to Opus.

### 14. Git protocol in this repo is non-negotiable
*(Canonical: [`AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md).)*

`.git/index.lock` is unrecoverable from the sandbox. Prevention: atomic `git add + commit` in one Bash call, explicit paths, `-F /tmp/msg-N.txt` for messages, 5-min timeout, never background a write. Recovery: one `rm`, one `mv`, then ESCALATE — no third method.

---

## Related canonical sources

- [`CONTEXT.md`](CONTEXT.md) — full project context
- [`STATE-OF-DIRECTOR-2026-04-21.md`](STATE-OF-DIRECTOR-2026-04-21.md) — Director-specific state
- [`ROADMAP.md`](ROADMAP.md) — version-staged plan
- [`RELEASE.md`](RELEASE.md) — branch model + self-merge contract
- [`AI-GIT-PROTOCOL.md`](AI-GIT-PROTOCOL.md) — index.lock protocol
- [`AI-INSTRUCTIONS-POLICY.md`](AI-INSTRUCTIONS-POLICY.md) — protected-file list
- [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) — the 100+ transcript study plan (in flight)
- Memories in `~/.claude/projects/…/memory/` — pointer summaries for the most-referenced rules
