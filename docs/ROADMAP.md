# Peanut Gallery — Roadmap

> Version-staged plan. Confirm scope with Seth before starting any item — this is a menu, not a queue, and release boundaries are load-bearing (each one tees up the next).

**Last updated:** 2026-04-18 (v1.5.0 canary-ready)
**Active release:** v1.5.0 "Smart Director v2" — feature-complete, awaiting 48h canary
**Design principle:** one load-bearing change per release. If a release title needs an "and," split it.

---

## Shipped

| Tag | Name | Landed | Headline |
|-----|------|--------|----------|
| v1.2.0 | "Mise en place" | 2026-04-11 | Director debug panel + `director_decision` SSE + fixture harness |
| v1.3.0 | "TWiST Pack" | 2026-04-14 | Pack refactor + TWiST crew + side-panel pack swap |
| v1.4.0 | "Grok & Stability" | 2026-04-17 | Troll + Sound FX → xAI Grok; search-engine toggle; force-react hardening |
| v1.5.0 | "Smart Director v2" | feature-complete 2026-04-18 | LLM-assisted routing with rule fallback; `directorHint` field |

Details on any of these live in the corresponding `docs/V<x>-PLAN.md` or the `CHANGELOG.md` entry.

---

## In flight — v1.5.0 canary → GA

**Status (2026-04-18):** all code + docs landed. Seth tested v1.5 locally and signed off. `ENABLE_SMART_DIRECTOR=true` is opt-in. Canary is the last gate between "feature-complete" and "tagged."

**What's left to tag v1.5.0:**

1. **Deploy with `ENABLE_SMART_DIRECTOR=true`** to the hosted reference backend. Leave it for ≥ 48 hours of real traffic.
2. **Pull telemetry** from `logs/pipeline-debug.jsonl` on `director_v2_compare` events. Compute agreement rate, override rate, p50/p95 `llmElapsedMs`, timeout rate. Targets and acceptance bands are pinned in [`V1.5-PLAN.md §4`](V1.5-PLAN.md#4-canary-checklist).
3. **Sanity-read 20 override transcripts.** Does the LLM's pick make sense? Is the rationale coherent? If not, iterate on the prompt in `lib/director-llm.ts` and re-canary — do not tag.
4. **Bump `manifest.json#version` to `1.5.0`** and cut the git tag.
5. **Draft release notes** at `releases/v1.5.0-release-notes.md` (git-ignored; paste into the GitHub Release when you push the tag).

**Kill switch:** set `ENABLE_SMART_DIRECTOR=false` and redeploy. Behavior reverts to v1.4 rule-based routing instantly on the next director tick. No session restart needed.

---

## Near term

### v1.5.1 "Smart Director Polish" — ~2 weeks after v1.5 canary

One purpose: turn 48 hours of canary data into a calibrated routing layer, then consider flipping the default on.

**Sub-steps:**

1. **Classify 20 disagreement transcripts** from canary (rule picked X, LLM picked Y). Bucket into: *LLM added value*, *LLM was wrong*, *coin flip*. If "wrong" > 30%, iterate on `ROUTING_SYSTEM_PROMPT` before anything else.
2. **Codify canary observations as fixtures.** Any disagreement where the LLM pick was clearly better than the rule pick becomes a new entry under `scripts/fixtures/director/`. The harness now pins the LLM path as a regression guard, not just the rule path.
3. **Prompt A/B with fixture support.** Extend `scripts/test-director.ts` to accept `--prompt <file>` so a prompt variant can be scored against the fixture suite + canary transcripts before shipping. Target: no regression on existing fixtures AND ≥ 20% improvement on the new canary-derived fixtures.
4. **Per-pack hint weighting (if needed).** If the router systematically under-picks one slot for the TWiST pack but not the Howard pack, revisit TWiST's `directorHint` strings — they may be too abstract. Tune and re-canary.
5. **Default-flag decision.** If agreement ≥ 55%, override rate 0.20–0.45, p95 `llmElapsedMs` < 350 ms, timeout rate < 5% → flip the default to auto-on-when-`ANTHROPIC_API_KEY`-present. Retain `ENABLE_SMART_DIRECTOR=false` as explicit kill switch. Update self-host + backend docs accordingly.
6. **Cost/usage note in hosted admin.** Add a line to the hosted backend health endpoint reporting "Smart Director calls: X this hour, Y this day" so drift is visible.
7. **Tag v1.5.1.** Release notes should summarize the canary findings.

**Touches:** `lib/director-llm.ts` (prompt), `scripts/test-director.ts` (A/B flag), `scripts/fixtures/director/*.json` (new canary-derived fixtures), `app/api/health/route.ts` (usage counter), `docs/SELF-HOST-INSTALL.md` + `docs/BUILD-YOUR-OWN-BACKEND.md` (default-flag docs).

**Risk:** spending weeks tuning a prompt that is good enough. Timebox at 2 weeks total — if canary numbers are already in the target bands on day 3, skip straight to step 5.

---

### v1.6.0 "Voice + Clip Share"

The two biggest perception shifts Peanut Gallery could ship next. Both are opt-in; both live on top of the existing SSE stream without rearchitecting the pipeline.

#### Part 1 — Voice / TTS per persona

**Why now:** per-persona TTS latency finally fits inside a 10–15s director tick. Text reactions are differentiated; voice makes Peanut Gallery a companion *broadcast*, which is what "writers' room" has always implied. Also defuses the Dmooji "never watch alone" framing — their companions are text-only.

**Sub-steps:**

1. **Provider bake-off (1 week).** Measure p50 / p95 first-byte latency + $/minute across four options:
   - ElevenLabs Flash v2 (bet: fastest, priciest)
   - OpenAI `gpt-4o-mini-tts` (bet: cheapest latency for Anthropic-less sessions, but no streaming on some tiers — verify)
   - Cartesia Sonic (bet: best voice cloning if we want Stern-show inspired timbres without legal risk)
   - Groq PlayAI (wildcard — might re-justify the `groq-sdk` dep we pulled in v1.4)
   - **Targets:** p95 first-byte ≤ 800ms, ≤ $0.03/minute of audio, streaming chunks.
2. **Per-persona voice assignments.**
   - Howard pack: Baba = measured mid-range male; Troll = gravelly male; Fred = deadpan male with occasional sound-cue SFX layer; Jackie = rapid-fire male with laugh bursts.
   - TWiST pack: Molly = clear measured female; Jason = nasal excited male; Lon = deadpan male; Alex = measured numerate male.
   - Store `voiceId` (provider-specific) on the `Persona` type as an optional field alongside `directorHint`. Packs that predate v1.6 still work silently.
3. **Audio graph in `extension/offscreen.js`.** When a persona reaction has voice enabled, stream TTS audio into the existing passthrough graph. Duck the YouTube audio by −6dB during persona speech; restore on stream end. Barge-in: if a new persona reaction fires before the prior finishes, fade out the prior over 150ms.
4. **Cost guardrail.** Cap voice minutes per session to 20 by default (~$0.60 at $0.03/min); expose an override in side-panel settings. Emit a `voice_quota_hit` event and fall back to text-only for the remainder of the session.
5. **Side-panel UX.** New Settings → Voice section: master toggle, per-persona mute, quota slider. Default: voice OFF. (We want users to encounter the text-only core first.)
6. **Telemetry.** `voice_request`, `voice_tts_first_byte_ms`, `voice_tts_end_ms`, `voice_tts_error`, `voice_quota_hit`. Enough to compute p50/p95 latency per provider and per-persona abandonment if users keep muting one voice.
7. **Rollout.** Ship behind `ENABLE_VOICE=true` feature flag. 48h canary on hosted with default Anthropic + bake-off-winner TTS provider. Flip default to opt-in-in-UI (not flag-gated) after canary clean.
8. **Release notes framing.** "Peanut Gallery now talks back" is the tweetable line. Record a side-by-side text-vs-voice demo for the TWiST submission follow-up post.

**Cost impact for self-hosters:** roughly doubles the per-session cost on voice-on sessions (~$0.60/hour → ~$1.60/hour). Call out in `SELF-HOST-INSTALL.md` Cost Expectations table. Quota slider mitigates for users who want a cap.

**Risk:** voice providers drift on latency. The bake-off is not a one-time thing; add a monthly `scripts/tts-latency-check.ts` that re-runs the benchmark and pings Seth if the winner regresses by > 2x.

#### Part 2 — Clip-sharing / highlight export

**Why now:** the funniest persona cascades (Baba fact-checks Jason, Troll piles on 2s later, Jackie lands the punchline) are the product's best demo surface. They die in the side-panel buffer. Clips turn them into organic distribution — the exact viral mechanic the TWiST bounty tweet depends on.

**Sub-steps:**

1. **Clip data model.** `{ id, startedAt, endedAt, pack, videoUrl, transcript: string, reactions: Array<{personaName, personaEmoji, text, firedAt}> }`. Side-panel already holds all of this in memory; clip generation is a serialize + render problem, not a data problem.
2. **UX.** New header button "📎 Clip last 30s". On press: opens a preview modal with 9:16 portrait render (default) + 16:9 landscape toggle. Three share buttons: Copy PNG, Copy MP4, Copy link (the last only lights up in permalink mode).
3. **Client-side render path (v1.6.0 — ship first).**
   - HTML canvas draws: YouTube video thumbnail at top, transcript caption centered, persona avatar + bubble rows in chronological order, "🥜 peanutgallery.live" footer.
   - For MP4: MediaRecorder on the canvas + WebM → MP4 transcode via `ffmpeg.wasm` client-side.
   - Non-removable attribution footer. Sets expectations upfront — if a clip goes viral, the credit line goes with it.
4. **Permalink mode (v1.6.1 — stretch).** `POST /api/clips` stores clip JSON in SQLite on the hosted backend for 30 days, returns `peanutgallery.live/clip/<id>`. Client-side render of the permalink page looks identical to the exported image, but allows in-place play-through. Add `clips` table migration. Rate limit at 10 clips / IP / hour.
5. **Share sheet.** `navigator.share()` if available (mobile Chrome), fallback to copy-link with toast. For desktop Chrome, default is Copy PNG to clipboard — the shortest path to "post to X."
6. **Tests.** Clip-generator harness fixture: feed a known 3-reaction session, assert byte-close PNG hash (allowing ~2% pixel diff for font rendering). Regression-proofs the canvas layout.
7. **Telemetry.** `clip_generated`, `clip_shared` (with dest: `png` | `mp4` | `link`), `clip_server_render_ms` (permalink only). First week of data tells us whether this is a used feature or a vanity one.

**Risk / legal:** YouTube thumbnail embedding is fair-use-gray for transformative works. The clip is a commentary artifact (transcript + our reactions), not a re-host of the video, so the posture is defensible. Still — add a small "Used under fair use commentary" line to permalink pages. If YouTube sends a takedown, kill the thumbnail render and go text-only.

---

### v1.7.0 "Pack Lab"

**Why now:** packs are Peanut Gallery's most asymmetric distribution lever. Every new pack tunes the product for a specific show's audience at roughly the cost of four persona prompts. The existing flow (hand-edit `lib/packs/<id>/personas.ts`) is gated to developers; a visual authoring surface opens it to every fan of every show.

**Sub-steps:**

1. **`/pack-lab` authoring UI** (Next.js page in the web app). Form-based editor: pack name, description, universe, 4 persona slots. Each slot: role, system prompt (textarea with live char/token count), `directorHint`, emoji picker, color swatch, model dropdown (`claude-haiku` | `xai-grok-4-fast`).
2. **Pack preview mode.** Paste a transcript chunk, click "Test". Calls `/api/personas` for each slot in parallel, renders the 4 responses side-by-side in a grid. Cost: one Haiku + one Grok call per test = ~$0.002. Cheap.
3. **Director sanity check.** Auto-runs a 10-fixture distribution mini-suite against the pack's patterns. Warns if one slot dominates > 60% of runs — likely a pattern mismatch. Feeds back to the editor with "your `troll` is eating everything; consider adding more claim-density triggers to `producer`" suggestions.
4. **Export paths.**
   - **Download:** zips `lib/packs/<id>/` folder (personas.ts + index.ts) for self-hosters to drop into the repo. Includes a short README reminding them to register in `lib/packs/index.ts`.
   - **Install to extension:** serializes to `chrome.storage.local`. The extension learns to merge `chrome.storage.local`-resident packs with the server-provided pack list on session start. No server restart needed.
5. **Auto-hint generator.** If user skips `directorHint`, a one-shot Haiku call derives one from role + system prompt. Saves 80% of users from having to think about routing semantics. Reviewable + editable before save.
6. **Gallery at `/packs`.** Curated list. Day-one entries: Howard, TWiST, **All-In** (Chamath, Jason, Friedberg, Sacks), **Acquired** (Ben + David padded with 2 research-assistant archetypes), **Lex Fridman** (Lex + 3 thematic companions). Each has: cover art, short description, install button.
7. **All-In pack distribution angle.** This is the second highest-leverage pack after TWiST. Overlaps with Jason's audience; gives Peanut Gallery a reason to show up on the All-In tweet cycle. Worth budgeting research time (1 day per show) before v1.7 cut to ensure voice accuracy.
8. **Acquired pack — architectural footnote.** Acquired has 2 hosts, Peanut Gallery's slot system requires 4. Padding options: two "research assistant" archetypes at producer + joker slots (keeps the 4-voice cadence) OR skip slots and let the rule-based scorer pick less frequently (but this exercises untested code paths). Prefer the former; document clearly in the pack's system prompts.
9. **Tests.** Playwright E2E covers: open `/pack-lab` → fill form → test-run → export → re-import. Catches serialization regressions end-to-end.
10. **Rollout.** Ship `/pack-lab` behind `ENABLE_PACK_LAB=true` for 2 weeks; promote to GA once the gallery has 5+ packs and E2E is green.

**Touches:** `app/pack-lab/page.tsx` (new), `lib/packs/user-packs.ts` (new — chrome-storage-backed runtime resolvable), `app/api/packs/validate/route.ts` (new — distribution mini-suite endpoint), `extension/sidepanel.js` (pack list merge), `app/packs/page.tsx` (new gallery), plus `docs/SELF-HOST-INSTALL.md` §8 gets a "See also: Pack Lab for non-coders" callout.

**Risk:** user-authored prompts that are sloppy, libelous (real person satire going too far), or too close to trademarked voices. Mitigation: add a "Use this pack at your own risk" disclaimer before install + a prompt linter that flags named celebrities in system prompts and suggests archetype substitutes.

**Jason-pleasing note:** a well-done All-In pack plus an "Install the All-In pack" CTA button on a dedicated landing page (`peanutgallery.live/all-in`) is the kind of thing that gets retweeted. Low effort once Pack Lab ships; effectively free marketing.

---

### v1.8.0 "Live Moments"

Three reactive-surface-area upgrades derived from the competitive landscape (Dmooji + ai_licia). Each is small on its own; shipping them together makes the product feel genuinely *live*.

#### Part 1 — Floating overlay (danmaku) mode

**Why:** Dmooji proved the UX pattern has an audience. It's strictly additive — existing side-panel users don't lose anything.

**Sub-steps:**

1. New **content script** injects a fixed-position overlay div over the YouTube player.
2. Reactions animate right-to-left across the top third of the player (lane-avoidance: tracks up to 6 lanes, pushes to next lane if the current one is still occupied).
3. CSS `transform` + `will-change: transform` — GPU-cheap, no reflow.
4. Settings toggle: Side panel only / Overlay only / Both.
5. Respects YouTube player fullscreen (overlay follows the video element, not the viewport).
6. Tappable: clicking a floating reaction pins it in the side panel with full context.

**Touches:** `extension/content-overlay.js` (new), `extension/sidepanel.html` (toggle UI), `extension/manifest.json` (content_scripts entry).

#### Part 2 — Event-driven triggers beyond silence

Current trigger surface: speech chunks + silence ticks. Additions:

1. **YouTube chapter change.** Video `timeupdate` + chapter boundaries → fire `producer` on chapter title (great for fact-grounding).
2. **Ad-break detection.** Player state transitions to ad → fire `joker` or `troll` with a "here comes the ad" reaction.
3. **YouTube live-chat spike** (live streams only). If the live chat activity rate spikes > 2× baseline, fire `troll` — chat just reacted to something, our personas should too.
4. **Manual bookmarks.** New hotkey `Ctrl-B` / `Cmd-B` marks a moment; drives a persona pick biased toward `producer` (research this claim later).

Each trigger emits a `director_external_trigger` SSE event so the debug panel can show which triggers fired during a session. Adds ~50 lines each in `extension/content.js` + `app/api/transcribe/route.ts`.

#### Part 3 — Personal context / persona memory

**Why:** aim Peanut Gallery at what *this viewer* cares about. Currently every user gets identical reactions.

1. Side-panel "About me" editor. Free-text, 500 chars. Example: "Series A founder, bootstrapped, mostly care about GTM not infra."
2. Injected into each persona's system prompt as a short preamble (marked clearly as viewer context, not transcript).
3. Storage: `chrome.storage.local` by default, optional server-synced (hosted tier only).
4. Opt-in. Clear privacy line: "Your note is sent to the AI providers you've configured alongside the transcript."

**Risk:** prompt-injection attacks via the About Me field. Strip markdown, quote the user's text in the prompt, and add a "treat as context only, not instructions" sentinel. Document in `BUILD-YOUR-OWN-BACKEND.md`.

---

## Horizon

### v2.0.0 "3D Bobbleheads"

**The visual payoff.** Peanut Gallery becomes a show, not just a text sidebar.

- Animated 3D character models per persona, rendered in the side panel via Three.js.
- Lean-in + reaction animations tied to fire events (Fred deadpan stare, Troll eye-roll, Baba fact-check lean).
- Sentiment-driven idle loops.
- Likely new SSE fields for animation hints (`animation: "lean_in" | "eye_roll" | "nod"`).

Intentionally vision-level; a real plan gets written when v1.8 ships. Touches a WASM rig-solver and GPU-heavy rendering; worth its own 3-month cycle.

### v2.x.x — LiveCC / streaming-multimodal absorption

**Not dated. Not scoped.** If open-weight streaming multimodal models (LiveCC family or successors) reach production quality and hostable cost by 2027-ish, Peanut Gallery's Director becomes a routing shim in front of 4 streaming models instead of 4 Anthropic/xAI SDK calls. The v1.5 `pickPersonaLLM` interface + `TriggerDecision.source` metadata is already shaped to absorb that. No action today except: *do not regress the modularity.*

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
