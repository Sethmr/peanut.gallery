# Peanut Gallery — Full Project Context

> **Canonical project context.** Start here, then read [`docs/SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) for the most recent handoff and the permissions guardrails that must not be overwritten.
> For a full docs map, see [`docs/INDEX.md`](INDEX.md).
> Last updated: 2026-04-17

---

## What Is This Project?

**Peanut Gallery** is an open-source AI sidebar that watches podcasts in real-time and generates commentary from 4 distinct AI personas — inspired by the Howard Stern Show staff. It's being built to win a **$5,000 bounty + guest spot** from **Jason Calacanis** on **This Week in Startups (TWiST)**.

- **Domain:** peanutgallery.live
- **Repo:** github.com/Sethmr/peanut.gallery
- **Builder:** Seth (sethr@hey.com)
- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **LLM providers:** Claude Haiku (Anthropic) + Groq (Llama 70B/8B) — multi-provider by design per Jason's spec
- **Audio pipeline:** yt-dlp → FFmpeg → Deepgram Nova-3 (WebSocket)
- **Fact-checking:** Brave Search API → injected into Producer persona context

---

## The 4 Personas (Howard Stern Show Staff)

Per Jason's exact spec from his X post, each persona maps to a Stern Show staff member:

| Persona | Character | Stern Staff | Model | ID | Emoji |
|---------|-----------|-------------|-------|----|-------|
| The Fact-Checker | Flustered but smart producer | Gary Dell'Abate ("Baba Booey") | Claude Haiku | `producer` | :dart: |
| The Cynical Troll | Brutal observer, fan-who-roasts | Artie Lange + callers | Groq Llama 70B | `troll` | :fire: |
| Sound Effects / Context | Laconic genius, editorial sounds | Fred Norris | Groq Llama 8B | `soundfx` | :headphones: |
| The Comedy Writer | Rapid-fire joke machine | Jackie "The Joke Man" Martling | Claude Haiku | `joker` | :joy: |

All persona system prompts are deeply researched from the actual Stern Show dynamics. They're defined in `lib/personas.ts` with extensive WHO YOU ARE, YOUR VOICE, HOW YOU RESPOND, and PERSONALITY DETAILS sections.

Key persona behaviors:
- **Cross-persona awareness:** Each persona sees the other 3's most recent response and can riff off them
- **Pause reactions:** When the viewer pauses the video, personas react in character (Baba Booey double-checks facts, Troll is annoyed, Fred plays elevator music, Jackie makes a joke about being paused)
- **Continuity:** Each persona's last 3 responses are injected for callbacks and running jokes

---

## Architecture

```
YouTube URL
    |
    v
 yt-dlp (binary)           -- Extracts audio stream, pipes to stdout
    | stdout pipe
    v
 FFmpeg (binary)            -- Converts to raw PCM: s16le, 16kHz, mono
    | stdout pipe            -- CRITICAL: must be -f s16le, NOT -f wav
    v
 Deepgram Nova-3            -- Speech-to-text via WebSocket
    | WebSocket messages      -- encoding=linear16, sample_rate=16000
    v
 TranscriptionManager       -- EventEmitter, rolling buffer, trigger logic
    | EventEmitter
    v
 SSE Route Handler          -- /api/transcribe (POST=start, PATCH=control, DELETE=stop)
    | Server-Sent Events
    v
 React Frontend             -- page.tsx consumes SSE stream
    |
    v--- PersonaEngine        -- Fires all 4 personas in parallel
    |     | Claude Haiku (Anthropic SDK) for producer + joker
    |     | Groq SDK (Llama) for troll + soundfx
    |     | Brave Search for fact-checking (producer only)
    v
 4 Persona Columns (UI)     -- PersonaColumn.tsx with bubble avatars + sine wave animation
```

### Trigger Model: Director + Cascade
Instead of all 4 personas firing simultaneously, a **Director** (rule-based, no LLM) picks the best persona for each moment, then cascades to others with decreasing probability:

1. Director scores recent transcript against each persona's specialty patterns
2. Highest-scoring persona fires first (always)
3. 50% chance → a random second persona reacts to the first's response
4. 35% chance → a third chimes in
5. 20% chance → the fourth gets the last word
6. 2-4 second delays between cascade responses
7. Recency tracking prevents the same persona from dominating

Result: some moments get 1 response, some get 2-3, occasionally all 4 pile on. Pauses are capped at max 2 responses.

### Trigger Timing
- First persona fire: **15 seconds** after transcript starts
- Subsequent fires: every **~22 seconds** of new transcript
- Minimum content threshold: **30 characters** of new transcript
- Manual fire button (fire emoji) available for instant trigger
- Persona interval checks every **5 seconds**

### Key Files for Director System
| File | Purpose |
|------|---------|
| `lib/director.ts` | Content scoring, persona selection, cascade probability, stagger timing |
| `lib/persona-engine.ts` | `fireSingle()` for individual persona firing, `fireAll()` kept as legacy |
| `app/api/transcribe/route.ts` | Trigger loop uses Director for cascaded, staggered responses |

---

## File Map

### Core Pipeline
| File | Purpose |
|------|---------|
| `lib/transcription.ts` | Audio pipeline: yt-dlp → FFmpeg → Deepgram WebSocket. Handles live detection, keepalive, auto-reconnect, binary path resolution |
| `lib/persona-engine.ts` | Multi-provider LLM orchestrator. Fires 4 personas in parallel, streams responses. Includes Brave Search fact-checking pipeline |
| `lib/personas.ts` | All 4 persona definitions with deep Howard Stern character research. Exports `personas[]`, `buildPersonaContext()`, types |
| `lib/director.ts` | The "booth producer" — scores transcript against persona specialties, picks who speaks, manages cascade chain with staggered timing |
| `lib/debug-logger.ts` | Structured JSONL logger. Always writes info+ to `logs/pipeline-debug.jsonl`. `DEBUG_PIPELINE=true` adds debug-level messages |

### API Routes
| File | Purpose |
|------|---------|
| `app/api/transcribe/route.ts` | Main SSE endpoint. POST=start session, PATCH=pause/resume/force_fire, DELETE=stop. Manages in-memory sessions |
| `app/api/personas/route.ts` | Standalone persona test endpoint. POST with transcript, get SSE persona responses |
| `app/api/health/route.ts` | Health check. Reports API key status and binary availability |

### Frontend
| File | Purpose |
|------|---------|
| `app/page.tsx` | Main UI. URL input, video player, transcript display, 2x2 persona grid. Live vs Recorded mode awareness |
| `app/layout.tsx` | Root layout with Inter + Space Grotesk fonts, metadata |
| `app/globals.css` | Dark theme, sine wave animations, persona avatar styles, live pulse effects |
| `components/PersonaColumn.tsx` | Individual persona card. Bubble avatar, sine wave indicator, message history, streaming text |
| `components/YouTubePlayer.tsx` | YouTube IFrame API wrapper. Programmatic play/pause, state change callbacks |
| `components/TranscriptBar.tsx` | Standalone transcript bar component (currently inlined in page.tsx instead) |

### Config
| File | Purpose |
|------|---------|
| `tailwind.config.ts` | Custom colors (bg-primary/secondary/tertiary, accent-blue/red/purple/amber), fonts (Inter, Space Grotesk) |
| `next.config.ts` | Minimal — just body size limit for server actions |
| `tsconfig.json` | Strict mode, `@/*` path alias, excludes `scripts/` |
| `package.json` | Dependencies: next, react, @anthropic-ai/sdk, groq-sdk, ws, @microsoft/fetch-event-source |

### Scripts & Fixtures
| File | Purpose |
|------|---------|
| `scripts/test-transcription.ts` | Standalone pipeline test: `npx tsx scripts/test-transcription.ts "YOUTUBE_URL"` |
| `scripts/test-personas.ts` | Standalone persona test: `npx tsx scripts/test-personas.ts` or `--fixture` for real transcript |
| `scripts/fixtures/twist-episode-sample.txt` | Real TWiST episode transcript (AstroForge space mining) |

### Documentation
| File | Purpose |
|------|---------|
| `docs/INDEX.md` | Top-level index — reading order + what lives where |
| `README.md` | Public-facing project README with setup instructions |
| `docs/CONTEXT.md` | THIS FILE — full project context for AI assistants |
| `docs/SESSION-NOTES-2026-04-16.md` | Most recent handoff: permissions guardrails, finish-strong checklist, gotchas |
| `docs/DEBUGGING.md` | Canonical debugging reference with post-mortems (ISSUE-001..008), diagnostic checklist, silent failure table |
| `extension/README.md` | Chrome extension install + architecture overview |
| `TWIST-AI-SIDEBAR-BUILD-PLAN.md` | ARCHIVED — original pre-build plan. Do not trust; kept for history only. |
| `docs/index.html` | Landing page for peanutgallery.live (GitHub Pages) |

---

## Chrome Extension

The primary capture path for live TWiST episodes. Lives in [`extension/`](../extension). The yt-dlp pipeline still works for local dev and recorded videos, but gets bot-detected on headless servers, so the extension is the submission path.

| File | Purpose |
|------|---------|
| `extension/manifest.json` | MV3 manifest. Permissions: `tabCapture`, `offscreen`, `activeTab`, `storage`, `sidePanel`. No `default_popup` — icon click routes to the service worker. |
| `extension/background.js` | Service worker. Handles `chrome.action.onClicked`, opens the side panel, manages the offscreen doc lifecycle. |
| `extension/offscreen.js` | Invisible page that holds the `AudioContext` (service workers can't). Downsamples 48 → 16kHz PCM, streams to `/api/transcribe` every 250ms, parses SSE and broadcasts to the side panel. |
| `extension/sidepanel.html/js` | The gallery UI — persona avatars, transcript, reaction feed. Saves server URL + API keys to `chrome.storage.local`. |
| `extension/content.js` | Content script scoped ONLY to `localhost` and `*.peanut.gallery`. Do not widen this. |

The known-good permissions/gesture setup is documented in [`docs/SESSION-NOTES-2026-04-16.md §3`](SESSION-NOTES-2026-04-16.md). That section is explicitly marked immutable — read it before touching the extension.

---

## Environment Variables

```bash
# .env.local (never committed)
DEEPGRAM_API_KEY=...      # Required — pipeline won't start without it
GROQ_API_KEY=...          # Required — pipeline won't start without it
ANTHROPIC_API_KEY=...     # Needed for Baba Booey + Jackie (Claude Haiku personas)
BRAVE_SEARCH_API_KEY=...  # Optional — enables fact-checking for Baba Booey
```

### System Dependencies (macOS)
```bash
brew install yt-dlp ffmpeg
npm install   # Includes bufferutil + utf-8-validate for ws
```

---

## Known Bugs Fixed (Critical History)

These are the bugs that were found and fixed. **Read docs/DEBUGGING.md for the full post-mortem log.** The top one is the most important:

### 1. FFmpeg WAV Header Poisoning Deepgram (ISSUE-001)
**THE critical bug.** FFmpeg `-f wav` outputs a 44-byte RIFF header before PCM data. Deepgram configured for `encoding=linear16` (raw PCM) tried to decode the header as audio, producing nothing. **Fix:** Changed to `-f s16le` in both `start()` and `restartAudioPipeline()`. This is the root cause of "the transcript isn't working."

### 2. Force-Fire Button Not Working (ISSUE-004)
The `force_fire` PATCH handler called `resetNewTranscript()` (clears buffer) BEFORE `forceNextTrigger()` (needs buffer). **Fix:** Removed premature `resetNewTranscript()`.

### 3. Deepgram Errors Silently Swallowed (ISSUE-005)
WebSocket message handler only checked for `type === "Results"`. Error responses fell through silently. **Fix:** Added handling for `type === "Error"` and `data.error`.

### 4. Binary Not Found in Next.js Server (ISSUE-002)
Next.js doesn't inherit shell PATH. **Fix:** `which()` function checks common paths.

### 5. ws Native Deps Missing (ISSUE-003)
**Fix:** Added `bufferutil` and `utf-8-validate` to package.json.

### 6. Personas Fire Repeatedly While Paused (ISSUE-006)
The audio pipeline (yt-dlp → FFmpeg → Deepgram) runs independently of the YouTube player. Pausing the video doesn't pause the pipeline, so transcript keeps accumulating server-side. The persona trigger loop didn't check pause state on the normal `shouldFire` path, so personas kept firing. **Fix:** Gated `shouldFire` on `!session.paused` — now only the one-shot "just paused" reaction fires.

### 7. Pipeline Silent Stall — No Data Flow Visibility (ISSUE-007)
Zero visibility into whether data was flowing between yt-dlp → FFmpeg → Deepgram. A stall at any stage produced no error. **Fix:** Added byte counters, first-bytes indicators, 15-second stall detector with stage-specific diagnostics, always-on logging (info+ to file), and pipeline progress display in the UI.

---

## Live vs Recorded Mode

The app auto-detects whether a YouTube URL is a live stream using `yt-dlp --print is_live`:

| Feature | Live Mode | Recorded Mode |
|---------|-----------|---------------|
| Accent color | Red | Blue |
| Pause button | Hidden (can't pause live) | Visible |
| yt-dlp flags | `--live-from-start no`, `--hls-use-mpegts` | `bestaudio` only |
| FFmpeg flags | `+nobuffer+flush_packets`, `+low_delay` | Default |
| Deepgram | `diarize=true` | No diarization |
| Auto-reconnect | Yes (live streams can buffer) | No |
| UI badge | Pulsing "LIVE" with red glow | "Recorded" |
| Producer label | "LIVE FACT-CHECK" | None |

---

## SSE Event Protocol

The `/api/transcribe` endpoint streams these events:

| Event | Data | When |
|-------|------|------|
| `status` | `{ status: "started", sessionId }` | Pipeline starts |
| `status` | `{ status: "deepgram_connected" }` | Deepgram WebSocket opens |
| `status` | `{ status: "live_detected", isLive }` | Live detection complete |
| `status` | `{ status: "detail", message }` | Informational messages |
| `status` | `{ status: "personas_firing" }` | Persona round begins |
| `status` | `{ status: "personas_complete" }` | Persona round ends |
| `status` | `{ status: "stopped" }` | Pipeline stopped |
| `transcript` | `{ text, isFinal, timestamp }` | Transcript fragment |
| `persona` | `{ personaId, text }` | Streaming persona token |
| `persona_done` | `{ personaId }` | Persona finished |
| `error` | `{ message }` | Error occurred |

### Control Actions (PATCH /api/transcribe)
| Action | Effect |
|--------|--------|
| `pause` | Sets session.paused=true, personas fire once in "paused" mode |
| `resume` | Sets session.paused=false |
| `force_fire` | Calls forceNextTrigger() — manual persona trigger |

---

## Fact-Checking Pipeline (Baba Booey / Producer)

1. Extract last 1500 chars of transcript
2. Split into sentences
3. Score each sentence using regex patterns (numbers, dates, attributions, rankings, company facts)
4. Take top 3 highest-scoring claims
5. Build targeted search queries (strip filler, extract company names + facts)
6. Run parallel Brave Search API queries (3 results per claim)
7. Inject formatted search results into Producer's context
8. Producer cross-references claims against search results in its response

---

## UI Design

- **Dark theme:** bg-primary #0a0a0a, bg-secondary #141414, bg-tertiary #1a1a1a
- **Layout:** Left side = video player (560px) + transcript; Right side = 2x2 persona grid
- **Persona cards:** Bubble avatar with ring pulse when speaking, sine wave (5 bars) animation, auto-scrolling message history
- **Fonts:** Inter (body), Space Grotesk (display/headers)
- **Persona colors:** Blue (#3b82f6) for Baba Booey, Red (#ef4444) for Troll, Purple (#a855f7) for Fred, Amber (#f59e0b) for Jackie

---

## Git History (Most Recent First)

```
9decbbc fix: move tabCapture out of the side panel so YouTube actually works
2c306bb fix: stop DMing a ghost every time the side panel opens
145c17f add updates
61a8750 fix: add missing extension icons so toolbar button appears
3df1317 fix: broadcast STREAM_READY to side panel when icon is clicked while panel is already open
4dc7fdd fix: capture tabCapture stream ID on icon click, not in side panel message handler
a44eab5 feat: Chrome Side Panel + fix tabCapture permissions — the gallery lives next to the video now
48ebbae feat: Chrome extension for tab audio capture — YouTube can't block what it can't see
c51165b fix: restore fade-in animations + align persona card quotes to bottom padding
bc4e371 feat: restore Jason's bounty video to landing page hero
d27e363 fix: rename /app to /watch — app/app/ directory was colliding with Next.js app router
400e0ad feat: tap persona emoji to trigger individual reactions + label fire button
e8290e7 Redesign persona cards: centered bubbles with profile pics, sine waves, roles, full info
e34e049 feat: responsive layout (sidebar + mobile), fix password save, add home link
c024d9c feat: SEO overhaul + restore landing page at /, move app to /app
2a5fe08 fix: yt-dlp headless server support — mediaconnect player client + cookies file option
4e794d1 fix: Dockerfile public dir COPY failure, switch Railway to Dockerfile builder
7e4b3eb feat: trust-first BYOK — transparency banner, setup.sh, self-host docs
4178b88 feat: BYOK — users bring their own API keys via browser settings
a31a9f3 Deep persona rewrite + transcript pipeline fix + debug infrastructure
04f79c1 fix: the transcript was silently screaming into the void — WAV header was poisoning Deepgram
4a5e091 Howard Stern called, he wants his show staff back — now with Fred Norris and sine waves
c30b011 ship the whole damn MVP in one commit — this is how hustlers do it
```

---

## What Jason Wants (Master Truth)

From Jason's X post (@twistartups), the spec calls for:

1. **4 personas inspired by Howard Stern Show staff** (Gary Dell'Abate, Fred Norris, Jackie Martling, cynical troll)
2. **Real-time reactions** to live podcast audio
3. **Bubble UI** with sine wave "speaking" animation
4. **Multi-provider LLM** (no single-API dependency)
5. **Open source** (MIT license)
6. **Fact-checking** with real-time search
7. **Cross-persona awareness** (they talk to each other)
8. **Pause behavior** (personas react to being paused, not silenced)

---

## What's Been Implemented vs. What's Left

### Done
- Full audio pipeline (YouTube → yt-dlp → FFmpeg → Deepgram)
- All 4 personas with deep character research
- Multi-provider LLM (Claude Haiku + Groq Llama 70B/8B)
- Fact-checking pipeline (Brave Search → Producer context)
- Cross-persona awareness (each sees others' responses)
- Live vs Recorded mode detection + distinct UI
- Pause/Resume with persona reactions
- Manual fire button
- Bubble UI with sine wave speaking animation
- Structured debug logging
- Comprehensive debugging documentation
- Health check endpoint
- Landing page (docs/index.html)
- Test scripts for pipeline and personas
- Chrome extension built (background + offscreen + side panel + icons)
- Railway deploy live at peanutgallery.live
- BYOK flow — users bring their own API keys via the side panel

### Not Done / Blocking the Bounty
- **First successful E2E run of the Chrome extension** — icon click → stream ID → side panel → Start Listening → Deepgram → personas in feed. See [`SESSION-NOTES-2026-04-16.md §5`](SESSION-NOTES-2026-04-16.md) for the prioritized finish-strong checklist.
- Demo video (60 sec, lead with a real fact-check)
- Reply to Jason's bounty tweet with demo + repo link
- Chrome Web Store submission (gated on E2E working)

### Coming Soon — version-staged plan

Canonical source: [`ROADMAP.md`](ROADMAP.md). Summary:

- **v1.2.0 — "Mise en place":** Director debug panel + expanded routing logs, cascade-delay retune, real director test coverage, pre-merge `tsc`/lint/smoke gate.
- **v1.3.0 — "TWiST Pack" (flagship):** Persona-pack refactor + Howard/TWiST packs + pack-swap UI + pack-creation installer.
- **v1.4.0 — "Smart Director v2":** LLM-assisted routing with rule-based fallback.
- **v1.5.0 — "Voice + Clip Share":** TTS per persona; highlight/clip export.
- **v2.0.0 — "Bobbleheads":** 3D persona avatars with procedural animation.

Unscoped (explicitly not on the roadmap):
- Non-YouTube sources (Twitch, Kick, arbitrary tab audio) — already works via `chrome.tabCapture`; supported but not marketed until a pack is tuned for a different format.
- Custom persona builder, audience mode, show notes generator, OBS overlay, persona memory across episodes, mobile responsive design, `ScriptProcessorNode → AudioWorkletNode` cleanup. Left unscoped; revisit if user demand signals them.

---

## How to Run

```bash
cd peanut.gallery
cp .env.example .env.local  # Add your API keys
npm install
npm run dev                  # http://localhost:3000

# Debug mode (verbose pipeline logging)
DEBUG_PIPELINE=true npm run dev

# Test transcription standalone
npx tsx scripts/test-transcription.ts "https://youtube.com/watch?v=VIDEO_ID"

# Test personas standalone
npx tsx scripts/test-personas.ts
npx tsx scripts/test-personas.ts --fixture
```

---

## Cost Per Episode

| Service | Cost |
|---------|------|
| Deepgram (transcription) | ~$0.70/2hr episode |
| Claude Haiku (Producer + Jackie) | ~$0.40/episode |
| Groq (Troll + Fred) | ~$0.05/episode |
| Brave Search (fact-checking) | Free (1000 queries/month) |
| **Total** | **~$1.15/episode** |

---

## Notes for AI Assistants

1. **Read [`SESSION-NOTES-2026-04-16.md`](SESSION-NOTES-2026-04-16.md) before touching the Chrome extension.** §3 (permissions setup) is explicitly immutable — the current `manifest.json` + `background.js` `chrome.action.onClicked` gesture flow is the version that survived the permissions fights. Do not re-derive it from blog posts.
2. **Never use `-f wav` in FFmpeg when piping to Deepgram.** Use `-f s16le`. This is the single most important lesson from this project (ISSUE-001).
3. **`chrome.tabCapture.getMediaStreamId` must be called synchronously inside `chrome.action.onClicked`** — NOT deferred to a side-panel message handler. Deferring loses the user-gesture context and the call rejects. Stream IDs are single-use.
4. **The sandbox cannot run git commands** (no identity configured). Provide Seth with copy-paste commands to run locally.
5. **personas.ts is the creative soul of the project.** Any changes should preserve the deep character research and Howard Stern Show references.
6. **Read `docs/DEBUGGING.md` before debugging any pipeline issues.** It has post-mortems (ISSUE-001..008), a diagnostic checklist, and a silent failure table.
7. **`TWIST-AI-SIDEBAR-BUILD-PLAN.md` is archived.** Use this file + SESSION-NOTES as the source of truth.
8. **When testing, use `DEBUG_PIPELINE=true`** to get structured JSONL logs in `logs/pipeline-debug.jsonl`. Info+ level logs are always written to the file regardless.
9. **The project uses `@/*` path aliases** (e.g., `@/lib/personas`) per tsconfig.json.
10. **TranscriptBar.tsx exists but isn't used** — the transcript display is inlined in page.tsx.
11. **Always end every message with a ready-to-paste git commit command.** Jason Calacanis house style: lowercase, punchy, describes the "why" not the "what", emoji at the end. Provide it as a bash code block so Seth can copy-paste locally. If the commit message contains double quotes, wrap it in single quotes or a heredoc to avoid shell quoting errors. Include `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` on a second line.
