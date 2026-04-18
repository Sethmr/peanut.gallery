# Peanut Gallery — Debugging Guide

> This document is the canonical reference for diagnosing data pipeline issues.
> AI assistants: read this file FIRST when debugging transcription, persona, or streaming problems.
> Humans: update this file every time you fix a bug. Future you will thank past you.

Last updated: 2026-04-17

---

## Pipeline Architecture

```
YouTube URL
    │
    ▼
 yt-dlp (binary)          ← Can fail: PATH, live detection, stream format
    │ stdout pipe
    ▼
 FFmpeg (binary)           ← Can fail: codec, format mismatch, pipe breakage
    │ stdout pipe (raw PCM: s16le, 16kHz, mono)
    ▼
 Deepgram Nova-3           ← Can fail: auth, encoding mismatch, WebSocket drop
    │ WebSocket messages
    ▼
 TranscriptionManager      ← Can fail: buffer overflow, trigger timing
    │ EventEmitter
    ▼
 SSE Route Handler         ← Can fail: client disconnect, session state
    │ Server-Sent Events
    ▼
 Frontend (page.tsx)       ← Can fail: SSE parsing, state management
    │ React state
    ▼
 PersonaEngine             ← Can fail: API keys, model names, rate limits
    │ Parallel LLM streams
    ▼
 4 Persona Columns (UI)   ← Can fail: streaming text accumulation
```

---

## Known Issues & Fixes (Post-Mortem Log)

### ISSUE-001: No transcript output — FFmpeg WAV header poisoning Deepgram
- **Date:** 2026-04-15
- **Symptom:** Pipeline connects, no errors shown, but transcript area stays empty forever.
- **Root cause:** FFmpeg was configured with `-f wav` which wraps PCM audio in a WAV container including a 44-byte RIFF header. Deepgram was configured for `encoding=linear16` (raw PCM), so the header bytes were decoded as audio, producing garbage that Deepgram couldn't transcribe.
- **Fix:** Changed `-f wav` to `-f s16le` in both `transcription.ts:start()` and `transcription.ts:restartAudioPipeline()`.
- **Lesson:** When piping audio between processes, container formats (WAV, FLAC, OGG) add headers that downstream consumers don't expect. Always use raw formats (`s16le`, `f32le`) when the consumer specifies a raw encoding.
- **How to verify:** Check ffmpeg args include `-f s16le`, NOT `-f wav`.

### ISSUE-002: `spawn yt-dlp ENOENT` — binary not found in Next.js server
- **Date:** 2026-04-15
- **Symptom:** Error: `spawn yt-dlp ENOENT` immediately after clicking Start.
- **Root cause:** Next.js server process doesn't inherit the user's shell PATH. Homebrew binaries (`/opt/homebrew/bin/yt-dlp`) aren't on the default PATH.
- **Fix:** Added `which()` function in `transcription.ts` that checks `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin` before falling back to shell `which`.
- **Lesson:** Never assume CLI tools are on PATH in Node.js server contexts. Always resolve full paths.
- **How to verify:** Run the health endpoint (`GET /api/health`) — it reports binary status.

### ISSUE-003: `bufferUtil.mask is not a function` — ws native deps missing
- **Date:** 2026-04-15
- **Symptom:** Deepgram WebSocket fails with `bufferUtil.mask is not a function`.
- **Root cause:** The `ws` package has optional native dependencies (`bufferutil`, `utf-8-validate`) that weren't installed. The pure-JS fallback was broken on this version.
- **Fix:** Added `bufferutil` and `utf-8-validate` to package.json dependencies. Run `npm install` on the host machine (native compilation required).
- **Lesson:** Always install `ws` companion packages when using WebSockets in Node.js.
- **How to verify:** `node -e "require('bufferutil')"` should not throw.

### ISSUE-004: Force-fire button doesn't trigger personas
- **Date:** 2026-04-15
- **Symptom:** Clicking the fire button returns success but no personas fire.
- **Root cause:** The `force_fire` PATCH handler called `resetNewTranscript()` (which clears the buffer) BEFORE `forceNextTrigger()` (which needs buffer content). The persona interval check then saw empty buffer and skipped.
- **Fix:** Removed the premature `resetNewTranscript()` call. `forceNextTrigger()` now handles populating the buffer from the full transcript if needed.
- **Lesson:** When building manual trigger mechanisms, don't clear the data you're about to use. The interval loop's normal `resetNewTranscript()` call handles cleanup after firing.

### ISSUE-005: Deepgram errors silently swallowed
- **Date:** 2026-04-15
- **Symptom:** No transcript, no errors. Deepgram sends error messages but the app ignores them.
- **Root cause:** The WebSocket message handler only checked for `data.type === "Results"`. Error messages (`type: "Error"`) fell through to an empty catch block.
- **Fix:** Added explicit handling for `data.type === "Error"` and `data.error`, emitting them as error events.
- **Lesson:** Always handle error message types from WebSocket APIs. Silent catch blocks are debugging poison.

### ISSUE-006: Personas fire repeatedly while paused — no visible transcript
- **Date:** 2026-04-15
- **Symptom:** User pauses the video (recorded mode). The 4 AI personas keep triggering and generating responses every 60 seconds, but the transcript area shows nothing — it looks like they're talking about thin air.
- **Root cause:** Two interacting bugs:
  1. The YouTube player pauses, but the server-side audio pipeline (yt-dlp → FFmpeg → Deepgram) keeps running. Transcript keeps accumulating in `newTranscriptSinceLastTrigger` on the server.
  2. The persona interval loop has two trigger paths: `shouldFire` (normal threshold) and `justPaused` (one-shot pause reaction). `shouldFire` doesn't check pause state, so it keeps returning true from the invisible accumulating transcript.
  3. The route handler suppresses transcript events when paused (`if (!session.paused) { send(...) }`), so the UI shows nothing even though data is flowing server-side.
- **Fix:** Changed the persona trigger condition in `route.ts` from `if (shouldFire || justPaused)` to `if ((shouldFire && !session.paused) || justPaused)`. Now when paused, only the one-shot `justPaused` path fires (capped by `pauseFiredCount`). Normal `shouldFire` is blocked during pause.
- **Lesson:** When two systems are decoupled (YouTube player vs. server-side audio pipeline), pausing one doesn't pause the other. Any "paused" behavior needs explicit guards at every downstream consumer, not just the UI layer.
- **How to verify:** Pause the video in recorded mode. Personas should fire exactly once (the in-character pause reaction), then stop until resume.

### ISSUE-007: No transcript — pipeline running but no data flowing (silent stall)
- **Date:** 2026-04-15
- **Symptom:** Pipeline starts successfully (status events fire, "Recorded" badge shows, Deepgram connects), but transcript area stays on "Listening..." forever. No errors shown.
- **Root cause:** Under investigation. The pipeline has zero visibility into data flow between stages. yt-dlp could fail to extract audio, ffmpeg could stall, or Deepgram could receive data but not produce transcript — and none of these would surface an error.
- **Fix:** Added pipeline data-flow tracking:
  1. **Byte counters** at each stage: `ytdlpBytesReceived`, `ffmpegBytesReceived`, `deepgramMessagesReceived`
  2. **First-bytes indicators**: console.log + status events when each stage first produces output
  3. **15-second stall detector**: if no transcript arrives within 15s of Deepgram connecting, diagnoses which stage stalled and surfaces it to the UI
  4. **Always-on logging**: debug logger now writes info+ to `logs/pipeline-debug.jsonl` without needing `DEBUG_PIPELINE=true`
  5. **UI pipeline stages**: transcript area shows pipeline progress messages instead of just "Listening..."
- **Lesson:** Every pipe between two processes is a potential silent failure point. Always add "first bytes received" indicators and stall detection.
- **How to verify:** Start a session. The terminal should show `[PG]` prefixed logs for each stage. The transcript area should show pipeline progress. After 15s with no transcript, a specific diagnostic error appears.

### ISSUE-008: yt-dlp produces zero bytes — YouTube requires cookies
- **Date:** 2026-04-15
- **Symptom:** Pipeline starts, Deepgram connects, but yt-dlp produces 0 bytes. Stall detector fires after 15s with "yt-dlp is not producing audio." Video plays fine in the YouTube iframe embed.
- **Root cause:** YouTube increasingly requires authentication for audio stream extraction. The iframe embed works because it uses YouTube's own player with the user's browser session. yt-dlp runs server-side with no authentication, so YouTube blocks the extraction.
- **Fix (immediate):** Update yt-dlp: `brew upgrade yt-dlp` or `yt-dlp -U`. This often fixes it because new yt-dlp versions include updated extraction logic.
- **Fix (persistent):** Add `YT_DLP_COOKIE_BROWSER=chrome` to `.env.local`. This tells yt-dlp to use cookies from the user's browser, authenticating with YouTube. Supported values: `chrome`, `firefox`, `safari`, `edge`, `brave`.
- **Lesson:** YouTube's extraction landscape changes constantly. Always keep yt-dlp updated, and cookie auth is increasingly mandatory, not optional.
- **How to verify:** Run `yt-dlp --cookies-from-browser chrome -f bestaudio -o - "URL" | head -c 1024 | wc -c` — should output `1024`.

### ISSUE-009: GitHub push protection rejected v1.1.1 for embedded demo API keys
- **Date:** 2026-04-17
- **Symptom:** `git push` on the v1.1.1 commit failed with `remote: error: GH013: Repository rule violations found for refs/heads/main` and specific hits on "Groq API Key" at `extension/sidepanel.js:19` and "Anthropic API Key" at `extension/sidepanel.js:20`.
- **Root cause:** During v1.1.1 development a `DEMO_DEFAULT_KEYS` constant was added to `extension/sidepanel.js` with live Deepgram / Groq / Anthropic / Brave keys, so first-time users could try the extension without signing up. Distinctive key prefixes (`sk-ant-`, `gsk_`) tripped GitHub's secret-scanning patterns. The two commits containing the keys were local only — nothing was pushed.
- **Fix:** Refactored to the server-side fallback pattern documented in [`docs/SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md). Extension inputs default to empty strings; `extension/offscreen.js` only sets `X-*-Key` headers when the user entered a value; the backend's existing header-first / env-var-fallback logic in `app/api/transcribe/route.ts` and `app/api/personas/route.ts` covers demo access using Vercel env vars. After a `git reset origin/main` + clean recommit, zero keys remain in any tracked file.
- **Lesson:** Any "demo keys for easy first-run" pattern must live on the server (in env vars) not in the client. Public extensions are scraped within minutes of publish; the Chrome Web Store zip is trivially extractable by any reviewer or end user. GitHub push protection is the last line of defense — treat a block as *correct* and redesign, don't click the unblock link for your own intentional commits.
- **How to verify:** `grep -r "DEMO_DEFAULT\|sk-ant-api\|gsk_" extension/` returns no matches. The `app/api/transcribe/route.ts` key lines follow the header-first pattern: `req.headers.get("X-Deepgram-Key") || process.env.DEEPGRAM_API_KEY`.

---

## Pipeline Data Flow Indicators

After ISSUE-007, the pipeline now logs at every stage. Watch the terminal for these `[PG]` messages:

```
[PG] Pipeline starting — yt-dlp: /opt/homebrew/bin/yt-dlp, ffmpeg: /opt/homebrew/bin/ffmpeg
[PG] URL: https://www.youtube.com/watch?v=...
[PG] Deepgram: WebSocket connected
[PG] yt-dlp: first audio bytes received (65536 bytes)
[PG] ffmpeg: first PCM output received (32000 bytes)
[PG] Deepgram: first transcript received — "Welcome back to This Week in..."
```

If it stalls, the last message that appears tells you exactly where:

| Last message seen | Problem | Check |
|-------------------|---------|-------|
| `Pipeline starting` only | yt-dlp or ffmpeg binary not found | Run `which yt-dlp && which ffmpeg` |
| `Deepgram: WebSocket connected` | yt-dlp not producing audio | Run `yt-dlp -f bestaudio -o - "URL" \| head -c 1024 \| wc -c` |
| `yt-dlp: first audio bytes` | ffmpeg not converting | Check ffmpeg stderr in terminal |
| `ffmpeg: first PCM output` | Deepgram not transcribing | Check API key, audio may be silence |
| `STALL DETECTED` + diagnostics | Specific stage identified | Follow the error message |

---

## Diagnostic Checklist

When transcript isn't working, run through this in order:

### 1. Environment
```bash
# Check all required binaries exist and are executable
which yt-dlp && yt-dlp --version
which ffmpeg && ffmpeg -version | head -1

# Check API keys are set
cat .env.local | grep -c "API_KEY"   # Should be 4

# Check health endpoint
curl http://localhost:3000/api/health | jq .
```

### 2. yt-dlp layer
```bash
# Can yt-dlp reach the video?
yt-dlp --print title "YOUR_YOUTUBE_URL"

# Can it extract audio to stdout?
yt-dlp -f bestaudio --no-warnings -o - "YOUR_YOUTUBE_URL" | head -c 1024 | wc -c
# Should output: 1024

# Is it a live stream?
yt-dlp --print is_live --no-download "YOUR_YOUTUBE_URL"
```

### 3. FFmpeg layer
```bash
# Can ffmpeg convert the audio stream to raw PCM?
yt-dlp -f bestaudio --no-warnings -o - "YOUR_YOUTUBE_URL" | \
  ffmpeg -i pipe:0 -acodec pcm_s16le -ar 16000 -ac 1 -f s16le pipe:1 2>/dev/null | \
  head -c 32000 | wc -c
# Should output: 32000 (1 second of 16kHz 16-bit mono = 32000 bytes)
```

### 4. Deepgram layer
```bash
# Test Deepgram directly with a WAV file
curl -X POST "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true" \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test.wav
```

### 5. SSE layer
```bash
# Watch raw SSE events from the pipeline
curl -N -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"url":"YOUR_YOUTUBE_URL"}' 2>/dev/null | head -50
# Should see: event: status, event: transcript lines within 10-30 seconds
```

### 6. Persona layer
```bash
# Test personas standalone (no pipeline needed)
npx tsx scripts/test-personas.ts
npx tsx scripts/test-personas.ts --fixture  # Uses real TWiST transcript
```

---

## Silent Failure Points

These are places in the code where errors are caught but not surfaced. If you're debugging and see "nothing happens," check these:

| Location | What fails silently | How to detect |
|----------|-------------------|---------------|
| `transcription.ts` `which()` | Binary not found — returns bare name, spawn fails later | Check server console for ENOENT |
| `transcription.ts` live detection | 10s timeout resolves null — defaults to recorded mode | Check `live_detected` SSE event |
| `transcription.ts` yt-dlp stderr | Only surfaces lines containing "ERROR" — warnings dropped | Run yt-dlp manually to see full stderr |
| `transcription.ts` ffmpeg stderr | Filters out "Error while decoding" as transient — may hide real issues | Run ffmpeg manually with `-loglevel error` |
| `persona-engine.ts` Brave Search | Returns undefined on any failure — Producer fires without search context | Check if Producer responses lack fact-check data |
| `persona-engine.ts` claim scoring | Sentences scoring 0 are silently dropped — no visibility into what was filtered | Add `debug-pipeline` logger (see below) |
| `route.ts` SSE enqueue | Catch block swallows errors when stream is closed — no log of client disconnect | Check Next.js server logs for connection count |
| `route.ts` persona interval | `personasFiring` flag stuck true if LLM hangs — all future triggers skip | Check if personas fire exactly once then stop |

---

## Environment Variables

| Variable | Required | Used by | Failure mode if missing |
|----------|----------|---------|------------------------|
| `DEEPGRAM_API_KEY` | Yes | transcription.ts | Pipeline won't start (returns 400) |
| `ANTHROPIC_API_KEY` | Yes (unless xAI set) | persona-engine.ts | Producer + Joker fire with empty key → API error |
| `XAI_API_KEY` | Yes (unless Anthropic set) | persona-engine.ts | Troll + Sound FX fire with empty key → API error. Also powers xAI Live Search when `SEARCH_ENGINE=xai`. |
| `SEARCH_ENGINE` | No (defaults to `brave`) | persona-engine.ts | — |
| `BRAVE_SEARCH_API_KEY` | Only when `SEARCH_ENGINE=brave` | persona-engine.ts | Fact-checking falls back to training knowledge |

The route requires `DEEPGRAM_API_KEY` plus at least one of Anthropic/xAI. Missing both is a 400. Missing just one just silences the two personas that provider powers.

---

## Data Flow Timing

Understanding when things happen helps debug timing issues:

```
t=0s     User clicks Start
t=0.1s   POST /api/transcribe — session created
t=0.5s   yt-dlp spawned, live detection starts (up to 10s timeout)
t=1-10s  Live detection completes
t=1-11s  FFmpeg spawned, piped to yt-dlp
t=2-12s  Deepgram WebSocket connected
t=2-15s  First audio bytes reach Deepgram
t=3-20s  First transcript fragments arrive (interim results)
t=5-25s  First final transcript segments
t=30s    FIRST persona trigger (if 30+ chars accumulated)
t=35s    Persona responses begin streaming to UI
t=90s    SECOND persona trigger (60s interval after first)
```

If you see nothing after 30 seconds, the problem is upstream of the persona engine.
If you see transcript but no persona responses, the problem is in the trigger logic or LLM calls.

---

## Debug Logger

The app includes a debug logger at `lib/debug-logger.ts` that writes structured events to `logs/pipeline-debug.jsonl`. This file is gitignored and accumulates during development.

**To enable verbose logging:**
```bash
DEBUG_PIPELINE=true npm run dev
```

**To read logs:**
```bash
# Last 20 events
tail -20 logs/pipeline-debug.jsonl | jq .

# Filter by event type
cat logs/pipeline-debug.jsonl | jq 'select(.event == "deepgram_message")'

# Filter errors only
cat logs/pipeline-debug.jsonl | jq 'select(.level == "error")'

# Trace a session end-to-end
cat logs/pipeline-debug.jsonl | jq 'select(.sessionId == "SESSION_ID_HERE")'
```

**Log format:**
```json
{
  "timestamp": "2026-04-15T20:30:00.000Z",
  "event": "transcript_final",
  "level": "info",
  "sessionId": "1713214200000",
  "data": {
    "text": "Jason just said that...",
    "bufferSize": 42,
    "newTranscriptLength": 156
  }
}
```

---

## Adding a New Known Issue

When you fix a bug, add it to the "Known Issues & Fixes" section above using this template:

```markdown
### ISSUE-NNN: Short description
- **Date:** YYYY-MM-DD
- **Symptom:** What the user sees (or doesn't see).
- **Root cause:** What was actually wrong in the code.
- **Fix:** What was changed and where.
- **Lesson:** The general principle so we don't repeat this class of bug.
- **How to verify:** A quick command or check to confirm the fix is in place.
```

Number issues sequentially. The log is append-only — never delete old entries.
