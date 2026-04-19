# Peanut Gallery — Roadmap

> Version-staged plan. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

**Last updated:** 2026-04-19 (v1.5.0 "The Broadsheet" feature-complete, awaiting canary + CWS upload)
**Active release:** v1.5.0 "The Broadsheet" — Smart Director v2 + tabloid side-panel rebrand + Path-2 URL transition readiness
**Design principle:** one load-bearing change per release. If a release title needs an "and," split it. (v1.5 is the exception — Smart Director v2 + the Broadsheet rebrand shipped in the same window because both needed the CWS review cadence.)

---

## Shipped

| Tag | Name | Landed | Headline |
|-----|------|--------|----------|
| v1.2.0 | "Mise en place" | 2026-04-11 | Director debug panel + `director_decision` SSE + fixture harness |
| v1.3.0 | "TWiST Pack" | 2026-04-14 | Pack refactor + TWiST crew + side-panel pack swap |
| v1.4.0 | "Grok & Stability" | 2026-04-17 | Troll + Sound FX → xAI Grok; search-engine toggle; force-react hardening |
| v1.5.0 | "The Broadsheet" | feature-complete 2026-04-19 | Smart Director v2 (LLM-assisted routing + rule fallback) + tabloid side-panel rebrand (mute-a-critic, night theme, Markdown export) + Path-2 URL transition readiness |

Details on any of these live in the corresponding `docs/V<x>-PLAN.md` or the `CHANGELOG.md` entry.

---

## In flight — v1.5.0 canary → tag → CWS upload

**Status (2026-04-19):** all code + docs landed. CWS-ready `.zip` built at `releases/peanut-gallery-v1.5.0.zip`. `ENABLE_SMART_DIRECTOR=true` is opt-in. Two gates remain between "feature-complete" and "on the store."

**Narrated walkthrough:** https://youtu.be/WPyknI7-N5U — Seth walks through the LLM-assisted router, the 400ms race, the rule-based fallback, and what changed since v1.4. Embedded on the landing page at `#walkthrough` and exposed as a `VideoObject` in the site's JSON-LD.

**What's left to tag v1.5.0:**

1. **Deploy with `ENABLE_SMART_DIRECTOR=true`** to the hosted reference backend. Leave it for ≥ 48 hours of real traffic.
2. **Pull telemetry** from `logs/pipeline-debug.jsonl` on `director_v2_compare` events. Compute agreement rate, override rate, p50/p95 `llmElapsedMs`, timeout rate. Targets and acceptance bands are pinned in [`V1.5-PLAN.md §4`](V1.5-PLAN.md#4-canary-checklist).
3. **Sanity-read 20 override transcripts.** Does the LLM's pick make sense? Is the rationale coherent? If not, iterate on the prompt in `lib/director-llm.ts` and re-canary — do not tag.
4. **Cut the `v1.5.0` git tag.** Manifest version already matches.
5. **Upload the `releases/peanut-gallery-v1.5.0.zip` to Chrome Web Store.** Refreshed listing copy lives at `marketing/cws-listing.md`.
6. **Coordinate the Path-2 URL flip** (apex → marketing site, `api.peanutgallery.live` → backend) with the CWS review window. See `releases/v1.5.0-release-notes.md` for the 6-step walkthrough.

**Kill switch:** set `ENABLE_SMART_DIRECTOR=false` and redeploy. Behavior reverts to v1.4 rule-based routing instantly on the next director tick. No session restart needed.

---

## Path to v2.0 — Seth's road, 2026-04-19

The releases below are the explicit sequence Seth has chosen on the way to the v2.0 launch ("The Gallery"). Each maps onto one numbered step in his plan; release boundaries are still load-bearing — confirm scope before pulling work forward. The deferred features that previously held v1.6 / v1.7 / v1.8 (voice, clip share, pack lab, live overlay) move to [Deferred](#deferred--off-the-critical-path-to-v20) below; they're still good ideas, just not on the critical path.

| Step | Release | Theme | Status |
|------|---------|-------|--------|
| 1 + 2 | v1.5.0 → v1.5.1 | "The Broadsheet" + "Broadsheet Final" — finish the new UI, clean out the legacy web app, verify everything works | v1.5.0 feature-complete; v1.5.1 next |
| 3 + 4 | v1.6.0 | "Settings Pane" — proper settings surface + UI/UX polish pass | Planned |
| 5 | v1.7.0 | "Smart Director GA" — LLM director the only director; static rule-based path retired | Planned |
| 6 | v1.8.0 | "Peanut Mascots" — illustrated peanut avatars per persona, each holding their signature prop | Planned |
| 7 | v1.9.0 | "Bobbleheads (Stretch)" — 2-day attempt at 3D peanut bobbleheads; max-credible fallback if not | Planned |
| 9 + 10 | v2.0.0 | "The Gallery" — audit, refine, ship session recall + shareable snippet, launch | Horizon |
| 8 (ongoing) | v2.x.x | Director + persona model improvements while we wait for user-driven 3.0 direction | Post-launch |
| TBD | v3.0.0 | **User-driven** — direction defined by what 2.0 users ask for, not by us | TBD |

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

### v1.6.0 "Settings Pane" — Steps 3 + 4

The Broadsheet shipped with mute toggles, theme toggle, and audio routing wired into the same gear-icon drawer. That worked for v1.5; it stops scaling the moment we add a fifth or sixth setting (per-persona model overrides, voice toggles when those land, debug-trace verbosity, etc.). Step 3 carves out a real settings surface; step 4 is the open-ended UI/UX polish pass that a real settings surface always invites.

**Sub-steps:**

1. **Audit the current gear-icon drawer.** What's settings-shaped (theme, mutes, server URL, API keys, search engine, audio mode), what's session-shaped (start/stop, force-react), what's reference-shaped (audio routing guide). Move only the first bucket; leave the rest where they live.
2. **New Settings page.** Side-panel-native (not a popup). Sectioned: **Appearance** (theme, type-scale if Claude Design wants it), **Personas** (per-persona mute, future per-persona model override), **Backend** (server URL, hosted vs self-hosted, search-engine toggle), **Keys** (the existing API-keys block, isolated). One row per setting; descriptions sit underneath labels, not in tooltips.
3. **Settings persistence.** Same `chrome.storage.local` single-field-write pattern from v1.5. Race-safe against `loadSettings`. Add a `settingsSchemaVersion` field so future migrations have a hook.
4. **UX polish pass — Claude Design owns the visual decisions.** Engineering-side I'll set up the surfaces, the affordances, and the keyboard nav (Tab order, Esc closes drawer, Enter on a focused row activates). Palette / type / composition stay in the design brief — see [`marketing/CLAUDE-DESIGN-BRIEF.md`](../marketing/CLAUDE-DESIGN-BRIEF.md).
5. **Empty-state and error-state polish.** Wire Quiet (already exists) gets companion states for: no API keys configured, hosted backend unreachable, audio capture denied, no pack selected. Each state has one CTA.
6. **Director debug panel reorganization.** It currently lives in the gear drawer as a power-user toggle. v1.6 promotes it to its own collapsible footer section that's hidden by default but discoverable.
7. **Accessibility audit.** Screen reader labels on every toggle, focus rings on every interactive element, contrast check against both Paper and Night themes.
8. **Tag `v1.6.0`.** Release notes: "the Broadsheet, but you can find things in it now."

**Touches:** `extension/sidepanel.html` (large refactor of the drawer markup), `extension/sidepanel.js` (`renderSettings`, schema version, new state machine), `extension/sidepanel.css` if we split it (currently inline). No backend changes.

**Risk:** every UI rebuild is a chance to regress what already works. Take screenshots of v1.5.1 before starting; check them at every commit.

---

### v1.7.0 "Smart Director GA" — Step 5

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

### v1.8.0 "Peanut Mascots" — Step 6

The brand moment. Today personas show as initial-circles with a corner glyph. v1.8 replaces that with illustrated peanut characters — each persona is a peanut holding their signature prop. This is *literally* the Peanut Gallery.

The visual decisions (illustration style, palette, the actual rendered peanut) are Claude Design's. Engineering owns the system that loads, renders, animates, and ships them.

**Sub-steps (engineering scope only — designer scope tracked in [`marketing/CLAUDE-DESIGN-BRIEF.md`](../marketing/CLAUDE-DESIGN-BRIEF.md)):**

1. **`Persona.mascot` schema.** New optional field on the `Persona` type:
   ```ts
   mascot?: {
     idleSrc: string;       // /icons/mascots/<pack>/<slot>-idle.svg
     reactSrc: string;      // /icons/mascots/<pack>/<slot>-react.svg
     prop: string;          // human-readable: "clipboard", "microphone", "soundboard"
     palette: { ink: string; accent: string }; // designer-supplied
   }
   ```
   Packs that predate v1.8 still work — `buildPersonaAvatars` falls back to today's initials path when `mascot` is undefined.
2. **Asset pipeline.** Mascots ship as SVG (vector — scales cleanly to whatever sizes the side panel and future surfaces need). Stored under `extension/icons/mascots/<pack>/`. Manifest references stay zero (we don't need them in `web_accessible_resources` since the side-panel page loads them directly).
3. **Prop-as-routing-signal (optional, behind a hint).** Each mascot's `prop` becomes the visual shorthand for the persona's role — clipboard = fact-checker, mic = joker, soundboard = soundfx, megaphone or bullhorn = troll. Prop assignment is the designer's call but engineering surfaces a `slotProp` map so it stays consistent across packs.
4. **Reaction animation hooks.** Mascot has two states: `idle` and `react`. On every fire event, the mascot swaps to `react` for ~1.2s then settles back. CSS keyframe animation, GPU-cheap. No JS animation engine required.
5. **Mute state visualization.** Today: greyscale + strikethrough on the initials circle. v1.8: greyscale + strikethrough on the mascot, plus the prop drops to the floor of the avatar bounding box (visual cue that the mascot is "off duty").
6. **Director-trace integration.** When a persona fires, the trace row shows the mug + prop. When the LLM rationale references a prop ("clipboard cited a date error"), the trace highlights it — closes the loop between the visual identity and the routing reasoning.
7. **Howard pack mascot prop list (designer reference, engineering captures here for traceability):**
   - Producer / Baba Booey: clipboard or fact-check stamp
   - Troll: bullhorn or pitchfork
   - Sound FX / Fred: soundboard or sound-effect button
   - Joker / Jackie: microphone or comedy notebook
8. **TWiST pack mascot prop list (same caveat):**
   - Producer / Molly Wood: notepad or microphone
   - Troll / Jason Calacanis: cap-table spreadsheet or "fund" stamp
   - Sound FX / Lon Harris: chyron / lower-third graphic
   - Joker / Alex Wilhelm: TWiST data chart
9. **Tag `v1.8.0`.** Release notes lead with: "the gallery is finally a gallery."

**Touches:** new `extension/icons/mascots/` tree, `extension/sidepanel.html` (markup for new avatar slot), `extension/sidepanel.js` (`buildPersonaAvatars` rewrite), `extension/sidepanel.css` if it splits out, `lib/packs/*/personas.ts` (add mascot field), `marketing/CLAUDE-DESIGN-BRIEF.md` (mascot brief — designer source of truth).

**Risk:** illustration style drifts between packs and the visual identity feels inconsistent. Mitigation: lock the design language to the same constraints (pencil-line, single-prop, ink palette per pack) in the brief before any pack-2 illustration starts.

---

### v1.9.0 "Bobbleheads (Stretch)" — Step 7

Seth's call: 3D bobbleheads land here **if and only if** we can get a credible v1 in two days. If two days isn't enough, we ship the **maximum visual upgrade possible** in the same time budget instead — never half-built 3D. The goal is a "holy shit" visual moment between the v1.8 mascots and the v2.0 launch, not a long animation pipeline.

**The 2-day gamble (preferred path):**

1. **Day 1 — Spike + decision.** Stand up Three.js inside the side panel. Load one peanut bobblehead (Howard) with: a baked rig, an idle bob, and a single "react" pose triggered on fire. Eval at end-of-day: does it look like a Peanut Gallery thing or a generic Three.js demo? If generic → drop to fallback path Day 2. If on-brand → continue.
2. **Day 2 — Pack rollout + animation hooks.** Replicate the rig across the four TWiST personas with their key items (clipboard / cap-table / chyron / data-chart). Wire `Persona.bobblehead` schema (`modelSrc`, `idlePose`, `reactPose`, `prop`). Hook fire events to the react pose with a 600 ms decay back to idle. Performance budget: side panel render stays under 16 ms/frame at 60 fps on an M1.
3. **Tag `v1.9.0`.** Release notes lead with: "the gallery now reacts in 3D."

**Fallback path (if Day 1 says "not credible"):** ship the **maximum** version of what 2 days *can* deliver. In priority order:

- **2.5D parallax mascots.** Layer the v1.8 mascot art across 3-4 depth planes; CSS transform on mouse / fire events. ~80% of the bobblehead "wow" for ~10% of the work.
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
   - Each snippet renders to a canvas matching the Broadsheet aesthetic + mascots/bobbleheads (v1.8 + v1.9) + footer attribution.
   - Copy PNG to clipboard **or** download. No server round-trip.
   - Privacy note in settings: sessions are stored locally, never uploaded; "Clear all sessions" button.
2. **Full audit.** Walk every surface against a "first-time user from Jason's audience" persona. The README. The CWS listing. The marketing site. The first 60 seconds inside the side panel. Every transition, every error state, every empty state.
3. **Bug fix sweep.** Triage every open issue, every TODO comment, every "we'll fix this later" deferred from v1.5–v1.9. Fix or formally defer with a v2.1 milestone.
4. **Performance pass.** p95 director-tick latency, p95 first-byte from Deepgram, side-panel render budget. Establish a baseline; fix anything > 2x last release's budget.
5. **Accessibility regression check.** Re-walk the v1.6 a11y audit against everything that landed since.
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
