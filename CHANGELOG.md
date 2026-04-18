# Changelog

All notable changes to Peanut Gallery are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); version numbers follow [SemVer](https://semver.org/).

## [Unreleased]

Tracks in-flight work for the next release. See [`docs/ROADMAP.md`](docs/ROADMAP.md) §v1.4.0.

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
