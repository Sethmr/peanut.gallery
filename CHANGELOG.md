# Changelog

All notable changes to Peanut Gallery are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); version numbers follow [SemVer](https://semver.org/).

## [Unreleased]

Tracks in-flight work for the next release.

## [1.5.2] — 2026-04-20 — "First Run"

A small onboarding release on top of v1.5.1's settings drawer. First-time users now get a four-step Editor's Note walkthrough the moment they open the side panel — Welcome → Lineup → Backend & keys → Audio — with a spotlight ring pulsing over the current step's target element and a single Skip/Next path. A "Replay settings tour" row in the Appearance submenu lets anyone re-run it later.

### Added
- **First-run tutorial overlay** (`extension/sidepanel.html` + `extension/sidepanel.js`). `#tutorialOverlay` carries an Editor's Note card (stamp-red slug + step counter + title + body + Skip/Next) and dims the panel via a backdrop at `z-index: 40` (above the drawer's 30). Four steps declared in `TUTORIAL_STEPS`: (1) masthead ⚙ — welcome; (2) Lineup tile — pack + cadence; (3) Backend & keys tile — free tier + BYOK; (4) Audio tile — passthrough gotcha + replay-anytime hint. Each step's `onEnter` flips the drawer to the right state (opens it + resets to menu view) so the spotlight always aims at something visible; `requestAnimationFrame` defers the `.tut-target` class by one paint so the target has rendered into the flow before we highlight it.
- **Spotlight pulse** — `.tut-target` gets a 3px stamp-red outline that animates between `--stamp` and `--yellow` on a 1.6s loop. `outline-offset: 3px` keeps it from shifting layout; `pointer-events: none` on the target prevents mid-tour clicks from desyncing the card from what's actually open. `prefers-reduced-motion` disables the animation but keeps the outline.
- **"Replay settings tour" row in Appearance** (`#replayTutorialBtn`). Closes the drawer first, then `requestAnimationFrame(startTutorial)` so the drawer's `display: none` has committed before step 1's scroll-into-view math runs on the masthead gear.
- **`tutorialSeen` flag** in `chrome.storage.local`. Single-field write on tour end (same pattern as `applyTheme` / `toggleMute` — avoids racing `loadSettings` and wiping empty key inputs). `maybeStartTutorial()` reads the flag independently of `loadSettings` and starts the tour after a 600 ms delay so the empty-state paint has landed first.

### Fixed
- **WIRE QUIET empty state invisible on first panel load.** `#emptyState` carried an inline `style="display:none;"` that won out over its CSS default (`display: flex`); boot flow didn't touch the empty state, so on first load the element stayed hidden until the user ran a start → stop cycle. Dropped the inline style — CSS default is the correct first-load state ([#19](https://github.com/Sethmr/peanut.gallery/pull/19), landed on `develop` after the v1.5.1 release PR cut; rides with v1.5.2).
- **Roadmap / INDEX docs** refreshed to reflect v1.5.1's merge to `main` via PR [#18](https://github.com/Sethmr/peanut.gallery/pull/18) and v1.5.2's tutorial as the new in-flight release.

## [1.5.1] — 2026-04-19 — "Broadsheet Final"

Polish round on top of v1.5's newspaper rebrand. The panel now reads like the proof sheet at [peanutgallery.live/panel/](https://www.peanutgallery.live/panel/): round persona mugs with category-colored borders, per-mug mini waveforms that animate only when that critic is speaking, an ON AIR label strip with its own waveform above the transcript, a 15-minute free-tier timer with a CAP REACHED state, and an episode card that shows the captured tab's title + free-tier progress bar. Settings moved out of the setup view into a 6-submenu drawer reachable from a masthead ⚙. The transcript ticker now scrolls continuously via a rolling-window speech-rate filter instead of per-Deepgram-interim CSS transitions.

### Added
- **Settings drawer with 6 submenus** — Lineup, Backend & keys, Audio, Critics (mute), Export, Appearance. Accessible via a new masthead gear (visible in all states) plus the existing footer gear (visible during capture). Drawer opens in a toc-style menu view; tapping a tile enters a section panel with a `‹ Menu` back button. All existing setting IDs preserved, zero storage wiring changes.
- **Free-tier status strip** — two-line grid under the masthead with colored dot + uppercase state + right-justified `00:00:00` mono timer + state tag + tab-title detail. Only renders when the user has NOT entered their own Deepgram + Anthropic + xAI keys (Brave remains optional, xAI Live Search is the fallback). Ticks at 1Hz from capture start; flips to `CAP REACHED / PAUSED / Daily free minutes exhausted · resets at midnight` when the server emits `TRIAL_EXHAUSTED` or the local clock hits 15:00.
- **Episode card above persona row** — bold slab title (captured tab title, ellipsized) + mono subtitle (hostname, `www.` stripped) + optional 3px progress bar for free-tier users tracking the 15-min cap.
- **ON AIR waveform** — 10-bar horizontal waveform between the `On Air` label and the ticker text. Staggered `-0.05s…-0.60s` animation delays + mixed paper/stamp/yellow bar colors match the proof's `.sp-wave` rhythm. Honors `prefers-reduced-motion`.
- **Per-mug 5-bar waveform** — under each persona circle's name/role. Dotted baseline at rest; stamp-red animated pulse when the bubble carries `.speaking`. Staggered per-bar animation delays.
- **Community pack-contribution issue** ([#16](https://github.com/Sethmr/peanut.gallery/issues/16)) — zero-code on-ramp at the top (one-line CTA to the `pack_request.yml` template); 7-step PR checklist below for coders; links to `lib/packs/INDEX.md` + `lib/packs/twist/personas.ts` as the copy-paste starting point. Labeled `good first issue` + `help wanted` + `enhancement`.
- **`dependencies` and `area: ci` repo labels** — created so Dependabot stops complaining they're missing.

### Changed
- **Persona mugs: 40×40 diagonal-stripe squares → 42×42 round circles** with category-colored borders/fills (fact → stamp outline, dunk → yellow fill, cue → ink outline, bit → ink fill). Matches the `.sp-item` tag palette in the proof. Speaking-state ring is round too (`border-radius: 50%`, `inset: -4px`).
- **Transcript ticker scroll** is now a 60fps rAF loop driven by a 2.5-second rolling-window measurement of the target's growth rate, not per-update CSS transitions. Smoothed speed keeps up with speech pace on average while each Deepgram interim no longer visibly yanks the scroll. Four tunables at the top of the block (`WINDOW_MS`, `CATCHUP_THRESHOLD`, `CATCHUP_RATE`, `MIN_DRIFT_SPEED`).
- **Transcript section is now a 3-col grid** (`On Air` label | 10-bar waveform | flowing ticker). Dark ink bg, paper text, single-line with `white-space: nowrap + text-overflow: ellipsis`. Replaces the multi-line `max-height: 90px` card.
- **Feed entry layout**: timestamp on row 1, tag on row 2, message spans both rows on the right — gives long bodies real width instead of pinching them against a small left column.
- **Filter pills** keep their category color in BOTH on/off states; deselected pills get a diagonal `::after` strike-through at 55% opacity. "All" master pill removed — per-category toggles were already enough.
- **Masthead subrail** text: `Howard | "Four critics. One tab." | Wire` → `Broadsheet | "Four critics. One tab." | Daily`. No pack or person names on the masthead; pack identity still lives in the selector dropdown + feed's persona names.
- **Muted persona mug strike-through** now renders at full contrast (was ghosted because parent opacity inherited to the `::before` pseudo). Fade moved onto the avatar/name/role children; slash kept on the parent at `z-index: 3` with `isolation: isolate` on the bubble.
- **Install page "What is Peanut Gallery?"** paragraph now mentions both shipping packs + links to the pack-authoring guide.
- **CONTEXT.md § UI Design** now names three design surfaces (extension side panel, landing, legacy /watch) with their canonical sources instead of duplicating a single-system palette.

### Fixed
- **Status-bar dot stuck yellow for recorded videos.** Dot only flipped to `.live` (red) when yt-dlp's `is_live` detection said the source was a YouTube live stream; recorded videos left it in `.active` (yellow) for the whole session. Now flips to `.live` on first transcript arrival — "live" in the UI means "transcription is flowing," not strictly "YouTube live stream."
- **Transcript ticker rendering below the ON AIR label** instead of inline to its right. `showCapturing` was setting `transcriptSection.style.display = 'block'` which overrode the CSS grid; now sets `'grid'`.
- **Muted critic bubble strike-through invisible** (see Changed).
- **Filter pills losing their color on deselection** instead of getting a strike-through (see Changed).
- **DUNK tag / REACT button / DUNK pill** went ivory-on-yellow in night mode because `var(--ink)` flips to `#efe7d0`. Switched to `var(--p-ink)` (locked `#111111`) on yellow-backgrounded elements.
- **Cue/Bit filter pills were visually identical** — both rendered via the generic `.pill.on`. Added `.cue` / `.bit` category classes to the HTML + per-category rules (cue = paper bg + 2px ink outline, bit = solid ink fill).
- **Dead references cleaned up**: `packBadgeEl` + `updatePackBadge()` (element was removed from HTML in an earlier commit, null-noop function lingered); `id="responseRateRow"` (unused wrapper ID); stale comments referencing the pre-refactor drawer contents + "v1.4 tabloid rebrand" date stamp; dead `.keys-section` / `.audio-section` / `.toggle-keys` CSS.

### Release / repo
- **TWiST Oracle plan privatized.** Reduced `docs/TWIST-ORACLE-PLAN.md` from a 686-line public roadmap plan to a 47-line private exploratory note; removed its references from `docs/INDEX.md` (it was flagged as "v1.7 working spec" based on Jason's off-hand group-chat riff, which wasn't a commitment).
- **Dependabot ignore rules** added for framework-tier majors (`next`, `react`, `@types/react*`, `typescript`, `eslint*`, `@eslint/*`, `tailwindcss`, `@anthropic-ai/*`, `@types/node`, `actions/github-script`) — closed 7 drive-by Dependabot PRs per the bot-triage rubric's QUEUE-AND-CLOSE verdict.
- **`claude-triage.yml` unblocked** — added `id-token: write` to the workflow permissions block. The triage bot was erroring `Could not fetch an OIDC token`; next Dependabot event should trigger a clean triage comment.

## [1.5.0] — 2026-04-19 — "The Broadsheet"

A full aesthetic reinvention. The side panel is no longer a chat app — it's a late-night newspaper desk. Anton slab masthead, cream paper stock, ink-grey rules, four critics in mug shots with role tags (FACT / DUNK / CUE / BIT), and a wire-service feed where every quip lands with a 24h timestamp and a stamped role tag. Underneath the redesign: a Paper/Night theme toggle for late-session eyes, per-critic mute, and a one-click "Download Session" that ships the whole broadcast as Markdown. Smart Director v2's client-side scaffolding is in — the rule vs. LLM source badge is wired and ready — but the server flag stays off until the canary bands land.

### Added
- **URL transition readiness (Path 2 wiring).** In lockstep with moving the marketing site to GitHub Pages, the backend is moving from the apex (`peanutgallery.live`) to the api. subdomain (`api.peanutgallery.live`). v1.5 ships the extension side of that move: `manifest.json` `host_permissions` now covers the old apex + the new api subdomain + `www.`; the side-panel's default `serverUrl` is `https://api.peanutgallery.live`; `content_scripts` matches `www.` in addition to the legacy apex so the "already installed" pill keeps working on whichever host serves marketing at a given time. A one-shot migration in `background.js` (`migrateServerUrl`, gated on `details.reason === "update"`) rewrites stored `serverUrl === "https://peanutgallery.live"` → `"https://api.peanutgallery.live"` — but only for the literal old default, so self-hosters and custom URLs are left alone. `isHostedBackend` in `sidepanel.js` updated to match both old-apex + api + www so the keys-optional path keeps working across the rollout window.
- **Tabloid / newsprint rebrand of the side panel** (`sidepanel.html`, ~1300 lines). Anton + Source Serif 4 + Special Elite + JetBrains Mono from Google Fonts; `--paper` / `--ink` / `--n-*` token sets scoped via `body[data-theme="paper|night"]`; masthead carries `Vol. I · No. 001` + version badge + SVG title + pack nameplate. Empty state is a "Wire Quiet" wire-service slug, not a chat placeholder.
- **Mug-row critic avatars with role tags.** Each persona renders as initials + a glyph-overlay corner crest colored by pack; role tag underneath (fact/dunk/cue/bit) comes from a new `ROLE_FOR_SLOT` map so the newspaper language is slot-driven, not pack-driven. All existing firing / force-react / director-trace paths keep working against the same element IDs.
- **Wire-service feed with role-tagged rows.** `.feed-entry` is a three-column grid (ts / role stamp / message). Zero-padded 24h `HH:MM` timestamps so the time column is locale-stable. Footer carries filter pills (ALL / FACT / DUNK / CUE / BIT) that hide rows via CSS data attributes on `#gallery` — O(1) regardless of feed length.
- **Paper ↔ Night theme toggle.** Full-screen settings drawer (accessible via footer gear mid-capture) flips `body.dataset.theme` and persists the choice as a single field in `chrome.storage.local`, race-safe against `loadSettings` so it never clobbers API keys.
- **Mute-a-critic.** Per-persona toggles in the drawer. Muted critics get a strike-through on the mug and their stream entries are suppressed client-side — SSE handlers short-circuit on `mutedPersonas.has(pid)`. No server-side change; purely client-side v1.
- **Download Session as Markdown.** Copy-to-clipboard AND download-as-`.md` handlers build a single document with session metadata, the transcript, and every persona quip tagged by role. Export is one click and needs no server round-trip.
- **Smart Director v2 client scaffolding** — `RULE` / `LLM` source badge wired on every decision-trace row; reads `source` off `director_decision` SSE payloads; ready for the server flag to flip.

### Changed
- **`sidepanel.js` reorganized** (~1900 lines) around the new structure: `ROLE_FOR_SLOT`, `personaInitials`, `packBadgeName`, `buildPersonaAvatars`, `addFeedEntry`/`updateStreamingEntry`, `renderMutesList` / `toggleMute`, `applyTheme`, `buildSessionMarkdown`. All SSE handlers untouched at the network layer; only rendering targets changed.
- **Time format** switched from locale 12h to zero-padded 24h `HH:MM` so the feed timestamp column is a fixed width across locales.
- **Settings persistence** uses `chrome.storage.local.set({ field })` single-field writes for theme and mutes (avoids `saveSettings()`'s full read-form-write round trip, which would wipe API keys if `loadSettings` hadn't completed).

### Fixed
- **Feed entries rendered horizontally instead of stacking.** `.gallery` gets `display: flex` inline from the JS capture-start path but the CSS rule was missing `flex-direction: column`, so entries flowed as a row. Added the direction declaration; entries now stack top-to-bottom as intended.

### Deferred (still in [Unreleased] below)
- **Smart Director v2 server flip** — client scaffolding ships in 1.5.0; the 48h hosted canary with `ENABLE_SMART_DIRECTOR=true` is still the gate before flipping the server flag. Bands per `docs/V1.5-PLAN.md §4`. If/when bands clear → tag 1.5.1 (or 1.6 depending on scope at the time).

### Added — v1.5 "Smart Director v2" (feature-complete; canary-pending)
- **`lib/director-llm.ts` — `pickPersonaLLM(ctx)` routing module.** Claude Haiku routing call with a JSON-only response shape (`{ personaId, rationale }`), input validation against the 4 archetype slot ids, and graceful null-return on timeout / upstream error / malformed output. Never throws. Logs structured `llm_director_pick` / `llm_director_timeout` / `llm_director_error` / `llm_director_parse_fail` events for observability.
- **`Director.decide(..., opts?: { llmPick })`.** The rule-based scorer still runs every tick; when `opts.llmPick` is present and names a valid archetype, the chosen persona is hoisted to primary and cascade/cooldown/recency bookkeeping proceeds unchanged. `TriggerDecision.source` is now `"rule" | "llm"` so the v1.2 debug panel can badge each decision card. LLM rationale flows into `decision.reason` as `"LLM routing: <rationale> (rule scorer: <fallback>)"`.
- **`ENABLE_SMART_DIRECTOR` env flag + 400ms race in `/api/transcribe`.** When the flag is on AND an Anthropic key is available for the session, the route races `pickPersonaLLM` against `AbortSignal.timeout(400)` before handing the result (or null on timeout) into `director.decide`. `director_decision` SSE payloads now carry `source` so clients can render the difference. Emits a new `director_v2_compare` pipeline event every tick with agreement/override booleans + `llmElapsedMs` for canary telemetry.
- **`Persona.directorHint?` field** on every persona. ~15-token routing hint surfaced in the Smart Director prompt so the LLM routes with intimate knowledge of each voice's specialty (e.g. Jason Calacanis: *"Confident takes on founder-market fit; cap-table + deal-structure angles. Warm, never mean."*). All 8 shipping personas (Howard + TWiST) now carry hints; `directorHint` omission still works — router falls back to `role`. Optional, documented in `docs/SELF-HOST-INSTALL.md` §8 + `docs/BUILD-YOUR-OWN-BACKEND.md` §9.
- **Side-panel `RULE` / `LLM` source badge** on every decision-trace row in the debug panel. Surfaces LLM rationale when present. Makes canary review a visual scan rather than a log grep.
- **Director test harness extensions.** `DirectorFixture.input.llmPick` lets fixtures inject a synthetic LLM pick without a live provider call. New strict assertion `sourceIn: ["rule" | "llm"]`. Three new fixtures — `llm-override-troll-to-joker` (LLM pick overrides rule-based primary), `llm-unknown-id-falls-back` (unknown archetype id silently degrades to rule-based), and `llm-agrees-with-rule` (router and rule scorer pick the same slot; source stays `"llm"`). Suite is now 17 fixtures × 50 runs.
- **`docs/V1.5-PLAN.md`** — canonical rollout checklist: scaffold, harness, canary metrics, tag gate. §4 defines the four roll-up bands that gate the v1.5.0 tag.
- **`docs/STATE-OF-PRODUCT-2026-04-18.md`** (new) — entry-point memo for sessions resuming after 2026-04-18. TL;DR of current version, uncommitted tree, canary gate, 9-subsystem health check, known risks ordered by severity, per-release value framing.
- **`docs/ROADMAP.md`** — full rewrite. Near-term releases fleshed out with concrete sub-steps: v1.5.1 Smart Director Polish (canary codification + per-pack hint weighting), v1.6 Voice + Clip Share (TTS provider bake-off + client-side clip render), v1.7 Pack Lab (visual pack authoring + All-In / Acquired / Lex gallery), v1.8 Live Moments (danmaku overlay + event triggers + personal context). v2.0 3D Bobbleheads stays vision-level.
- **`marketing/cws-listing.md` + `SHIP.md`** — TWiST pack called out in the CWS long description, podcast-first positioning (per `docs/COMPETITIVE-LANDSCAPE-2026-04-18.md`), tightened screenshot captions, five additional search-term slots. Scrubbed the last stale Groq reference.
- **Narrated v1.5 walkthrough video** — https://youtu.be/WPyknI7-N5U. Seth walks through the LLM-assisted router, the 400ms race, the rule-based fallback, and what changed since v1.4. Embedded on the landing page at `#walkthrough`, surfaced as a `VideoObject` in `app/layout.tsx` JSON-LD, and linked from `README.md` + `docs/ROADMAP.md`.

### Blocking v1.5.0 GA (not code, empirical)
- **48h hosted canary with `ENABLE_SMART_DIRECTOR=true`.** Per `docs/V1.5-PLAN.md §4`: agreement rate ≥ 0.55, override rate 0.20–0.45, p95 `llmElapsedMs` < 350 ms, timeout rate < 0.05. If all four bands hit → bump `manifest.json` to 1.5.0, tag, push. If any miss → do not tag; iterate prompt or pull the feature. Kill switch: flip `ENABLE_SMART_DIRECTOR=false` and redeploy.

## [1.4.0] — 2026-04-18 — "Grok & Stability"

A provider swap, a new search option, and the stability pass that made v1.3 shippable in real-world sessions. Groq's free-tier TPD cap was silently killing the Troll and Lon — both are now on xAI Grok 4.1 Fast. Fact-checking gains a second engine (xAI Live Search) behind a user-facing toggle. Underneath, the biggest story is invisible: the session-firing loop now survives any upstream hang, so one stalled LLM stream can't strand the avatar spinners for the rest of the session. No breaking changes — existing installs just need to add an xAI key (Brave stays optional).

> **Note on the version number.** The original roadmap had v1.4.0 penciled in for Smart Director v2 (LLM-assisted routing). That work is now deferred to v1.5 — the stability fixes in this release were blocking for real-world v1.3 usage and warranted a minor bump of their own rather than sitting in a long-lived Unreleased limbo.

### Added
- **Search-engine toggle (Brave ↔ xAI Live Search).** New `SEARCH_ENGINE` env var (`brave` default, `xai` alternative) + `X-Search-Engine` header forwarded from the extension. The server routes Producer's fact-check queries through Brave's REST API (raw SERP entries, unchanged v1.3 behavior) OR xAI's Grok Live Search (synthesized answer with inline citations via `search_parameters.mode=on`, `sources=[web]`, `max_search_results=5`, `return_citations=true`). Side-panel setup now exposes the dropdown; Brave's key field becomes optional when xAI is selected.
- **xAI as first-class LLM provider.** New `"xai-grok-4-fast"` alias on `Persona["model"]`. PersonaEngine gained a private `streamXai` async generator (fetch-based OpenAI-compatible SSE, partial-line buffering, `[DONE]` sentinel, malformed-chunk skip, `finally`-cleanup). `xaiKey` constructor arg is wired through `/api/transcribe` + `/api/personas` + `scripts/test-personas.ts`, reading `X-XAI-Key` header first and falling back to `XAI_API_KEY` env.
- **Pipeline logging for every value-reducing branch in fact-check search.** New structured events: `search_skip` (force-react path skips search for latency), `search_no_claims_detected` (claim-extraction heuristics found nothing), `search_timeout` (per-engine AbortSignal fired), `search_upstream_error` (non-2xx or thrown fetch error), `search_empty_result` (upstream returned 200 but no usable data), `search_complete` (aggregate outcome with `attempted`/`succeeded`/`emptyOrFailed`/`degraded` flag), and `search_pipeline_error` (outer-catch replaces a previously silent `catch{}`). Observable via the existing `logPipeline` channel.

### Changed
- **Troll + Sound FX personas migrated from Groq Llama to xAI Grok 4.1 Fast non-reasoning** (both Howard and TWiST packs). Root cause was the Groq free-tier TPD cap on `llama-3.3-70b-versatile` silently returning 429s that read as "persona declined to speak." Anthropic Claude Haiku still powers the Producer + Joker slots (Baba Booey, Jackie, Molly, Alex) — those were never affected.
- **Baba Booey force-react tap now skips pre-stream search entirely.** A tap commits Baba to speak, and the search round-trip was the single biggest source of latency before any bubble appeared. Search still runs for director-driven cascades where the budget allows it.
- **"Free" label in the extension side panel now reads "15 minutes free"** to match the rolling 24h limiter's actual quota (was a generic "Free" previously, which read as unlimited).

### Fixed
- **Session-firing deadlock when any upstream hangs.** `/api/transcribe` had a per-session `personasFiring` boolean with no try/finally around the `fireSingle`/`fireAll` await. A stalled Anthropic stream, a stalled xAI stream, or a stuck Brave fetch would leave the flag pinned at `true` forever — killing every subsequent director tick AND every avatar tap on that session until page reload. Root cause behind the v1.4-preview regression where Baba's avatar animated without responding, then stopped showing a spinner on tap entirely. Fix is layered: (1) Anthropic `messages.stream` now carries `{ signal: AbortSignal.timeout(25_000) }`; (2) `streamXai` accepts an `AbortSignal` and plumbs it into both the initial fetch and its reader loop; (3) both firing branches in the setInterval tick are wrapped in `try { … } finally { personasFiring = false; send("personas_complete") }` so ANY throw or timeout releases the lock.
- **Search fetches can no longer hang forever.** Node's native `fetch()` has no default timeout; a silently-stalled Brave or xAI response used to block `fireSingle` for the 15s client safety timeout and beyond. Both `searchBrave` and `searchXai` now use `AbortSignal.timeout(5_000)` / `AbortSignal.timeout(8_000)` respectively. Timeouts emit a distinct `search_timeout` event separate from upstream errors so ops dashboards can tell "slow upstream" from "upstream error."
- **Force-react silent-spin edge cases.** When the Producer bowed out with an explicit `-` pass on a force-react tap, the user would see a spinner that cleared with no bubble. `firePersona` now routes force-react upstream errors AND model-initiated dash-passes through the same deterministic in-voice fallback (`getForceReactFallback`) so tapping an avatar always produces a visible response. Observable via new `force_react_fallback` event.
- **StreamCallback dropping one-shot `text + done=true` payloads.** Error-path bubbles (`[technical difficulties]`) were emitted with `done=true` in a single callback, and the client only renders from buffered `persona` events — so the text never made it to the DOM. Route now splits into a `persona` event (carrying the text) followed by `persona_done`.
- **Extension side-panel API Keys section now scrolls** when content overflows (adding xAI to the four-field form was enough to push the footer's Save button off-screen on shorter viewports). `.setup` gained `min-height: 0; overflow-y: auto;` and a 4px scrollbar skin.
- **Broken peanut emoji in two extension error strings.** `background.js` and `offscreen.js` error messages referencing the toolbar icon were mangling the 4-byte UTF-8 codepoint through `chrome.runtime.sendMessage → textContent` into gibberish. Swapped the emoji for the word "peanut" in both strings (static HTML emojis in the header/empty-state render fine and were left alone).

### Removed
- **`groq-sdk` dependency** dropped from `package.json` and all references scrubbed from `lib/persona-engine.ts`, `lib/personas.ts`, `app/api/transcribe/route.ts`, `app/api/personas/route.ts`, and `scripts/test-personas.ts`. No runtime code path references Groq anymore. Historical references (CHANGELOG entries, session notes, in-code comments explaining WHY Groq was removed) are intentionally retained.

### Docs + marketing
- README, landing page (`app/page.tsx`), `/install`, `/watch`, `/privacy`, `components/ApiKeysModal.tsx`, `docs/index.html`, `marketing/cws-listing.md`, `setup.sh`, `lib/packs/types.ts`, `docs/SELF-HOST-INSTALL.md`, `docs/BUILD-YOUR-OWN-BACKEND.md`, `docs/DEBUGGING.md`, `docs/CONTEXT.md`, `docs/OPS.md`, `docs/SERVER-SIDE-DEMO-KEYS.md`, and `SHIP.md` all updated to reflect the xAI requirement, the optional Brave key, and the new search-engine toggle.

### Deferred to a future release
- **Smart Director v2** (rerouted to v1.5). LLM-assisted routing with a rule-based fallback under a 400ms budget. Scoped out of v1.4 so this release could focus on the stability + provider story.
- **Pack-creation installer** (still targeting v1.4.x / v1.5). Sideload pack JSON, validation pipeline, pack management UI.
- **Cascade-delay retune** (carried over from v1.2). Still waiting on two real-session captures.
- **ESLint migration** to flat-config CLI (carried over from v1.3).

### Future roadmap (post-v1.4.0)
- **v1.5.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.6.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.3.0] — 2026-04-17 — "TWiST Pack"

The flagship feature: **selectable persona packs.** Keep riding with the Howard crew, or swap in the This Week in Startups lineup — Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm — with a single dropdown. Pack choice persists across sessions; the Director is pack-agnostic (same archetype slot ids, same behavior) so routing stays identical regardless of who's on the roster. Fully wire-compatible with v1.2.x backends: an unknown pack id gracefully degrades to Howard server-side via `resolvePack()`, so an older server + newer client still works.

### Added
- **Pack abstraction** (`lib/packs/`). New `Pack` type + `resolvePack(id)` helper that never throws — unknown / missing / malformed ids always resolve to Howard. Single choke point means the forward-compat matrix (new client + old server, old client + new server, mismatched packs) always degrades cleanly. `PersonaEngine` now takes an optional `pack` in its constructor; legacy call sites that don't pass one continue to get Howard via a back-compat shim (`lib/personas.ts` re-exports `howardPersonas as personas`).
- **Howard pack** (`lib/packs/howard/`). Pre-existing Baba Booey / Troll / Fred / Jackie personas extracted from `lib/personas.ts` into `lib/packs/howard/personas.ts` with zero content changes. Back-compat shim keeps all v1.2 import sites unchanged.
- **TWiST pack** (`lib/packs/twist/`). Four new personas, each researched from public TWiST transcripts and episode clips and mapped to the four archetype slots:
  - **Molly Wood** → `producer` (Fact-Checker). Claude Haiku + Brave. Calm journalistic corrections, "according to" framing, receipts-first.
  - **Jason Calacanis** → `troll` (Provocateur). Groq Llama 70B. Confident takes, founder-market-fit framing, warm-not-mean, self-aware self-promotion as character fingerprint.
  - **Lon Harris** → `soundfx` (The Reframe). Groq Llama 8B. Bracket-delimited sound cues + cultural analogies as primary languages. Reacts to moments, never monologues.
  - **Alex Wilhelm** → `joker` (Data Comedian). Claude Haiku. Eight joke techniques (NUMBER-AS-PUNCH, COMP-BOMB, BACK-OUT-THE-THING, …) built on data + absurdity.
  - All four include explicit anti-impersonation guardrails: "NEVER claim to BE [person]. You are a persona INSPIRED BY him." See [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) for the characterization source.
- **Pack selector dropdown** in the side-panel setup section. Always-visible at the top so first-time users understand the choice; persists across sessions via `chrome.storage.local`. Hint text tells users the change takes effect on the next Start Listening (no mid-session swap, for the same reasons as the rate dial).
- **Director trace pack label.** The debug panel (long-press version badge) now shows a `pack: <id>` tag in its header. Muted when idle — reflects the dropdown's pre-session selection. Tinted accent + `locked` state when a session is live — reflects the pack that actually produced the rows you're reading. Prevents the "dropdown drifted mid-session" confusion surface.
- **Four TWiST-flavored fixtures** under `scripts/fixtures/director/twist-*.json` exercising each archetype slot with TWiST vocabulary (cap tables, Series A/B/C, Anthropic, Databricks, a16z / Sequoia name-drops). Same assertions shape as the Howard fixtures — pack-agnostic Director means these validate the same code path with different transcripts.

### Changed
- **`/api/transcribe` + `/api/personas`** now parse an optional `packId` from the request body and pass the resolved pack to `new PersonaEngine({ pack })`. Omitted `packId` → Howard, so v1.2 clients (and any third-party backend honoring the spec) keep working untouched. The resolved pack id is written into the `session_create` log line for end-to-end correlation.
- **Extension pipeline** (`sidepanel.js` → `background.js` → `offscreen.js` → `/api/transcribe`) threads `packId` through every hop. Background + offscreen default to `"howard"` on any missing / non-string field so a stale side-panel build can't wedge a backend session.
- **`PERSONAS` global in `sidepanel.js`** is now a Proxy over the active pack's array. All existing call sites (`PERSONAS.find(...)`, `for..of PERSONAS`, `.reduce`, …) work unchanged; pack switches take effect immediately without a refresh. `PERSONA_COLOR_BY_ID` became a lazy `colorForPersonaId(id)` getter for the same reason.
- **`scripts/test-director.ts` gained a `--pack <id>` flag.** Runs the subset of fixtures whose `pack` field matches. Fixtures without a `pack` field default to `"howard"`, so `--pack howard` covers the legacy v1.2 fixtures verbatim. `npm run test:director` with no flag runs all 14 fixtures (10 Howard + 4 TWiST) in one pass.

### Tooling
- **Pre-merge gate now covers extension JS.** New `npm run check:extension` step runs `node --check` across `background.js`, `offscreen.js`, `sidepanel.js`, and `content.js`. Folded into `npm run check` (= `typecheck + check:extension + test:director`) and wired through the husky pre-commit hook. Catches the MV3 extension's plain-JS syntax errors before commit — the extension is intentionally un-bundled so TypeScript wouldn't catch these.
- **`next lint` deferred.** Dropped from `npm run check` due to an eslint-config-next @ Next 15.5 circular-structure bug (`Converting circular structure to JSON` during config load). Will re-enable once we migrate to the ESLint flat-config CLI per Next.js's migration guide.

### Deferred to a future release
- **Pack-creation installer.** v1.3 ships with Howard + TWiST baked in. A proper `pack install` flow (sideload a pack JSON, validate, merge into the dropdown) was scoped out of the flagship and will land in v1.3.1 or v1.4. Adding a pack today still means editing `lib/packs/` and `extension/sidepanel.js::PACKS_CLIENT`.
- **ESLint migration.** Re-wire lint into the pre-merge gate once the flat-config CLI path is stable.
- **Cascade-delay retune** (carried over from v1.2). Still waiting on two real-session captures before retuning `CASCADE_DELAY_MIN_MS` / `MAX_MS`.

### Future roadmap (post-v1.3.0)
- **v1.3.1 — Pack installer:** Sideload pack JSON, validation pipeline, pack management UI.
- **v1.4.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.5.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.2.0] — 2026-04-17 — "Mise en place"

Observability + pacing + the quality bar. Everything here is additive and wire-compatible with v1.1.x backends, so existing installs keep working if they pin an older server.

### Added
- **Director debug panel** in the side panel. Hidden by default, revealed by long-pressing the version badge for 750ms. Shows the last 20 routing decisions as persona-tinted rows with pick, score, runners-up, cascade length, chain, and reason. Open/closed state persists across side-panel reopens. Short-press does nothing so normal users never see it.
- **New SSE event `director_decision`** emitted once per Director cycle. Payload is backward-compatible: adds `pick`, `score`, `top3`, `chainIds`, `delays`, `cascadeLen`, `cooldownsMs` while preserving the pre-v1.2 fields (`chain`, `reason`, `cascadeCount`, `isSilence`, `drySpells`).
- **Enriched structured logs.** `lib/director.ts` now owns the `director_decision` line at `info+` with the full schema above plus `sessionId` for end-to-end correlation. The duplicate log line in the route is removed.
- **Response-rate dial (1-10)** in the side-panel setup. A smooth exponential pace multiplier (`3^((5-rate)/5)`) scales the first-trigger, trigger-interval, and silence-threshold timings so users can pick the cadence that fits their audience. 1 = laid back (~56k tok/hr), 5 = default (identical to pre-v1.2), 10 = nonstop (~403k tok/hr). Token estimates shown inline in the selector. Forwarded side-panel → background → offscreen → `/api/transcribe`; older clients that omit `rate` fall through to 5 on the backend (zero-behavior-change path).
- **`scripts/test-director.ts` + 10 JSON fixtures** under `scripts/fixtures/director/`. Fixture-driven harness runs each fixture 50× and asserts on distribution (pick-ratios, must-fire-ratios) plus structural invariants (delays monotonic, delays[0] === 0, return-shape complete). Covers the v1.1.1 silence cap, ISSUE-004 shape preservation, ISSUE-006 variance, dry-spell boost, recency penalty, and every persona's primary trigger path.

### Changed
- **Director internal state** now tracks per-persona `lastFiredAt`, seeded at construction so "never fired" reads as "cold since session start" in the debug panel rather than a 54-year-old epoch cooldown.
- **`TranscriptionManager` timing constants** (`FIRST_TRIGGER_MS`, `TRIGGER_INTERVAL_MS`, `SILENCE_THRESHOLD_MS`) are now mutable via a new `setPaceMultiplier(mult)` method with `[0.2, 5.0]` clamping and NaN/Infinity → 1.0 fallback. Default multiplier is 1.0, so pre-v1.2 clients see identical cadence.
- **Route poll tick** in `/api/transcribe` scales with the rate dial but only faster than the 5s default (floor 1s at rate=10). Poll never slows below default because the real trigger gate is already inside `shouldTriggerPersonas()`.

### Tooling
- **Pre-merge gate** via `.husky/pre-commit`: runs `npm run check` (= `tsc --noEmit` + `next lint` + `tsx scripts/test-director.ts`). Bypass with `git commit --no-verify` in emergencies.
- **`npm run typecheck` / `npm run check` / `npm run test:director`** scripts added to `package.json`.
- **`husky`** added as a dev dependency with `prepare` script for automatic install on `npm install`.

### Deferred to a future patch
- **Cascade-delay retune** (`CASCADE_DELAY_MIN_MS` / `MAX_MS` in `lib/director.ts`). Plan called for measuring against two real-session captures (one fast-exchange, one slow) before tuning. Debug panel is now live; the retune will land as a small follow-up PR once the captures are recorded.

### Future roadmap (post-v1.2.0)
- **v1.3.0 — TWiST Pack (flagship):** Selectable persona packs. Shipped — see above.
- **v1.4.0 — Smart Director v2:** LLM-assisted routing with rule-based fallback under a 400ms budget.
- **v1.5.0 — Voice + Clip Share:** TTS per persona; highlight/clip export.
- **v2.0.0 — Bobbleheads:** 3D persona avatars with procedural animation.

## [1.1.2] — 2026-04-17

Patch on top of the 1.1.1 "server-side demo access" feature: put a real, fair cap on the shared backend so one heavy user can't drain the pool, and make the "run it yourself" path obvious everywhere.

### Added
- **Free-tier rate limiter** (`lib/free-tier-limiter.ts`) — per-installation quota for the hosted backend. In-memory, lazy-pruning, singleton-stashed on `globalThis` so hot-reload doesn't wipe it. 15 minutes of transcription per rolling 24h window (both env-overridable via `FREE_TIER_MINUTES` / `FREE_TIER_WINDOW_HOURS`). Completely inert until the operator sets `ENABLE_FREE_TIER_LIMIT=true` — self-hosters and local dev never pay a cost.
- **`X-Install-Id` header** generated by the extension on first launch (`extension/sidepanel.js::ensureInstallId`), persisted in `chrome.storage.local`, sent on every `POST /api/transcribe`. CORS `Access-Control-Allow-Headers` on the transcribe route updated to accept it.
- **402 `TRIAL_EXHAUSTED` response shape** documented in `docs/BUILD-YOUR-OWN-BACKEND.md` as non-negotiable #8 so third-party backends can opt into the same pattern and the official extension will recognize their limits.
- **Build-your-own-backend docs + website callouts.** New `docs/BUILD-YOUR-OWN-BACKEND.md` wire spec (12 sections, 8 curl-based acceptance tests) and `docs/SELF-HOST-INSTALL.md` operator guide. Landing page (`app/page.tsx`) and `/install` page updated with "Build Your Own Backend" sections. README gets a copy-paste prompt you can feed to Claude or Cursor to scaffold a compliant backend.

### Changed
- **Side panel UI** (`extension/sidepanel.html`) — new green "Free to try while we grow" banner at the top of setup. Keys-intro text rewritten to match the new free-tier story: "Keys are optional while we grow… we'll switch to a bring-your-own-key model." Backend-server field hint now links both the self-host guide and the build-your-own spec.
- **Session teardown** (`app/api/transcribe/route.ts`) — sessions now track `startedAt` and a `charged` guard. Elapsed time is recorded against the install's quota on `DELETE`, on `req.signal.abort`, and on the transcriber's `stopped` event. Double-charging is guarded.
- **Key-resolution logic** now distinguishes header-provided from env-provided keys. A session is only rate-limited if the server would actually hand out a demo key for at least one provider — BYO-keys users bypass the limiter entirely.

### UX
- When the hosted backend returns 402 with `code: "TRIAL_EXHAUSTED"`, the side panel auto-opens the API-keys accordion and shows a plain-language message telling the user which key to grab and where. No raw error-banner dump.

### Notes
- Extension version bumped `1.1.1 → 1.1.2` in `extension/manifest.json` and the side-panel footer badge.
- Backend deploy is fully backwards-compatible: until the operator sets `ENABLE_FREE_TIER_LIMIT=true`, the limiter branch is skipped entirely and older extension builds keep working as-is. Recommended rollout: deploy backend with the flag off, publish the extension update, wait 2–3 days for Chrome Web Store auto-update propagation, *then* flip the flag.

## [1.1.1] — 2026-04-17

Quality-of-life polish ahead of the TWiST submission and a security-driven refactor of how the extension handles "demo access."

### Added
- **Silence detection** replaces pause detection (`lib/transcription.ts`, `app/api/transcribe/route.ts`). When the transcript stays empty for 18 seconds the Director fires a one-shot "crickets on the show" moment, cascade-capped at 2 so it doesn't dogpile. Firing resets when new speech arrives. Director + persona prompts forbid the words "pause/paused/pausing" and use "crickets / dead air / silence / nobody's talking" instead, because the viewer didn't pause anything — the show itself went quiet.
- **Force-react button** in the side panel with a pure-CSS loading spinner (no layout shift). One click summons an in-character reaction from the Director's pick; persona prompt forbids the `"-"` pass token so force-fires never no-op.
- **Captured-tab banner** in the side panel. Live-updates on tab switch and title change via `chrome.tabs.onActivated` / `chrome.tabs.onUpdated`. Click the banner to focus the capturing tab (`chrome.tabs.update` + `chrome.windows.update`).
- **Server-side demo access** — see "Changed" and [`docs/SERVER-SIDE-DEMO-KEYS.md`](docs/SERVER-SIDE-DEMO-KEYS.md). First-time users can Start Listening without entering any keys; the hosted backend's env vars cover the providers.
- **Docs**
  - `docs/SERVER-SIDE-DEMO-KEYS.md` — architecture + rationale for the header-first / env-var-fallback pattern.
  - `docs/BUILD-YOUR-OWN-BACKEND.md` — contract for alternative backends (also enables the self-hoster guard).
  - `docs/SELF-HOST-INSTALL.md` — install flow for users running their own Next.js deploy.
  - `docs/SESSION-NOTES-2026-04-17.md` — handoff for the v1.1.1 session (post-compaction rescue + docs pass).

### Changed
- **Extension no longer ships demo API keys.** Key input fields default to empty strings; `extension/offscreen.js` only sets `X-*-Key` headers when the user has pasted a value. The backend (`app/api/transcribe/route.ts`, `app/api/personas/route.ts`) falls back to `process.env.*` when headers are absent. Zero keys in the extension zip, zero keys in `git`. See [`docs/SERVER-SIDE-DEMO-KEYS.md`](docs/SERVER-SIDE-DEMO-KEYS.md).
- **Side-panel copy** updated to reflect the new architecture: "API keys — temporarily optional" instead of "pre-filled / free right now." Copy notes that shared backend access is rate-limited and will be retired.
- **Pre-flight key check** is now conditional on the configured server URL. Against `peanutgallery.live` we skip the client-side check entirely (server env vars cover it). For self-hosters the old behavior applies — Deepgram + Groq + Anthropic are required.

### Fixed
- **ISSUE-009 — GitHub push protection rejected v1.1.1 for embedded demo keys.** An earlier pass at demo access hard-coded four provider keys into `extension/sidepanel.js`. Push was blocked; commits were local only (nothing leaked). Fixed by reset-and-reshape onto the server-side fallback architecture above. Full post-mortem in `docs/DEBUGGING.md`.
- Persona context no longer leaks "pause" wording into silence reactions. `lib/personas.ts::buildPersonaContext` takes an `isSilence` flag (renamed from `isPaused`) and installs a hard rule list of allowed / forbidden phrases.

### Notes
- Extension version bumped `1.1.0 → 1.1.1` in `extension/manifest.json` and in the side-panel footer badge.
- `.commit-msg.txt` added to `.gitignore` — it's a scratch file used when committing multi-line messages via `git commit -F`.

## [1.1.0] — 2026-04-17

Audio-routing QoL for podcasters + persona context rebalance + Chrome extension reliability fixes.

### Added
- **Passthrough toggle + output-device picker** in the side panel. On by default — captured tab audio plays back through your speakers so you hear the video normally. Turn off when OBS / Riverside / BlackHole / VB-Audio is already routing audio, to avoid doubling. Device picker lets you send passthrough to a specific output the recording rig doesn't capture. See `docs/PODCASTER-SETUP.md`.
- **Audio config forwarded through `background.js`** so passthrough + `sinkId` reach the offscreen document cleanly.

### Changed
- **Persona context rebalanced.** The Director now hands each persona a transcript-heavy context (roughly 90% transcript / 10% cross-persona log) so replies ground in what was actually said, not in what the other personas just said. Fixes Baba Booey's tendency to echo his own last fact-check.
- **Troll trigger timing.** Re-tuned cooldown and cascade probability so The Troll engages more often on spicy transcripts without dominating cascades.
- **Persona character depth.** `lib/personas.ts` received richer character models — specific mannerisms, taboo topics, callback patterns — pulled from Howard Stern show research.

### Fixed
- **Silent START_RECORDING failure** — errors from the offscreen document are now propagated back through `background.js` to the side panel, which surfaces them in the error banner instead of hanging on "Connecting to server…"
- **Baba Booey self-repetition** — conversation-context sampler now excludes each persona's own recent messages when building its prompt.
- **Honest UI copy** pass on the side panel — version badge, status copy, and settings descriptions aligned with actual behavior.

### Notes
- v1.1.0 was released alongside v1.1.1; the changelog entries are split here for historical clarity but the Chrome Web Store upload is v1.1.1.

## [1.0.0] — 2026-04-17

First public release. Submitted for the TWiST $5,000 + guest-spot bounty from Jason Calacanis and Lon Harris.

### Added
- **Chrome extension (primary product).** Native Chrome side panel with silent tab audio capture via `chrome.tabCapture.getMediaStreamId`. No screen-share picker, no interference with playback. MV3 service worker + offscreen document pattern.
- **Four AI personas**, modeled on the Howard Stern Show staff and defined in `lib/personas.ts` with deep character research:
  - Baba Booey (Gary Dell'Abate) — fact-checker. Claude Haiku + Brave Search for live web verification.
  - The Cynical Troll — contrarian commentator. Groq Llama 70B, ~120ms time-to-first-token.
  - Fred Norris — sound effects / context. Groq Llama 8B.
  - Jackie Martling — comedy writer. Claude Haiku.
- **Director + cascade trigger model** (`lib/director.ts`). Rule-based booth producer scores the transcript, picks the best persona to fire first, then cascades to others with decreasing probability and staggered delays so some moments get one response and others pile on.
- **Live vs. recorded mode detection** via `yt-dlp --print is_live`. Distinct UI, diarization toggling, low-latency FFmpeg flags, and auto-reconnect for live streams.
- **Pause reactions.** When the viewer pauses, personas react in character instead of going silent (capped at two responses).
- **Cross-persona awareness.** Each persona sees the other three's most recent response and can riff off them. Each persona's last three messages are injected for callbacks and running jokes.
- **Fact-checking pipeline** for Baba Booey. Scores sentences for factual claims (numbers, dates, attributions, rankings), runs parallel Brave Search queries, and injects formatted results into the Producer's context.
- **Audio pipeline (reference web app).** yt-dlp → FFmpeg (`-f s16le`, 16 kHz, mono PCM) → Deepgram Nova-3 via WebSocket with KeepAlive + exponential-backoff reconnect.
- **BYOK flow.** Users supply their own Deepgram / Groq / Anthropic / Brave Search keys through the side panel; keys are stored in `chrome.storage.local` and passed per-session via request headers. Never logged, never persisted server-side.
- **Landing page** at [peanutgallery.live](https://peanutgallery.live) with install flow, cast bios, cost breakdown, and a live demo CTA. Deployed via Railway.
- **Privacy policy** at `/privacy` (`app/privacy/page.tsx`) and sitemap entries for `/privacy` and `/watch`.
- **Structured debug logging** (`lib/debug-logger.ts`) — JSONL at `logs/pipeline-debug.jsonl`, always-on at info+, `DEBUG_PIPELINE=true` adds debug-level.
- **Byte-counter stall detector** in the pipeline with stage-specific diagnostics (yt-dlp / FFmpeg / Deepgram) and UI progress surfacing.
- **Health check endpoint** at `/api/health` — reports API key status and binary availability.
- **Standalone test scripts** — `scripts/test-transcription.ts` and `scripts/test-personas.ts` (with `--fixture` flag for the AstroForge TWiST transcript).
- **Packaging script** `scripts/pack-extension.sh` — zips `extension/` into `releases/peanut-gallery-v<version>.zip` for Chrome Web Store upload.
- **Dockerfile** with `yt-dlp` + `ffmpeg` pre-installed; `railway.toml` for one-shot deploys.
- **Documentation.** `docs/CONTEXT.md` (canonical project context), `docs/INDEX.md` (reading order), `docs/DEBUGGING.md` (post-mortem log ISSUE-001..008 + silent-failure table), `docs/SESSION-NOTES-2026-04-16.md` (immutable permissions guardrails), `SHIP.md` (launch checklist).

### Fixed
- **ISSUE-001 — FFmpeg WAV header poisoning Deepgram.** Changed `-f wav` → `-f s16le` in both `start()` and `restartAudioPipeline()`. The 44-byte RIFF header was being decoded as audio by Deepgram's `linear16` path, producing silence. Single most important fix in the project.
- **ISSUE-002 — Binaries invisible to the Next.js server.** Added a `which()` resolver that checks `/opt/homebrew/bin` and other common paths because Next.js doesn't inherit shell `PATH`.
- **ISSUE-003 — `ws` native deps missing.** Added `bufferutil` and `utf-8-validate` to `package.json`.
- **ISSUE-004 — Force-fire button no-op.** Removed a premature `resetNewTranscript()` call that was clearing the buffer before `forceNextTrigger()` could use it.
- **ISSUE-005 — Deepgram errors silently swallowed.** Added handling for `type === "Error"` and `data.error` in the WebSocket message handler.
- **ISSUE-006 — Personas fire repeatedly while paused.** Gated `shouldFire` on `!session.paused` so only the one-shot "just paused" reaction runs when the viewer pauses.
- **ISSUE-007 — Pipeline silent stall.** Added byte counters, first-bytes indicators, and a 15-second stall detector with stage-specific diagnostics.
- Chrome extension icons missing — toolbar button silently hidden until 16/48/128 PNGs were added to `extension/icons/`.
- `tabCapture` acquisition moved out of the side-panel message handler and into `chrome.action.onClicked` so the user-gesture context is preserved and the stream ID call no longer rejects.
- `STREAM_READY` broadcast added for already-open side panels — otherwise re-clicks after the first open never triggered capture.
- `/app` route renamed to `/watch` to resolve a collision with Next.js's `app/` directory.
- `yt-dlp` headless server support — switched to the `mediaconnect` player client and added a cookies file option to survive bot detection on Railway.
- Dockerfile `public/` `COPY` failure fixed by switching Railway to the Dockerfile builder.

### Notes
- Permissions / gesture setup in `manifest.json` and `background.js` is treated as immutable — see `docs/SESSION-NOTES-2026-04-16.md §3`. Do not re-derive from blog posts.
- `personas.ts` is the creative soul of the project. Preserve the Howard Stern character research in any changes.
- Releases zipped by `scripts/pack-extension.sh` live under `releases/` and are git-ignored from v1.0.0 forward.

[1.0.0]: https://github.com/Sethmr/peanut.gallery/releases/tag/v1.0.0
