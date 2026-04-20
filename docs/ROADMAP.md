# Peanut Gallery — Roadmap

> Version-staged plan. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

**Last updated:** 2026-04-20 (v1.5.0 tagged + in CWS review; v1.5.1 merged to `main` via PR [#18](https://github.com/Sethmr/peanut.gallery/pull/18), tag pending; v1.5.2 "First Run" in flight — first-run tutorial)
**Active release:** v1.5.2 "First Run" — four-step Editor's Note tutorial that walks first-time users through the settings drawer
**Design principle:** one load-bearing change per release. If a release title needs an "and," split it. (v1.5 is the exception — Smart Director v2 + the Broadsheet rebrand shipped in the same window because both needed the CWS review cadence.)

---

## Shipped

| Tag | Name | Landed | Headline |
|-----|------|--------|----------|
| v1.2.0 | "Mise en place" | 2026-04-11 | Director debug panel + `director_decision` SSE + fixture harness |
| v1.3.0 | "TWiST Pack" | 2026-04-14 | Pack refactor + TWiST crew + side-panel pack swap |
| v1.4.0 | "Grok & Stability" | 2026-04-17 | Troll + Sound FX → xAI Grok; search-engine toggle; force-react hardening |
| v1.5.0 | "The Broadsheet" | tagged 2026-04-19; **in CWS review** | Tabloid side-panel rebrand (mute-a-critic, night theme, Markdown export) + Smart Director v2 **client scaffold** (server flag `ENABLE_SMART_DIRECTOR` still off — canary gate pending) + Path-2 URL transition readiness |
| v1.5.1 | "Broadsheet Final" | merged 2026-04-20; tag pending | 6-submenu settings drawer (Lineup / Backend & keys / Audio / Critics / Export / Appearance — absorbs v1.6 "Settings Pane" scope) + free-tier status strip + episode card + ON AIR + per-mug waveforms + rolling-window ticker + round mugs with category-colored borders |

Details on any of these live in the corresponding `docs/V<x>-PLAN.md` or the `CHANGELOG.md` entry.

---

## In flight — v1.5.2 "First Run" → merge → tag

**Status (2026-04-20):** tutorial code + manifest bump + CHANGELOG entry land on `develop`; `develop → main` release PR is the next step once Seth is ready.

**What v1.5.2 ships:** a first-run Editor's Note overlay that walks users through the v1.5.1 settings drawer in four steps (Welcome → Lineup → Backend & keys → Audio). Gated on a single `tutorialSeen` flag in `chrome.storage.local`; always skippable; always replayable via a new "Replay settings tour" row in the Appearance submenu. Spotlight ring pulses on the active target; `prefers-reduced-motion` opts out of the pulse. No backend changes.

**What's left to ship v1.5.2:**

1. **Self-merge the feature PR** to `develop` after `npm run check` passes.
2. **Open the `develop → main` release PR.** Body = CHANGELOG [1.5.2] entry grouped by commit type.
3. **Seth merges to `main`, cuts the `v1.5.2` git tag.** Manifest already matches.
4. **Wait on CWS** — do NOT upload v1.5.2 while v1.5.0 is still in review (still the same supersede-and-reset risk).

**Also pending from v1.5.1:** cut the `v1.5.1` git tag on `main` (release PR merged but no tag yet — can land before or after v1.5.2's tag, but each version should get its own tag for clean CHANGELOG/CWS traceability).

**Narrated walkthrough (v1.5.0):** https://youtu.be/WPyknI7-N5U — embedded on the landing page at `#walkthrough` and exposed as a `VideoObject` in the site's JSON-LD.

---

## Still outstanding from v1.5.0 — Smart Director server-flag canary

**v1.5.0 shipped the client scaffold only.** `ENABLE_SMART_DIRECTOR=true` on the hosted backend remains the gate to actually turn the LLM router on. This slipped out of v1.5.0's ship window and is now tracked as its own work item — it'll flip as part of v1.5.2 (or fold into v1.7 GA, Seth's call based on canary results).

**What's left:**

1. **Deploy hosted with `ENABLE_SMART_DIRECTOR=true`** for ≥ 48 hours of real traffic.
2. **Pull telemetry** from `logs/pipeline-debug.jsonl` on `director_v2_compare` events. Bands in [`V1.5-PLAN.md §4`](V1.5-PLAN.md#4-canary-checklist): agreement ≥ 0.55, override in [0.20, 0.45], p95 `llmElapsedMs` < 350 ms, timeout rate < 0.05.
3. **Sanity-read 20 override transcripts.** Rationale should read like a producer's note, not a hallucination.
4. If bands miss: iterate the prompt in `lib/director-llm.ts` and re-canary.
5. If bands hit: decide whether to cut v1.5.2 with the flag defaulted on, or hold until v1.7 GA (which retires the rule-based scorer entirely).

**Kill switch:** set `ENABLE_SMART_DIRECTOR=false` and redeploy. Reverts to rule-based routing instantly on the next tick. No session restart needed.

---

## Path to v2.0 — Seth's road

The releases below are the explicit sequence on the way to the v2.0 launch ("The Gallery"). Release boundaries are load-bearing — confirm scope before pulling work forward. The deferred features that previously held the old v1.6 / v1.7 / v1.8 slots (voice, clip share, pack lab, live overlay) moved to [Deferred](#deferred--off-the-critical-path-to-v20) below; they're still good ideas, just not on the critical path.

**Cleanup note (2026-04-20):** v1.6 "Settings Pane" landed early inside v1.5.1 (the 6-submenu drawer absorbed the whole scope). v1.8 "Peanut Mascots" landed early inside v1.5.3 (illustrated SVG peanuts across both packs, shipped by Claude in one session rather than blocked on a designer pipeline). Both version numbers are now retired — the next planned release is **v1.7 "Smart Director GA"**. The corresponding v1.6 / v1.8 subsections below have been collapsed to pointers at the matching CHANGELOG entry.

| Release | Theme | Status |
|---|---|---|
| v1.5.0 "The Broadsheet" | Broadsheet UI rebuild + Smart Director v2 scaffolding + Path-2 URL readiness | ✅ Shipped |
| v1.5.1 "Broadsheet Final" | 6-submenu settings drawer (**absorbs v1.6 "Settings Pane" scope**) + free-tier status strip + ON AIR strip + per-mug waveforms + rolling-window ticker + round mugs | ✅ Shipped |
| v1.5.2 "First Run" | Four-step Editor's Note onboarding tour + WIRE QUIET empty-state visibility fix | ✅ Shipped |
| v1.5.3 "The Cast" | Illustrated peanut mascots for all 8 personas (**absorbs v1.8 "Peanut Mascots" scope**) + two-card pack chooser + apex→www middleware + war-defense guardrail on fact-checkers | ✅ Shipped |
| v1.5.4 "The Sweep" | Janitorial pass — SEO refresh + legacy `/watch` deletion + side-panel a11y polish + ops logging + orphan-dep removal | 🟡 Draft PR [#37](https://github.com/Sethmr/peanut.gallery/pull/37); hold CWS upload until v1.5.3 clears review |
| **v1.7.0 "Smart Director GA"** | LLM director becomes the only director; static rule-based scorer retired. Prompt + calibration work following an external research brief. | **Next** |
| v1.9.0 "Bobbleheads (Stretch)" | 2-day gamble on 3D peanut bobbleheads with max-credible 2.5D / Lottie / sprite fallback | Planned |
| v2.0.0 "The Gallery" | Session recall + shareable snippet, full audit, CWS listing + marketing-site refresh, launch day | Horizon |
| v2.x.x | Continuous director + persona model improvements while we wait for user-driven v3.0 direction | Post-launch |
| v3.0.0 | **User-driven** — direction defined by what v2.0 users ask for, not by us | TBD |

### v1.5.1 "Broadsheet Final" — Steps 1 + 2

One purpose: get v1.5.0 across the finish line and remove the legacy web-app surfaces that the extension no longer needs.

**Sub-steps:**

1. **Complete the v1.5.0 canary loop** ([details](#in-flight--v150-canary--tag--cws-upload)). Pull telemetry on `director_v2_compare`, sanity-read 20 override transcripts, tag `v1.5.0`, upload the CWS zip.
2. **Verify every Broadsheet feature on hosted + localhost.** Mute-a-critic, paper/night theme, Markdown export, footer filter pills, role tags, persona tap → force-react, director-trace badge. Walk the §5 verification checklist in [`SESSION-NOTES-2026-04-18.md`](SESSION-NOTES-2026-04-18.md) against the v1.5 build, not the v1.4 build it was originally written against.
3. **Clean out the legacy web-app UI.** The Next.js `app/` tree currently still serves a `/watch` reference page that's been demoted to "abandoned prototype" in project memory. Surfaces to retire: `app/watch/`, the home page that points at it, any in-extension links that reach into the web app. Keep `app/api/*` (the backend the extension talks to). Update `docs/SELF-HOST-INSTALL.md` + `README.md` so self-hosters aren't told the web-app UI is a thing.
4. **Smart Director canary follow-through.** If the v1.5 canary bands clear cleanly, leave `ENABLE_SMART_DIRECTOR=true` on by default in v1.5.1 (the fuller flip happens in v1.7). If they don't, codify the disagreement transcripts as fixtures (the original v1.5.1 plan, now condensed).
5. **Tag `v1.5.1`** with release notes summarizing both the canary findings and the legacy-UI removal.

**Touches:** removal of `app/watch/page.tsx` and related components, `app/page.tsx`, `extension/sidepanel.html` (any "open in web app" affordance), `docs/SELF-HOST-INSTALL.md`, `docs/BUILD-YOUR-OWN-BACKEND.md`, `README.md`, `docs/CONTEXT.md`.

**Risk:** removing the web-app UI breaks the only browser-based way to demo the persona engine without the extension. Mitigation: keep `/api/personas` as the endpoint anyone can curl to demo the four voices on a string; document that path in the README "Build your own backend" section.

---

### ~~v1.6.0 "Settings Pane"~~ — absorbed into v1.5.1 + v1.5.4

**Retired.** The six sub-steps originally planned for v1.6 landed across two earlier releases:

- **Sub-steps 1–3** — audit, sectioned settings page, persistence + `settingsSchemaVersion` — shipped in **v1.5.1 "Broadsheet Final"** as the 6-submenu drawer (Lineup / Backend & keys / Audio / Critics / Export / Appearance). See the v1.5.1 entry in [`../CHANGELOG.md`](../CHANGELOG.md).
- **Sub-step 7 (a11y audit)** — SR labels on every icon-only button, `aria-pressed` on filter pills, `role="log" aria-live="polite"` on the feed, universal `:focus-visible` rings — shipped in **v1.5.4 "The Sweep"** ([PR #31](https://github.com/Sethmr/peanut.gallery/pull/31)).
- **Sub-step 5 (empty-state companions: no API keys / backend unreachable / audio denied / no pack selected)** — still open. Good next-tier polish candidate; small, self-contained, no regression surface.
- **Sub-step 6 (Director debug panel reorganization)** — still open, but Director-adjacent; hold until the ongoing Smart-Director research brief returns.
- **Sub-step 4 (Claude Design UX polish pass)** + **Sub-step 7 contrast check across Paper + Night** — still open as design-owned work, not engineering-blocking.

If any of the three still-open sub-items get picked up, they can ride with whichever release is in flight rather than waiting for a dedicated v1.6 cut. The version label itself is retired.

---

### v1.7.0 "Smart Director GA"

The Director is the moat. v1.5 shipped the LLM-assisted version behind a 400ms race; v1.7 makes it the only director and retires the static rule-based scorer. This is the load-bearing change of the v2.0 cycle — *Peanut Gallery without LLM routing* and *Peanut Gallery with LLM routing* are different products, and we're committing to the latter.

**Sub-steps:**

1. **Pre-flight check on canary data.** Before any code change: re-pull the `director_v2_compare` log, confirm agreement ≥ 55%, override rate is in [0.20, 0.45], p95 `llmElapsedMs` < 350 ms, timeout rate < 5%. If any band slips, polish the prompt in `lib/director-llm.ts` first; don't retire the rule-based path until the LLM path is provably better, not just plausibly so.
2. **Per-pack `directorHint` calibration.** v1.5 set hints once and shipped. v1.7 revisits each pack's hints with the canary data and tunes any slot the router systematically under-picks.
3. **Default-on, no flag.** `ENABLE_SMART_DIRECTOR` becomes the *kill switch* (defaults to true; setting false reverts to v1.4 behavior for emergency rollback). Self-host docs explain when to flip it.
4. **Retire the rule-based scorer as primary.** `Director.decide` becomes "LLM picks; on null/timeout, fall through to a thin safety-net heuristic." The safety-net is intentionally dumber than today's full scorer — round-robin with a 5-second cooldown, no claim-density math, no pattern matching. The point is to avoid silent stalls, not to compete with the LLM.
5. **Remove dead code paths.** The current `lib/director.ts` has a lot of complexity that only existed to score against the LLM. Once the LLM is the primary, the scorer's pattern-matching tables, claim-density estimator, and per-trigger weights are removable. Aim to shrink `lib/director.ts` by > 50%.
6. **Update the fixture suite.** Every existing fixture currently asserts on the rule-based output. Convert them to assert on the LLM output (with the safety-net path as a separate, smaller suite). The harness now scores the *new* primary, not the old one.
7. **Update `BUILD-YOUR-OWN-BACKEND.md` §7-§8.** The cascade rules and persona prompts sections both reference scoring formulas that no longer exist. Rewrite as: "the router picks one persona via LLM; cascade rules apply unchanged downstream; here's the spec for implementing your own routing model if you don't want to use Anthropic."
8. **Cost note.** Smart Director adds ~$0.15 per 2-hour episode. Document it in the CONTEXT cost table; surface it in the side-panel debug footer as "Director spend this session: $0.0X."
9. **Tag `v1.7.0`.** Release notes lead with: "the rule-based director is gone. Long live the smart one."

**Touches:** `lib/director.ts` (large reduction), `lib/director-llm.ts` (no longer optional), `app/api/transcribe/route.ts` (race goes away — LLM is awaited unless killed), `lib/packs/*/personas.ts` (hint refinement), `scripts/test-director.ts` (fixture conversion), `scripts/fixtures/director/*.json` (re-baselined), `docs/BUILD-YOUR-OWN-BACKEND.md`, `docs/CONTEXT.md`.

**Risk:** if the LLM provider has a bad day, sessions go quiet. Mitigation: the safety-net heuristic exists for exactly that. Telemetry should page Seth (or at least log loudly) if the safety net is firing more than X% of ticks across all sessions.

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

### v1.9.0 "Bobbleheads (Stretch)"

Seth's call: 3D bobbleheads land here **if and only if** we can get a credible v1 in two days. If two days isn't enough, we ship the **maximum visual upgrade possible** in the same time budget instead — never half-built 3D. The goal is a "holy shit" visual moment between the v1.5.3 mascots and the v2.0 launch, not a long animation pipeline.

**The 2-day gamble (preferred path):**

1. **Day 1 — Spike + decision.** Stand up Three.js inside the side panel. Load one peanut bobblehead (Howard) with: a baked rig, an idle bob, and a single "react" pose triggered on fire. Eval at end-of-day: does it look like a Peanut Gallery thing or a generic Three.js demo? If generic → drop to fallback path Day 2. If on-brand → continue.
2. **Day 2 — Pack rollout + animation hooks.** Replicate the rig across the four TWiST personas with their key items (clipboard / cap-table / chyron / data-chart). Wire `Persona.bobblehead` schema (`modelSrc`, `idlePose`, `reactPose`, `prop`). Hook fire events to the react pose with a 600 ms decay back to idle. Performance budget: side panel render stays under 16 ms/frame at 60 fps on an M1.
3. **Tag `v1.9.0`.** Release notes lead with: "the gallery now reacts in 3D."

**Fallback path (if Day 1 says "not credible"):** ship the **maximum** version of what 2 days *can* deliver. In priority order:

- **2.5D parallax mascots.** Layer the v1.5.3 mascot SVGs across 3-4 depth planes; CSS transform on mouse / fire events. ~80% of the bobblehead "wow" for ~10% of the work.
- **Lottie reaction loops.** Designer ships per-persona After Effects → Lottie JSON files; engineer wires them to fire events. Crisp at any DPR, animates through the reaction beat.
- **Animated GIF / WebP sprite sheets.** Lowest fidelity but zero runtime cost. Designer ships sheets; engineer swaps `<img src>` on fire events.
- **AI-generated MP4 reaction loops.** 1-2s seamless loops per persona × pack. Cheap to make, looks premium, no animation pipeline. Pre-cache and play on fire.

The fallback is not a failure — it's the same "visual moment" goal hit with a different tool. The v2.0 launch story doesn't need 3D; it needs *aliveness*.

**Touches:** `extension/sidepanel.html` (canvas/video slot), `extension/sidepanel.js` (animation hook on fire events), `extension/lib/bobblehead.js` (new — Three.js wrapper) **or** `extension/lib/parallax.js` / `extension/lib/lottie-host.js` / `extension/assets/reactions/*.mp4` depending on path, `lib/packs/*/personas.ts` (`bobblehead` or `reaction` field on Persona), `marketing/CLAUDE-DESIGN-BRIEF.md` (animation brief — designer source of truth).

**Risk:** scope creep on the 3D path. **Mitigation:** the Day 1 eval is binding; if Howard doesn't read as on-brand by EOD, switch paths Day 2 morning. No "one more day" extensions. The point of v1.9 is the visual upgrade, not the technology choice.

**Persona deep-research upgrades are explicitly NOT in v1.9.** They moved to v2.x continuous improvement (below) where they belong — they're a quiet quality lift, not a launch story.

---

## v2.0.0 "The Gallery" — Steps 9 + 10

The brand moment. Everything from v1.5 → v1.9 stacks into a single coherent product: the Broadsheet UI, the polished settings, the LLM director, the peanut mascots, the bobblehead (or equivalent) moment, and the pack catalog. v2.0 is when we stop iterating and ship the version that tells the whole story.

**Session recall + shareable snippet is a confirmed v2.0 launch feature.** It's the distribution loop — users reach back to a moment, clip the transcript + persona reactions into a Broadsheet-styled card, and post it. Zero new providers, fully client-side, plugs into the Markdown export already shipped in v1.5. This lands with the launch, not after.

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
