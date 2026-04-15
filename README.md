# Peanut Gallery

**Your podcast's AI writers' room.**

4 AI personas — inspired by the Howard Stern Show staff — watch your podcast in real-time and react through a streaming sidebar. A fact-checker keeping the host honest. A sound effects guy scoring every moment. A comedy writer dropping one-liners. A cynical troll saying what the audience is thinking.

**[peanutgallery.live](https://peanutgallery.live)** | MIT Licensed | Open Source

---

> $5,000 + a guest spot on the show. Here's what you have to build...
>
> — [@twistartups](https://x.com/twistartups)

Built in response to Jason Calacanis and Lon Harris's open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups).

---

## The Cast

Inspired by the Howard Stern Show staff, per Jason's spec.

### The Fact-Checker (Gary Dell'Abate)
*Powered by Claude Haiku | Brave Search for live fact-checking*

Monitors the conversation for factual claims and provides corrections or background data in real-time. Searches the web mid-show to verify statistics, dates, and attributions. The AI version of a producer who won't let anything slide.

> [FACT CHECK] "Jason just said Uber was founded in 2007. It was 2009. Again."

### The Cynical Troll
*Powered by Groq Llama 70B (120ms response time)*

The "chaotic or negative cynical" commentator. Dunks on everything with internet-brain energy. Contrarian by default, occasionally right. Says what the audience is thinking but won't type.

> "Oh cool, another AI wrapper. Very 2024."

### Sound Effects Guy (Fred Norris)
*Powered by Groq Llama 8B*

Supplies background context and sound effects. Communicates through precisely timed sound cues and the occasional razor-sharp one-liner. Sets the mood for every moment.

> [record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]

### The Comedy Writer (Jackie Martling)
*Powered by Claude Haiku*

Generates one-liners and jokes related to the current discussion. Setup-punchline structure, callback humor, observational comedy. The one who makes you spit out your coffee.

> "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

---

## Features

**Implemented:**

- Real-time transcription via Deepgram Nova-3 (sub-300ms latency)
- Embedded YouTube player — watch the show inside the app
- 4 AI personas fire in parallel every 30-60 seconds of new dialogue
- Token-by-token streaming via Server-Sent Events
- Live fact-checking with Brave Search (claim scoring + parallel queries)
- Cross-persona awareness — AIs see and riff off each other's responses
- Bubble UI with sine wave "speaking" indicators per Jason's spec
- Live vs. Recorded mode detection with distinct UI/UX
- Live mode: red theme, pulsing LIVE badge, no pause button, auto-reconnect
- Recorded mode: synced pause/resume with video, blue theme
- Pause makes AIs annoyed (they react in character), not silent
- Manual fire button for instant persona triggering
- Multi-provider LLM: Claude Haiku + Groq Llama (no single point of failure)
- Desktop-first layout with video on left, 2x2 persona grid on right

**Coming soon:**

- Profile pictures for each persona bubble
- Audio playback of sound effect cues (from Sound Effects Guy)
- Chrome extension for tab audio capture
- Two-stream output: regular show + enhanced version with AI sidebar
- Custom persona builder
- Voice mode (personas speak via ElevenLabs)
- OBS overlay integration

---

## Usage

**1. Start the app**
```bash
npm run dev
```
Open [localhost:3000](http://localhost:3000). You'll see the Peanut Gallery dashboard — a YouTube player on the left, 4 persona bubbles in a 2x2 grid on the right.

**2. Pick a video**

Grab any YouTube URL. Works with live streams and recorded videos. Some good ones to try:

- Any [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups) episode
- Any podcast where someone makes bold claims (the Fact-Checker loves those)
- A startup pitch video (the Troll and Sound Effects Guy go wild)

**3. Paste & Start**

Paste the URL into the top bar and click **Start**. Three things happen:

- The **Live Transcript** starts showing what's being said on the show
- After ~30 seconds of transcript, all **4 personas fire simultaneously**
- Each persona's response **streams token-by-token** with a sine wave animation

**4. Watch the gallery react**

The personas fire every ~60 seconds of new dialogue. Each one stays in character and remembers recent responses for callbacks. The Fact-Checker searches the web in real-time. The Sound Effects Guy drops [air horns] and [sad trombones]. They riff off each other.

**5. Use the controls**

- **Pause** (recorded mode): pauses video AND makes the AIs react to being paused in character
- **Fire button** (the flame icon): force-triggers all personas immediately
- **Stop / End Session**: kills the pipeline

---

## How It Works

```
YouTube URL -> yt-dlp -> FFmpeg -> Deepgram Nova-3 -> 4 AI Personas -> SSE -> Bubble UI
```

The audio pipeline runs server-side: yt-dlp extracts the audio stream, FFmpeg converts it to PCM 16-bit/16kHz/mono, and Deepgram's Nova-3 model transcribes it over a WebSocket. When enough new transcript accumulates, the persona engine fans out to all 4 LLMs in parallel using `Promise.allSettled()` — one failure never blocks the others. Responses stream back to the browser via Server-Sent Events.

For live streams: yt-dlp uses HLS MPEG-TS mode, Deepgram gets keepalive pings every 8s to prevent timeout on quiet segments, and the pipeline auto-reconnects with exponential backoff if the stream drops.

The Fact-Checker has an extra step: it scores sentences against claim patterns (numbers, dates, attributions, comparisons), takes the top 3, and runs parallel Brave Search queries to cross-reference.

---

## Stack

Multi-provider by design. No platform trap.

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 15, Tailwind | App Router + SSE streaming |
| Transcription | Deepgram Nova-3 | Sub-300ms, WebSocket native |
| Fact-Checker + Comedy Writer | Claude Haiku (Anthropic) | Reasoning + nuance |
| Troll + Sound Effects Guy | Groq + Llama 70B/8B | 120ms TTFT |
| Fact-Checking | Brave Search API | Real-time claim verification |

**Cost per 2-hour episode: ~$1.15**

---

## Dev Setup

**Prerequisites:** Node.js 20+, [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`brew install yt-dlp`), [FFmpeg](https://ffmpeg.org/) (`brew install ffmpeg`)

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
cp .env.example .env.local
npm install
```

Get your API keys (all have free tiers):

| Key | Sign up | Paste into `.env.local` as |
|-----|---------|---------------------------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | `DEEPGRAM_API_KEY` |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | `GROQ_API_KEY` |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | `BRAVE_SEARCH_API_KEY` |

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000), paste a YouTube URL, hit Start.

---

## AI Setup

Give this prompt to Claude, Cursor, or any AI coding assistant with terminal access:

> **Clone and set up the Peanut Gallery project from https://github.com/Sethmr/peanut.gallery.** Install all dependencies (Node.js, yt-dlp, ffmpeg). Create `.env.local` from `.env.example` and ask me for each API key. Read the `TWIST-AI-SIDEBAR-BUILD-PLAN.md` for full architecture context. Run `npm install`, then `npm run dev` and confirm the app loads at localhost:3000.

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale.

Built for **[This Week in Startups](https://x.com/twistartups)** | Jason Calacanis & Lon Harris

---

MIT License | Fact-checking powered by Brave Search
