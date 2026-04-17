# Peanut Gallery — Speed Build Plan

> ⚠️ **ARCHIVED — DO NOT USE AS SOURCE OF TRUTH.**
> This is the original pre-build plan from 2026-04-15. It is kept for historical reference only.
> **Known stale in this file:** "Chaos Agent" persona (replaced by Fred Norris / Sound Effects), Vercel (deploy is Railway), `twist-sidebar` repo name (actual repo is `peanut.gallery`), FFmpeg `-f wav` (fixed to `-f s16le` — see ISSUE-001).
> **For the current state of the project, read in this order:**
> 1. [`docs/INDEX.md`](docs/INDEX.md) — docs map
> 2. [`docs/CONTEXT.md`](docs/CONTEXT.md) — canonical project context
> 3. [`docs/SESSION-NOTES-2026-04-16.md`](docs/SESSION-NOTES-2026-04-16.md) — most recent handoff + permissions guardrails
> 4. [`docs/DEBUGGING.md`](docs/DEBUGGING.md) — post-mortems

**Project:** Live AI sidebar with 4 personas watching This Week in Startups in real-time
**Goal:** Win the $5,000 bounty + guest spot on TWiST
**Name:** Peanut Gallery
**Repo:** `peanut.gallery` (GitHub)
**Domain:** peanutgallery.live
**URL:** https://peanutgallery.live

---

## PHASE 0: UNBLOCK EVERYTHING FIRST (30 minutes of your time)

These are the things that take human time (account signups, API key approvals). Do ALL of these before we write a single line of code. Some API keys take minutes, some take hours. Starting here means we never hit a wall waiting.

### You do right now:
1. **Deepgram** — Sign up at https://console.deepgram.com — get an API key (instant)
2. **Groq** — Sign up at https://console.groq.com — get an API key (instant, free tier: 2,000 req/day)
3. **Anthropic** — You likely already have this from using Claude. Get your API key from https://console.anthropic.com
4. **Brave Search API** — Sign up at https://api.search.brave.com — free tier covers 1,000 queries/month (for the fact-checker persona)
5. **GitHub repo** — Create a new public repo. MIT license. Call it something fun. Don't overthink it.
6. **Vercel account** — Sign up at https://vercel.com if you haven't (free, connect to GitHub)
7. **Install on your machine:** Node.js 20+, yt-dlp (`brew install yt-dlp`), ffmpeg (`brew install ffmpeg`)

### While keys are provisioning, tell me and we start Phase 1.

---

## PHASE 1: AUDIO → TEXT PIPELINE (The Riskiest Part — Do First)

**Why first:** If this doesn't work, nothing else matters. We validate the hardest integration before building anything around it.

### What I build for you:
- A standalone Node.js script: `test-transcription.js`
- Takes a YouTube URL (live or recorded) as an argument
- Spawns yt-dlp → pipes through ffmpeg → sends to Deepgram WebSocket
- Prints real-time transcript to the terminal

### The pipeline:
```
YouTube URL → yt-dlp (best audio, stdout) → ffmpeg (PCM 16-bit, 16kHz, mono) → Deepgram Nova-3 → transcript text
```

### Key technical decisions (already made):
- **Deepgram model:** Nova-3 (best accuracy, $0.0077/min)
- **Audio format:** Linear16, 16kHz, mono (what Deepgram expects)
- **FFmpeg flags:** `-acodec pcm_s16le -ar 16000 -ac 1 -f wav`
- **Interim results:** ON (we get partial words in real-time for snappier feel)

### You test it with:
```bash
# Test with a past TWiST episode (not live, just to validate the pipeline)
node test-transcription.js "https://www.youtube.com/watch?v=[ANY_TWIST_EPISODE_ID]"
```

### Definition of done:
- You see real-time transcript text appearing in your terminal within 5 seconds of starting
- Text is accurate and punctuated

### If something breaks:
- yt-dlp errors → we try `ytdl-core` npm package as fallback
- Deepgram connection drops → we add reconnection logic
- Audio format mismatch → we adjust ffmpeg flags

---

## PHASE 2: PERSONA ENGINE (The Fun Part)

**Why second:** Once we have transcript text flowing, we need the 4 personas reacting to it. This is the core product.

### What I build:
- `lib/personas.ts` — 4 system prompts, each a distinct voice
- `lib/persona-engine.ts` — Takes a transcript chunk, fans out to 4 LLM calls in parallel, streams responses back
- Transcript buffer that collects ~2 minutes of dialogue before triggering personas

### The 4 Personas (tuned for Jason's vibe):

**1. The Stern Producer (Claude Haiku)**
- AI version of Lon Harris keeping Jason honest
- Fact-checks claims against Brave Search in real-time
- Personality: dry, authoritative, occasionally exasperated
- "Jason just said Uber was founded in 2007. It was 2009. Again."
- WHY HAIKU: Needs reasoning + search integration, Haiku balances quality and cost

**2. The Cynical Troll (Groq — Llama 3.3 70B)**
- Dunks on everything with internet-brain energy
- Contrarian by default, occasionally right
- "Oh cool, another AI wrapper. Very 2024."
- WHY GROQ: 120ms TTFT means the troll is FAST, which is funnier. Trolls don't deliberate.

**3. The Chaos Agent (Groq — Llama 8B)**
- Derails, free-associates, says the thing no one was thinking
- Slightly unhinged — smaller model actually helps here
- "What if we replaced all VCs with a single pigeon trained on term sheets?"
- WHY GROQ 8B: Cheapest, fastest, and a dumber model = more chaotic = more entertaining

**4. The Joke Writer (Claude Haiku)**
- Setup-punchline structure, callback humor, observational comedy
- References running jokes from TWiST (we prime this in the system prompt)
- "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."
- WHY HAIKU: Humor requires nuance and timing that open-source models struggle with

### Technical architecture:
- Each persona gets: system prompt (cached) + last 15 min of rolling transcript + their own last 2 responses (for continuity)
- Personas fire every ~2 minutes of new transcript (configurable)
- All 4 fire in parallel — Promise.allSettled() so one slow/failed persona doesn't block the others
- Responses stream token-by-token via SSE to the frontend

### The fact-checker bonus:
- When the Producer persona fires, we ALSO hit Brave Search API with key claims extracted from the transcript
- Search results get injected into the Producer's context so it can verify/correct claims
- This is the "wow" feature — an AI that actually checks facts live

### Definition of done:
- Feed a transcript chunk in, get 4 distinct streaming responses back
- Each persona sounds different and stays in character
- Fact-checker actually finds relevant search results

---

## PHASE 3: THE UI (Make It Look Like a Real Product)

**Why third:** We now have working audio→text and text→personas. Time to put a face on it.

### What I build:
- Next.js 15 app with App Router
- 4-column sidebar layout using shadcn/ui Cards + ScrollArea
- Each column shows one persona's streaming commentary with an avatar and name
- Dark theme (podcast vibes)
- Simple control bar: paste YouTube URL, hit "Start", watch personas react

### Layout:
```
┌─────────────────────────────────────────────────────┐
│  🎙 TWiST AI Sidebar          [YouTube URL] [Start] │
├──────────┬──────────┬──────────┬───────────────────-─┤
│ PRODUCER │  TROLL   │  CHAOS   │  JOKE WRITER        │
│ 🎯       │  🔥      │  🌀      │  😂                  │
│          │          │          │                      │
│ Jason    │ Oh cool, │ What if  │ Jason's invest-      │
│ said Uber│ another  │ we just  │ ment thesis:         │
│ was 2007.│ AI wrap- │ replaced │ if it has 'AI'       │
│ It was   │ per.     │ all VCs  │ in the name...       │
│ 2009.    │ Very     │ with a   │                      │
│          │ 2024.    │ pigeon?  │                      │
│          │          │          │                      │
│ [new msg]│ [new msg]│ [new msg]│ [new msg]            │
│ ...      │ ...      │ ...      │ ...                  │
├──────────┴──────────┴──────────┴──────────────────-──┤
│ 📝 Live Transcript: "...and that's why I think the   │
│ Series A market is going to completely transform..."  │
└─────────────────────────────────────────────────────-┘
```

### Key UI decisions:
- **shadcn/ui** for components (Card, ScrollArea, Button, Input)
- **Tailwind CSS** for styling
- **Dark theme** — dark gray background, colored accents per persona
- **Auto-scroll** each column as new messages arrive
- **Typing indicator** while persona is streaming
- **Live transcript bar** at the bottom showing what's being said on the show
- **@microsoft/fetch-event-source** for SSE connections (supports POST, better than native EventSource)

### What we skip for MVP:
- Mobile responsive (desktop only is fine for a podcast production tool)
- User auth
- Persistent history
- Settings panel
- Multiple themes

### Definition of done:
- Open localhost, paste a YouTube URL, click Start
- See transcript appearing at bottom
- See 4 personas reacting in their columns with streaming text
- It looks good enough to screenshot/record for the submission

---

## PHASE 4: WIRING + POLISH (Make It Shippable)

### What I build:
- Connect all 3 phases into one running app
- SSE route handlers in Next.js (`/api/stream/[persona]`)
- Backend orchestrator that manages the transcription → persona pipeline
- Error handling and reconnection logic
- Environment variable setup (`.env.example`)

### Open source polish:
- Clean README with:
  - GIF/screenshot of it running (you record this)
  - One-command setup: `npm install && npm run dev`
  - Architecture diagram (I'll generate this)
  - "Built for This Week in Startups" callout
  - Clear API key setup instructions
- MIT license
- `.env.example` with all required keys listed
- `docker-compose.yml` for one-command deploy (nice-to-have)

### Jason-specific touches:
- Name the personas after their roles, not generic names
- Add a "Powered by" footer that shows Groq + Claude logos (shows the multi-provider approach he likes)
- Include a `/demo` mode that works with any YouTube video (not just TWiST)
- README leads with the problem: "What if your podcast had an AI writers' room reacting in real-time?"

---

## PHASE 5: DEMO + SUBMIT

### You do:
1. Pick a recent TWiST episode (ideally one where Jason makes bold claims — the personas will shine)
2. Screen-record the sidebar running alongside the episode
3. Keep it under 60 seconds — Jason has no patience for long demos
4. Post it as a reply to the original tweet with the GitHub link
5. Tag @jason and @twistartups

### What makes the demo pop:
- Show the fact-checker CORRECTING something Jason said (he'll love this)
- Show the troll dunking on a guest's pitch (entertainment value)
- Show the chaos agent saying something unhinged (memorable)
- End with the GitHub link and "Open source. MIT licensed. Ship it."

---

## COST SUMMARY

| Item | Cost |
|------|------|
| Deepgram (transcription) | ~$0.70 per 2-hour episode |
| Claude Haiku (Producer + Joke Writer) | ~$0.40 per episode |
| Groq (Troll + Chaos Agent) | ~$0.05 per episode (free tier covers testing) |
| Brave Search (fact-checking) | Free (1,000 queries/month) |
| Vercel hosting | Free tier |
| **Total per episode** | **~$1.15** |
| **Total to build** | **$0 (all free tiers)** |

---

## FUTURE ROADMAP (What We'd Build Next)

Things we tell Jason we're planning, which shows vision beyond the MVP:

1. **Chrome extension input** — Capture tab audio directly instead of yt-dlp (cleaner, no CLI dependency)
2. **Custom persona builder** — Let any podcaster define their own sidebar characters with custom prompts
3. **Audience mode** — Viewers see the sidebar alongside the live stream (embed widget)
4. **Highlights reel** — Personas vote on best moments, auto-generate timestamped clips
5. **Show notes generator** — Producer persona auto-generates timestamped episode notes
6. **Voice mode** — Personas speak their reactions (ElevenLabs TTS integration)
7. **Multi-show support** — Works with ANY podcast, not just TWiST
8. **OBS overlay** — Browser source that integrates directly into podcast production
9. **Persona memory** — Personas remember previous episodes, build running jokes, reference past guests
10. **API/SDK** — Let other developers build their own personas and plug them in

---

## WHAT IMPRESSES JASON (Research-Backed)

Based on deep research into Jason Calacanis's preferences:

- **Speed over polish** — He ships in 8 weeks what others ship in 6 months. Show speed.
- **Multi-provider, no platform trap** — He's explicitly warned against single-API dependency. Our Groq + Claude hybrid nails this.
- **Open source** — He's obsessed with OpenClaw. MIT license, clean repo, welcoming README.
- **Specific examples > vague promises** — The demo should show the fact-checker catching a real error, not a hypothetical.
- **Scrappiness** — Don't over-engineer. Ship the MVP, show it works, iterate.
- **The Producer persona is the killer feature** — An AI that does Lon Harris's job in real-time? That's the "holy shit" moment.
- **Quantify time saved** — "This replaces 10 hours/week of post-show fact-checking and note-taking."

---

## YOUR COMMANDS (Quick Reference)

```bash
# Setup
git clone [your-repo] && cd twist-sidebar
cp .env.example .env  # Fill in your API keys
npm install

# Development
npm run dev  # Starts Next.js on localhost:3000

# Test transcription pipeline standalone
node scripts/test-transcription.js "https://youtube.com/watch?v=EPISODE_ID"

# Test personas standalone
node scripts/test-personas.js "Jason just said that Uber was founded in 2007 and has 50 million users"

# Deploy
vercel  # One command deploy
```

> API keys moved to `.env.local` — never commit secrets to version control!
