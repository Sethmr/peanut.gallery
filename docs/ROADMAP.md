# Peanut Gallery — Roadmap

> Version-staged plan. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

**Last updated:** 2026-04-22 (v1.8.0 "The Press Pass" live on Railway/`develop`; CWS release deferred until v2.0 per Seth's plan)
**Active release:** v1.8.0 "The Press Pass" — Peanut Gallery Plus subscription end-to-end (SQLite identity, Stripe live mode, Resend email, dedupe gate, four-mode access picker) + absorbs v1.6.0 canary + v1.7.0 legal hard-save
**Design principle:** one load-bearing change per release. If a release title needs an "and," split it. v1.5.0 and v1.6.0 were exceptions for CWS-cadence reasons; v1.8.0 is an exception because main is frozen until v2.0, so v1.6–v1.8 accumulate on `develop` and all bump the manifest in one CWS zip when main reopens.

---

## Shipped

| Tag | Name | Landed | Headline |
|-----|------|--------|----------|
| v1.2.0 | "Mise en place" | 2026-04-11 | Director debug panel + `director_decision` SSE + fixture harness |
| v1.3.0 | "TWiST Pack" | 2026-04-14 | Pack refactor + TWiST crew + side-panel pack swap |
| v1.4.0 | "Grok & Stability" | 2026-04-17 | Troll + Sound FX → xAI Grok; search-engine toggle; force-react hardening |
| v1.5.0 | "The Broadsheet" | 2026-04-19 | Tabloid side-panel rebrand (mute-a-critic, night theme, Markdown export) + Smart Director v2 client scaffold + Path-2 URL readiness |
| v1.5.1 | "Broadsheet Final" | 2026-04-20 | 6-submenu settings drawer (absorbs old v1.6 "Settings Pane") + free-tier status strip + episode card + ON AIR + per-mug waveforms + rolling-window ticker + round mugs |
| v1.5.2 | "First Run" | 2026-04-20 | Four-step Editor's Note onboarding tour + WIRE QUIET empty-state visibility fix |
| v1.5.3 | "The Cast" | 2026-04-20 | Illustrated peanut mascots for all 8 personas (absorbs old v1.8 "Peanut Mascots") + two-card pack chooser + apex→www middleware + war-defense guardrail |
| v1.5.4 | "The Sweep" | 2026-04-20 | Janitorial pass — SEO refresh + legacy `/watch` deletion + a11y polish + ops logging + orphan-dep removal |
| v1.5.5 | Dev-infra | 2026-04-20 | Linear ticket → Claude Code kickoff pipeline; framework + dev-dep refresh; release-model rewrite |
| v1.5.6 | Dev-infra | 2026-04-20 | Local Linear daemon on Seth's Mac (replaces GH-Actions kickoff; uses Claude Max subscription) |
| v1.6.0 | "The Canary" | 2026-04-21 | Smart Director v3 flag-gated canary (Haiku `tool_use` with 5-slot + SILENT, Cerebras Llama 3.1 8B + Groq shadow providers, sticky penalty, unstable-tail heuristic, live-callback ring buffer, across-turn semantic anti-repeat) + fact-check gate with per-pack sensitivity modes + fallback telemetry + peanut avatar stage 1 + 60 s silence auto-stop. `release/v1.6.0` branch preserved; absorbed into v1.8.0 manifest bump. |
| v1.7.0 | "The Fine Print" | 2026-04-21 | Legal hard-save: rewritten ToS/Privacy drafts, US-only gate on Plus, cookie-consent banner, email-alias plumbing. Tagged + branched; held back from main pending lawyer review. |
| **v1.8.0** | **"The Press Pass"** | **2026-04-22** | **Peanut Gallery Plus live end-to-end.** Phase 2 SQLite persistent identity (SET-25), Phase 3 Stripe checkout + webhook (SET-26), Phase 4 Resend transactional email (SET-27), dedupe gate with one-click recover-key modal, four-mode access picker (Demo / Plus / My keys / Self-host), 15-minute one-off free banner. Plus feed-UI polish (quote cards, pinned strip, Regenerate, fire-count chips, session timer, transcript pulse) + fact-check hardening + privacy feedback opt-out. Live on Railway from `develop`; main frozen until v2.0. |

Details on any of these live in the corresponding `docs/V<x>-PLAN.md`, `docs/STATE-OF-*` doc, or the [`CHANGELOG.md`](../CHANGELOG.md) entry.

---

## In flight — Smart Director v3 canary telemetry

**Status (2026-04-22):** v1.6.0 canary code is live on Railway (part of the `develop` = production posture). All v3 paths stay flag-gated. The 48-h agreement-rate read is still the gate between here and a "v1.9 Smart Director GA" release that retires the rule-based scorer.

**What's left to complete the canary:**

1. **Flip Railway env vars** (if not already set):
   ```bash
   railway variables set ENABLE_SMART_DIRECTOR_V2=true
   railway variables set ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT=true
   railway variables set CEREBRAS_API_KEY=csk-...
   railway up
   ```
2. **Collect ≥ 48 h of hosted sessions.** The fast-provider shadow is read-only — it never ships to users. Cost expectation per [`CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md#cost-expectations): ~$2 for a 48 h canary.
3. **Run the analyzer:**
   ```bash
   npm run analyze:director-v3
   ```
   Key bands: agreement rate Haiku↔Cerebras ≥ 85 %, p95 Cerebras latency 3–5× faster than Haiku, timeout rate < 2 %.
4. **Kill switch if something goes wrong:** `railway variables delete ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT && railway up`. Zero state to clean up — shadow never touched user-facing traffic.

**Decision point after 48 h:**
- If bands hit → v1.9 "Smart Director GA" is live (LLM router becomes primary; rule-based scorer retires to safety-net only).
- If bands miss → iterate the v3 prompt in `lib/director-llm-v2.ts` and re-canary. Don't retire the rule-based path until v3 is provably better, not just plausibly so.

**Note on v1.7 naming:** an earlier version of this roadmap reserved v1.7.x for "Smart Director GA." v1.7.0 got claimed by the legal hard-save branch ("The Fine Print") before the GA work was ready. The Smart Director GA slot has moved to v1.9.x; v1.8.0 "The Press Pass" fills the 1.8 slot with Plus.

---

## Path to v2.0 — Seth's road

The releases below are the explicit sequence on the way to the v2.0 launch ("The Gallery"). Release boundaries are load-bearing — confirm scope before pulling work forward. The deferred features that previously held the old v1.6 / v1.7 / v1.8 slots (voice, clip share, pack lab, live overlay) moved to [Deferred](#deferred--off-the-critical-path-to-v20) below; they're still good ideas, just not on the critical path.

**Version-numbering note (2026-04-21):** the earlier roadmap assigned v1.6 to "Settings Pane" and v1.8 to "Peanut Mascots" as planned work. Both scopes shipped early inside v1.5.x releases (v1.5.1 and v1.5.3 respectively), so the version numbers were reclaimed — **v1.6.0 is now "The Canary"** (what actually shipped there), and the downstream slots (v1.7 GA, v1.8 persona refinement, v1.9 subscription tier, v1.10 avatar stage 2) renumber accordingly. Versioning matches reality, not the pre-plan.

| Release | Theme | Status |
|---|---|---|
| v1.5.0 – v1.5.6 | Broadsheet + Cast + Sweep + dev-infra | ✅ Shipped (see table above) |
| v1.6.0 "The Canary" | Smart Director v3 flag-gated canary + fact-check gate + avatar stage 1 + 60 s silence auto-stop | ✅ Shipped to develop/Railway 2026-04-21; `release/v1.6.0` preserved |
| v1.7.0 "The Fine Print" | Legal rewrite hard-save (ToS/Privacy drafts, US-only gate, cookie consent, email aliases) | ✅ Tagged + branched 2026-04-21; awaiting lawyer review before main merge |
| **v1.8.0 "The Press Pass"** | **Peanut Gallery Plus live end-to-end — SQLite identity (SET-25), Stripe checkout (SET-26), Resend email (SET-27), dedupe gate, four-mode access picker, one-off 15-min free trial + feed-UI polish + fact-check hardening** | ✅ Shipped to develop/Railway 2026-04-22 |
| **v1.9.x "Smart Director GA"** | LLM router becomes primary once v1.6 canary clears bands; rule-based scorer retires to thin safety-net only. Per-pack `directorHint` calibration from canary telemetry. Kill-switch flag stays. (Renamed from the old v1.7.x slot — 1.7 was claimed by "The Fine Print.") | Blocked on v1.6 canary data |
| v1.10.x "Persona refinement sprint" | Re-run system prompts against 100+ transcripts per pack; tune anything canary telemetry says is under-firing. See [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md). | Blocked on v1.9 canary |
| v1.11.x "Avatar stage 2" | Bobbleheads / 2.5D parallax / Lottie / MP4 fallback — whichever reads best in a 2-day spike per Seth's Day-1 eval | Planned |
| v2.0.0 "The Gallery" | Session recall + shareable snippet (local, PNG-to-clipboard), full audit, CWS listing + marketing-site refresh, launch day (main reopens; v1.6→v1.8 accumulated bumps roll into one CWS zip) | Horizon |
| v2.x.x | Continuous Director + persona improvements while we wait for user-driven v3 direction | Post-launch |
| v3.0.0 | **User-driven** — direction defined by what v2.0 users ask for, not by us | TBD |

### ~~v1.6.0 "Settings Pane" (retired label)~~ — v1.6.0 now ships as "The Canary"

**Version-number clarification.** The earlier roadmap reserved v1.6.0 for a "Settings Pane" scope. That scope landed early inside v1.5.1 (the 6-submenu drawer) and v1.5.4 (the a11y polish pass), so the v1.6 label was reclaimed. **v1.6.0 is now "The Canary"** — the Smart Director v3 flag-gated canary release. See the in-flight section above and the [`CHANGELOG.md`](../CHANGELOG.md) entry for details.

**Old sub-steps that already shipped:**

- **Sub-steps 1–3** — audit, sectioned settings page, persistence + `settingsSchemaVersion` — shipped in **v1.5.1 "Broadsheet Final"** as the 6-submenu drawer (Lineup / Backend & keys / Audio / Critics / Export / Appearance).
- **Sub-step 7 (a11y audit)** — SR labels on every icon-only button, `aria-pressed` on filter pills, `role="log" aria-live="polite"` on the feed, universal `:focus-visible` rings — shipped in **v1.5.4 "The Sweep"** ([PR #31](https://github.com/Sethmr/peanut.gallery/pull/31)).

**Old sub-steps still open (can ride any release):**

- **Sub-step 5 (empty-state companions)** — partially shipped in v1.6.0 ([PR #76](https://github.com/Sethmr/peanut.gallery/pull/76)).
- **Sub-step 6 (Director debug panel reorganization)** — polished in v1.6.0 ([PR #77](https://github.com/Sethmr/peanut.gallery/pull/77)).
- **Sub-step 4 (Claude Design UX polish pass)** + **Sub-step 7 contrast check across Paper + Night** — still open as design-owned work, not engineering-blocking.

---

### v1.7.x "Smart Director GA"

The Director is the moat. v1.6.0 ships the LLM router as a flag-gated canary with Cerebras/Groq shadow validation; v1.7 promotes the LLM router to primary and retires the rule-based scorer to a thin safety-net. This is the load-bearing change of the v2.0 cycle — *Peanut Gallery without LLM routing* and *Peanut Gallery with LLM routing* are different products, and we're committing to the latter.

**Pre-requisite:** v1.6.0 canary data. Don't start this work until the analyzer (`npm run analyze:director-v3`) shows agreement Haiku↔Cerebras ≥ 85 %, p95 Cerebras 3–5× faster than Haiku, timeout rate < 2 %, and the 20-override-transcript sanity read looks like producer notes, not hallucinations.

**Sub-steps:**

1. **Re-pull the canary data** one more time on the day of work to confirm bands hold. If any band slipped, polish prompts in `lib/director-llm-v2.ts` first — don't retire the rule-based path until v3 is provably better, not just plausibly so.
2. **Per-pack `directorHint` calibration.** v1.5 / v1.6 set hints once and shipped. v1.7 revisits each pack's hints with canary data; tune any slot the router systematically under-picks.
3. **Swap Haiku → Cerebras as primary** *(contingent on canary result)*. If the agreement + latency story holds, Cerebras Llama 3.1 8B becomes the primary router and Haiku moves to shadow (or retires). If it doesn't, Haiku stays primary and Cerebras stays shadow indefinitely.
4. **Default-on, flag is the kill switch.** `ENABLE_SMART_DIRECTOR_V2` defaults to true; setting false reverts to v1.4 rule-based behavior for emergency rollback. Self-host docs explain when to flip it.
5. **Retire the rule-based scorer as primary.** `Director.decide` becomes "LLM picks; on null/timeout, fall through to a thin safety-net heuristic." The safety-net is intentionally dumber than today's full scorer — round-robin with a 5-second cooldown, no claim-density math, no pattern matching. Goal: avoid silent stalls, not compete with the LLM.
6. **Remove dead code paths.** The current `lib/director.ts` has complexity that only existed to score against the LLM. Once the LLM is primary, the scorer's pattern-matching tables, claim-density estimator, and per-trigger weights are removable. Aim to shrink `lib/director.ts` by > 50%.
7. **Update the fixture suite.** Every existing fixture currently asserts on rule-based output. Convert them to assert on LLM output (with the safety-net path as a separate, smaller suite). The harness now scores the new primary, not the old one.
8. **Update `BUILD-YOUR-OWN-BACKEND.md` §7-§8.** Cascade rules + persona prompts sections reference scoring formulas that will no longer exist. Rewrite as: "the router picks one persona via LLM; cascade rules apply unchanged downstream; here's the spec for implementing your own routing model if you don't want to use Anthropic/Cerebras."
9. **Cost note.** Smart Director adds ~$0.15/episode on Haiku (~$0.03 on Cerebras if that's the primary by this release). Document in `CONTEXT.md` cost table; surface in the side-panel debug footer.
10. **Tag `v1.7.0`.** Release notes lead with: "the rule-based director is gone. Long live the smart one."

**Touches:** `lib/director.ts` (large reduction), `lib/director-llm-v2.ts` (no longer optional), `lib/director-llm-v3-cerebras-v3prompt.ts` (possibly promoted from shadow to primary), `app/api/transcribe/route.ts` (race goes away — LLM is awaited unless killed), `lib/packs/*/personas.ts` (hint refinement), `scripts/test-director.ts` (fixture conversion), `scripts/fixtures/director/*.json` (re-baselined), `docs/BUILD-YOUR-OWN-BACKEND.md`, `docs/CONTEXT.md`.

**Risk:** if the LLM provider has a bad day, sessions go quiet. **Mitigation:** the safety-net heuristic exists for exactly that. Telemetry should page Seth (or at least log loudly) if the safety net is firing more than X% of ticks across all sessions.

---

### v1.8.x "Persona refinement sprint"

**Pre-requisite:** v1.7 canary must be steady. The persona refinement only works against a known-good router baseline — if the router's picking wrong personas, prompt tuning on those personas is measuring noise.

**Scope:** re-run every pack's system prompt against 100+ recent transcripts from the reference shows (Howard Stern clips, TWiST episodes, plus whichever other packs have shipped by then). For each persona, score on three axes:

1. *Did the right persona fire?* — Director's job; surfaced here only if a persona is systematically missing its moment because the Director is under-selecting it, which feeds a v1.7 hint-refinement loop.
2. *Did the persona sound like itself?* — the main focus. Compare output against the pack's `docs/packs/<pack>/RESEARCH.md` characterization.
3. *Did it avoid failure modes?* — political overreach (rule #6), impersonation slips, catchphrase overuse, etc.

Canonical planning doc: [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md). Ship iteratively as point releases (`v1.8.1`, `v1.8.2` per-persona) so each tune is independently roll-backable.

---

### ~~v1.9.x "Peanut Gallery Plus"~~ — shipped in v1.8.0 "The Press Pass"

**Retired slot (2026-04-22).** Plus shipped end-to-end in v1.8.0, one version earlier than planned. All four phases landed:

- **Phase 1 — scaffold (2026-04-21).** `lib/subscription.ts` + `/api/subscription/{status,manage,checkout,webhook}` routes + extension UI + one-off 15-minute free tier. Feature-flagged behind `ENABLE_SUBSCRIPTION=true`.
- **Phase 2 — persistent identity (SET-25, PR [#123](https://github.com/Sethmr/peanut.gallery/pull/123), 2026-04-22).** SQLite store via `better-sqlite3`, Luhn-checksum key generator, admin CLI (`npm run subscription:issue`).
- **Phase 3 — Stripe integration (SET-26, PR [#124](https://github.com/Sethmr/peanut.gallery/pull/124), 2026-04-22).** Real Stripe Checkout + manual HMAC webhook verification + all 5 event handlers. Live-mode wired + real-$8 smoke test 2026-04-22.
- **Phase 4 — email infrastructure (SET-27, PR [#119](https://github.com/Sethmr/peanut.gallery/pull/119), 2026-04-22).** Resend by default, Postmark drop-in fallback. Welcome / recovery / cancellation / magic-link templates.

**Post-ship follow-ups landed this session (2026-04-22):**
- Dedupe gate blocks duplicate checkouts with `409 ALREADY_SUBSCRIBED` + one-click recover-key modal.
- Four-mode access picker (Demo / Plus / My keys / Self-host) replaces the old three-way.
- Start Listening gates key-presence on mode, not URL.
- Dockerfile runs as root so SQLite can write to Railway's `/data` volume.

**Decisions (Seth, 2026-04-21, still load-bearing):** $8/month · 16 h/week · license-key identity · 15-minute one-off free · not a profit center · no account system. See [`SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) for the canonical architecture.

**Still open (not blocking):**
- DNS: `api.peanutgallery.live` CNAME at Railway (Namecheap). Once DNS resolves, the Stripe live webhook URL flips from the `*.up.railway.app` direct URL back to the subdomain.
- `/plus` Next.js route (marketing landing — currently 404 on the backend; static `/plus` exists on the GitHub Pages site but is orphaned).
- Live-mode subscription Customer Portal URL (`STRIPE_PORTAL_URL` env var).

**Anti-goals (explicit):**

- No advertising, ever. In any tier.
- No multi-seat / team / enterprise pricing pre-v2.0.
- No data mining. Feedback signals are opt-outable server-side (`DISABLE_FEEDBACK_LOGGING=true`).
- No price increases without 30 days' notice + pro-rata refund on the current period.

**Economics guardrails** ([full math](SUBSCRIPTION-ARCHITECTURE.md#economics)):

- At 2026-04 API rates, 16 h/week ≈ $19 in API costs. That's more than $8. Works because:
  - Most subscribers don't hit the cap (target: $8 fee against ~4 h/week of typical usage ≈ $4.80 API cost).
  - v1.7 GA + Deepgram alternatives will cut backend cost meaningfully.
  - "Not a profit center" means we accept thin margin (or slight loss) while the product finds its audience.
- **Watch signals:** API spend / MRR > 1.0 ratio, P95 subscribers crossing 12 h/week, cap-reached events > 20% of base.

---

### v1.10.x "Avatar stage 2"

Seth's call: 3D bobbleheads land here **if and only if** we can get a credible v1 in two days. If two days isn't enough, we ship the **maximum visual upgrade possible** in the same time budget instead — never half-built 3D. The goal is a "holy shit" visual moment between the v1.6.0 avatar stage 1 (Phong-shaded 2D peanuts, shipped) and the v2.0 launch, not a long animation pipeline.

**The 2-day gamble (preferred path):**

1. **Day 1 — Spike + decision.** Stand up Three.js inside the side panel. Load one peanut bobblehead (Howard) with: a baked rig, an idle bob, and a single "react" pose triggered on fire. Eval at end-of-day: does it look like a Peanut Gallery thing or a generic Three.js demo? If generic → drop to fallback path Day 2. If on-brand → continue.
2. **Day 2 — Pack rollout + animation hooks.** Replicate the rig across the four TWiST personas with their key items. Wire `Persona.bobblehead` schema (`modelSrc`, `idlePose`, `reactPose`, `prop`). Hook fire events to the react pose with a 600 ms decay back to idle. Performance budget: side panel render stays under 16 ms/frame at 60 fps on an M1.
3. **Tag the minor.** Release notes lead with: "the gallery now reacts in 3D."

**Fallback path (if Day 1 says "not credible"):** ship the **maximum** version of what 2 days *can* deliver. In priority order:

- **2.5D parallax mascots.** Layer the v1.5.3 mascot SVGs across 3-4 depth planes; CSS transform on mouse / fire events. ~80% of the bobblehead "wow" for ~10% of the work.
- **Lottie reaction loops.** Designer ships per-persona After Effects → Lottie JSON files; engineer wires them to fire events. Crisp at any DPR, animates through the reaction beat.
- **Animated GIF / WebP sprite sheets.** Lowest fidelity but zero runtime cost. Designer ships sheets; engineer swaps `<img src>` on fire events.
- **AI-generated MP4 reaction loops.** 1-2s seamless loops per persona × pack. Cheap to make, looks premium, no animation pipeline. Pre-cache and play on fire.

The fallback is not a failure — it's the same "visual moment" goal hit with a different tool. The v2.0 launch story doesn't need 3D; it needs *aliveness*.

**Touches:** `extension/sidepanel.html` (canvas/video slot), `extension/sidepanel.js` (animation hook on fire events), `extension/lib/bobblehead.js` (new — Three.js wrapper) **or** `extension/lib/parallax.js` / `extension/lib/lottie-host.js` / `extension/assets/reactions/*.mp4` depending on path, `lib/packs/*/personas.ts` (`bobblehead` or `reaction` field on Persona), `marketing/CLAUDE-DESIGN-BRIEF.md` (animation brief — designer source of truth).

**Risk:** scope creep on the 3D path. **Mitigation:** the Day 1 eval is binding; if Howard doesn't read as on-brand by EOD, switch paths Day 2 morning. No "one more day" extensions. The point of v1.10 is the visual upgrade, not the technology choice.

---

### ~~v1.8.0 "Peanut Mascots"~~ — absorbed into v1.5.3 "The Cast"

**Retired.** All 8 mascots shipped in v1.5.3 via a single-session push by Claude using hand-authored SVG (illustrated dumbbell-body peanuts with per-persona props), rather than the designer-pipeline approach the original sub-steps described. See the v1.5.3 entry in [`../CHANGELOG.md`](../CHANGELOG.md) and [PR #24](https://github.com/Sethmr/peanut.gallery/pull/24) for the implementation.

Deltas from the original v1.8 plan worth knowing about:

- The `Persona.mascot` schema field the original plan described was **not added.** The mascot SVG is produced inline by `personaMascotHTML(personaId, packId)` in `extension/sidepanel.js` via a shared `buildPeanutSVG` helper with `bodyStops` / `bodyStroke` / `eyesLight` overrides. Packs define no mascot field; the function returns `null` for unknown combos and the UI falls back to block-letter initials.
- Animation shipped as CSS keyframe-only (idle bob + talk-wiggle on `.persona-bubble.speaking`), no Lottie / sprite-sheet pipeline.
- Director-trace integration (the original sub-step 6) is **not done** — trace still shows the old glyph, not the new mascot. Flagging as a follow-up for whichever release next touches the director trace surface.
- Mute-state "prop drops to the floor" flourish (original sub-step 5) is **not done** — today's mute state is greyscale + strike-through on the whole bubble. Follow-up.

The final prop mapping differs slightly from the designer reference list above:

| Slot | Howard prop | TWiST prop |
|---|---|---|
| Producer | Clipboard + blue ✓ (Baba Booey) | Spiral-bound reporter notebook (Molly) |
| Troll | Boiled peanut (no prop — state IS the character) | Red megaphone with sound-wave lines (Jason) |
| Sound FX | Purple DJ headphones (Fred) | B&W clapperboard with purple scene tag (Lon) |
| Joker | Amber-trimmed stand mic (Jackie) | Three-slice pie chart, amber dominant (Alex) |

---

## v2.0.0 "The Gallery" — launch

The brand moment. Everything from v1.5 → v1.10 stacks into a single coherent product: the Broadsheet UI, the polished settings, the LLM director (now the primary via v1.7 GA), the peanut mascots (v1.5.3) + avatar depth pass (v1.6 stage 1) + bobblehead-or-equivalent (v1.10 stage 2), the pack catalog, the subscription alternative (v1.9), and the distribution loop. v2.0 is when we stop iterating and ship the version that tells the whole story.

**Session recall + shareable snippet is a confirmed v2.0 launch feature.** It's the distribution loop — users reach back to a moment, clip the transcript + persona reactions into a Broadsheet-styled card, and post it. Zero new providers, fully client-side, plugs into the Markdown export already shipped in v1.5 and the `chrome.storage.local` groundwork shipped in v1.6.0. This lands with the launch, not after.

**Sub-steps:**

1. **Session recall + shareable snippet (launch feature).**
   - Persist sessions to `chrome.storage.local` (TTL 30d, FIFO eviction at 50 sessions).
   - New side-panel "📚 Past sessions" section, sorted reverse-chronological, each row a single-line title (video URL, time of day, session length, fire count).
   - Click a session → render its Markdown with a snippet-share affordance per quip cluster.
   - Each snippet renders to a canvas matching the Broadsheet aesthetic + mascots/bobbleheads (v1.5.3 + v1.9) + footer attribution.
   - Copy PNG to clipboard **or** download. No server round-trip.
   - Privacy note in settings: sessions are stored locally, never uploaded; "Clear all sessions" button.
2. **Full audit.** Walk every surface against a "first-time user from Jason's audience" persona. The README. The CWS listing. The marketing site. The first 60 seconds inside the side panel. Every transition, every error state, every empty state.
3. **Bug fix sweep.** Triage every open issue, every TODO comment, every "we'll fix this later" deferred from v1.5–v1.9. Fix or formally defer with a v2.1 milestone.
4. **Performance pass.** p95 director-tick latency, p95 first-byte from Deepgram, side-panel render budget. Establish a baseline; fix anything > 2x last release's budget.
5. **Accessibility regression check.** Re-walk the v1.5.4 a11y pass (SR labels, `aria-pressed`, `role="log"`, `:focus-visible`, per [PR #31](https://github.com/Sethmr/peanut.gallery/pull/31)) against everything that landed since, plus add the contrast-across-themes check that hasn't happened yet.
6. **Marketing alignment.** New CWS listing copy, new screenshots, new walkthrough video. Coordinated with `Sethmr/peanut.gallery.site` for a landing-page refresh on launch day.
7. **Launch day.**
   - CWS upload of `peanut-gallery-v2.0.0.zip`.
   - Marketing site flips to the new hero.
   - TWiST submission follow-up post (the bounty has been the throughline since v1.0; close the loop publicly).
   - Sponsors thank-you in release notes.
8. **Tag `v2.0.0`.** Release notes lead with: "Peanut Gallery 2.0 — the gallery is open."

**v2.0 launch readiness checklist:**
- [ ] Session recall ships with Broadsheet snippet export + privacy copy
- [ ] CWS zip built, manifest at root, version matches tag
- [ ] CHANGELOG entry for v2.0.0 written
- [ ] Marketing site PR merged with launch-day hero
- [ ] Walkthrough video uploaded with chapter markers
- [ ] Press kit / `marketing/launch-2.0/` populated
- [ ] All v1.x stable; no regressions caught in dogfood week
- [ ] `docs/ROADMAP.md` updated with the post-v2.0 plan

---

## Deferred — off the critical path to v2.0

These were on the old roadmap and aren't on Seth's path. They stay alive as ideas but are not blocking v2.0:

- **Voice / TTS per persona** — provider bake-off + audio graph + ducking. Was old v1.6 Part 1. Defer until post-v2.0; voice is a real undertaking, not a feature add. Cost roughly doubles per session, so it also wants its own pricing conversation.
- **Clip-sharing / highlight export (MP4-based)** — was old v1.6 Part 2. The Broadsheet PNG snippet ships in v2.0; full canvas + MP4 export is a post-launch extension of the same surface.
- **Pack Lab visual authoring UI** — was old v1.7. Replaced for now by the curated pack approach; lab returns once the catalog is large enough to justify a self-serve surface.
- **Floating overlay (danmaku) mode** — was old v1.8 Part 1. Strictly additive over the side panel; a great post-v2.0 add when overlay-style consumption needs proving out against the Broadsheet baseline.
- **Event-driven triggers (chapters, ad-breaks, live-chat spikes, manual bookmarks)** — was old v1.8 Part 2. Independent of v2.0 launch.
- **Personal context / "About me" persona memory** — was old v1.8 Part 3. Wants a privacy-policy update and a prompt-injection mitigation; defer past launch.

---

## Future framework + dependency upgrades

**Policy (per Seth, 2026-04-19):** being current is good, but no unproven-tech experiments on tasks he didn't ask about. Major-version bumps with a real migration cost queue here, typically for a post-v2.0 upgrade window. Bot PRs (Dependabot, contributors) only merge now if they add value *now*; otherwise they're closed with a link to this section and a matching `.github/dependabot.yml` ignore rule so they don't keep re-opening. See [`feedback_no_unprompted_framework_experiments.md`](../../.auto-memory/feedback_no_unprompted_framework_experiments.md) for the triage rubric.

**Currently queued:**

- **Tailwind CSS 3 → 4.** Full engine rewrite (Oxide, new config format, `@apply` behavior changed, scanner rewritten, some plugins broken). Needs a scoped migration branch — content scanning config, `@apply` usages, plugin compatibility. Queue for post-v2.0 to avoid destabilizing the Broadsheet rebrand shipping in v1.5. Closed from Dependabot `PR #5`.
- **Next.js 15 → 16.** Breaking changes in the app router, middleware, image component, and route handlers. The backend's `app/api/*` routes are load-bearing for the hosted extension path — a break here takes production down. Queue for post-v2.0; pair with the Path-2 URL work if timelines overlap. Closed from Dependabot `PR #2`.
- **@anthropic-ai/sdk 0.39 → 0.90.** ~50 minor versions of API churn (tool use, streaming, message batches, beta APIs). `lib/director-llm.ts` and every persona caller will need review. Queue for post-v2.0; revisit after the v1.7 Smart Director GA canary clears so the upgrade lands against a known-good baseline. Closed from Dependabot `PR #4`.
- **@types/node 22 → 25.** Lower-risk (types only), but 3 major versions deserves a look. If typecheck survives, merge now as a small PR; if not, queue. *Open Dependabot PR #6.*
- **lint-stack group bump.** Low-risk. Merge now if `npm run check` is clean. *Open Dependabot PR #3.*

When an entry here graduates into an active sprint, move it out of this queue and into the appropriate release section.

---

## v2.x.x — Continuous model improvement (post-launch, pre-user-direction)

**Frame:** after 2.0 ships, we keep improving the product's engine — director + personas — while we wait for user behavior to tell us what 3.0 is. This is the quiet, non-showy work that makes the gallery *smarter* per session without changing the surface.

**Scope (unranked, pull the next thing when the previous one's canary is clean):**

- **Persona deep-research upgrades.** Re-run the v1.9 "persona iteration sprint" pattern against every shipping persona. For each:
  - Re-read the system prompt against 5+ recent session transcripts.
  - Score on three axes: *did the right persona fire?* (Director's job), *did the persona sound like itself?*, *did it avoid failure modes in `docs/packs/<pack>/RESEARCH.md`?*
  - Tighten prompt. Diff against the same 5 transcripts. Ship in a point release.
- **Director model upgrades.** Prompt iteration on the LLM router. Try stronger / cheaper models as they ship. Fold routing telemetry from the v1.7 canary into the prompt's few-shot examples. Tune the 400 ms race budget against the latest provider p50s.
- **`directorHint` pass per pack.** Review every pack's `directorHint` fields against routing telemetry. Rewrite anything that isn't measurably earning its keep.
- **One new pack per cycle** *(only if a user signal says we need it)*. Default is: improve what's shipping, not expand the catalog, until user demand names the next pack.
- **Anything Claude spots as valuable** mid-cycle — infra wins, perf wins, a11y wins, a cheap delight. If it's not user-driven it has to be small, reversible, and ship in a point release, not a minor.

**Anti-goals for v2.x:**
- No new surface-area features (that's v3.0's job once users define it).
- No scope-creeping "while we're in there" rewrites.
- No speculative packs. The catalog only grows when users ask.

**Cadence:** point releases (`v2.0.1`, `v2.0.2`…) every ~2 weeks as improvements clear their canary. Minors (`v2.1`, `v2.2`) only when a cluster of work makes a story worth writing release notes about.

---

## Horizon — post-v2.0

### v3.0.0 — User-driven, direction TBD

**Deliberately unspecified.** The goal for 3.0 is to let the users of 2.0 tell us what it should be. We don't pre-plan it.

**What we're watching for:** the thing users keep asking for in Discussions / email / reviews that we haven't built. The thing session-recall telemetry says people *want* to do next but can't. The thing that would turn "cool extension" into "thing I can't watch podcasts without."

**What we do in the meantime:** ship v2.x improvements, read the feedback, and resist the urge to guess. If Claude spots something so valuable it can't wait, it gets pitched — not shipped — and goes to Seth for the call.

**Soft guess at what 3.0 probably is** (for sequencing conversations only, not a commitment): voice, clip-to-MP4, personal-context memory, overlay mode, or Pack Lab — whichever one users collectively point to. 3D bobbleheads have been absorbed into v1.9 (or its fallback), so the headline visual is already carried.

### v3.x.x — LiveCC / streaming-multimodal absorption

**Not dated. Not scoped.** If open-weight streaming multimodal models (LiveCC family or successors) reach production quality and hostable cost by 2027-ish, Peanut Gallery's Director becomes a routing shim in front of N streaming models instead of N Anthropic/xAI SDK calls. The v1.5 `pickPersonaLLM` interface + `TriggerDecision.source` metadata is already shaped to absorb that. No action today except: *do not regress the modularity.*

---

## Explicitly out of scope

- **Non-podcast YouTube verticals as a flagship feature.** Music videos, gaming streams, news clips. Tab-capture works there today, but persona pacing is tuned for podcast rhythm. Stays "supported, not marketed" until a pack is tuned for a different format.
- **Desktop/mobile app.** Chrome extension distribution covers 80%+ of use cases. Native apps are 10× the work for < 2× the audience.
- **Account system / login.** Keys-in-browser + optional hosted tier is the privacy posture. An account system is the wrong direction.
- **Third-party chat integration (Slack, Discord, etc.).** Adjacent surface; not core loop.

---

## How to start any of this

1. Re-read [`docs/CONTEXT.md`](CONTEXT.md) end-to-end.
2. Read the latest `docs/SESSION-NOTES-*.md` — state of the working tree + known quirks.
3. Check [`docs/STATE-OF-PRODUCT-2026-04-18.md`](STATE-OF-PRODUCT-2026-04-18.md) for the most recent audit.
4. Confirm scope + priority with Seth before writing code. Release boundaries are load-bearing — don't pull work forward without confirming.
