# Changelog

All notable changes to Peanut Gallery are recorded here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); version numbers follow [SemVer](https://semver.org/).

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
