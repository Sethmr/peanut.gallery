# Peanut Gallery — Full Project Context

> **Read this file first when resuming work on this project.**
> It contains everything an AI assistant needs to pick up where the last session left off.
> Last updated: 2026-04-15

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

### Trigger Timing
- First persona fire: **30 seconds** after transcript starts (so user sees activity fast)
- Subsequent fires: every **60 seconds** of new transcript
- Minimum content threshold: **30 characters** of new transcript
- Manual fire button (fire emoji) available for instant trigger
- Persona interval checks every **5 seconds**

---

## File Map

### Core Pipeline
| File | Purpose |
|------|---------|
| `lib/transcription.ts` | Audio pipeline: yt-dlp → FFmpeg → Deepgram WebSocket. Handles live detection, keepalive, auto-reconnect, binary path resolution |
| `lib/persona-engine.ts` | Multi-provider LLM orchestrator. Fires 4 personas in parallel, streams responses. Includes Brave Search fact-checking pipeline |
| `lib/personas.ts` | All 4 persona definitions with deep Howard Stern character research. Exports `personas[]`, `buildPersonaContext()`, types |
| `lib/debug-logger.ts` | Structured JSONL logger. Writes to `logs/pipeline-debug.jsonl` when `DEBUG_PIPELINE=true` |

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
| `README.md` | Public-facing project README with setup instructions |
| `TWIST-AI-SIDEBAR-BUILD-PLAN.md` | Original build plan with 5 phases. Partially outdated (still references "Chaos Agent" persona) |
| `docs/DEBUGGING.md` | Canonical debugging reference with post-mortems, diagnostic checklist, silent failure table |
| `docs/CONTEXT.md` | THIS FILE — full project context for AI assistants |
| `docs/index.html` | Landing page for peanutgallery.live (GitHub Pages) |

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
a31a9f3 Deep persona rewrite + transcript pipeline fix + debug infrastructure
7e09860 add pipeline black box recorder — every bug now leaves a paper trail
04f79c1 fix: the transcript was silently screaming into the void — WAV header was poisoning Deepgram
4a5e091 Howard Stern called, he wants his show staff back — now with Fred Norris and sine waves
572e1c2 live mode and recorded mode are now two different products
db306ee the fact-checker just got a lot harder to argue with
8972667 the AI now pauses when you pause — because even robots need a bathroom break
1148923 now you can actually watch the show while the AI roasts it
5635e66 fix: teach the server where Homebrew hides its binaries
bd1104d README so good even a VC could follow the setup instructions
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

### Not Done / Coming Soon
- Chrome extension input (capture tab audio directly, no CLI dependency)
- Custom persona builder (let podcasters define their own characters)
- Audience mode (viewers see sidebar alongside live stream)
- Highlights reel (auto-generate timestamped clips)
- Show notes generator
- Voice mode (ElevenLabs TTS)
- OBS overlay integration
- Persona memory across episodes
- Docker deployment
- Mobile responsive design

### Needs Verification
- End-to-end transcript pipeline working after the `-f s16le` fix (Seth was testing locally)
- Persona personality quality after the deep character rewrite
- Whether the 30s/60s trigger timing feels right in practice

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

1. **Never use `-f wav` in FFmpeg when piping to Deepgram.** Use `-f s16le`. This is the single most important lesson from this project.
2. **The sandbox cannot run git commands** (no identity configured, can't delete lock files). Provide Seth with git commands to run locally.
3. **personas.ts is the creative soul of the project.** Any changes should preserve the deep character research and Howard Stern Show references.
4. **Read `docs/DEBUGGING.md` before debugging any pipeline issues.** It has post-mortems, a diagnostic checklist, and a silent failure table.
5. **The build plan (`TWIST-AI-SIDEBAR-BUILD-PLAN.md`) is partially outdated** — it still references "Chaos Agent" (now replaced by Fred/Sound Effects). Use this CONTEXT.md as the source of truth.
6. **When testing, use `DEBUG_PIPELINE=true`** to get structured JSONL logs in `logs/pipeline-debug.jsonl`.
7. **The project uses `@/*` path aliases** (e.g., `@/lib/personas`) per tsconfig.json.
8. **TranscriptBar.tsx exists but isn't used** — the transcript display is inlined in page.tsx.
