# 🥜 Peanut Gallery

**Your podcast's AI writers' room.**

4 AI personas watch your live show and react in real-time. A stern producer keeping facts straight. A cynical troll. A chaos agent. A joke writer. All streaming alongside the conversation as it happens.

🌐 **[peanutgallery.live](https://peanutgallery.live)** &nbsp;|&nbsp; MIT Licensed &nbsp;|&nbsp; Open Source

---

> $5,000 + a guest spot on the show. Here's what you have to build...
>
> — [@twistartups](https://x.com/twistartups)

Built in response to Jason Calacanis and Lon Harris's open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups).

---

## 🚧 Status: Building in Public

We're shipping this fast. Star the repo to get notified.

---

## The Cast

### 🎯 The Stern Producer
*Powered by Claude Haiku*

Keeps facts straight. Searches the web in real-time to verify claims made on air. The AI version of a show producer who won't let anything slide.

> "Jason just said Uber was founded in 2007. It was 2009. Again."

### 🔥 The Cynical Troll
*Powered by Groq · Llama 70B*

Dunks on everything with internet-brain energy. Contrarian by default, occasionally right. Responds in 120ms because trolls don't deliberate.

> "Oh cool, another AI wrapper. Very 2024."

### 🌀 The Chaos Agent
*Powered by Groq · Llama 8B*

Derails, free-associates, says the thing no one was thinking. A smaller model makes the chaos feel more chaotic.

> "What if we replaced all VCs with a single pigeon trained on term sheets?"

### 😂 The Joke Writer
*Powered by Claude Haiku*

Setup-punchline structure, callback humor, observational comedy. The one who makes you spit out your coffee mid-episode.

> "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

---

## Usage

**1. Start the app**
```bash
npm run dev
```
Open [localhost:3000](http://localhost:3000). You'll see the Peanut Gallery dashboard — 4 empty persona columns and a URL bar at the top.

**2. Pick a video**

Grab any YouTube URL. Works with live streams and recorded videos. Some good ones to try:

- Any [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups) episode (the personas are tuned for Jason's vibe)
- Any podcast or talk where someone makes bold claims (the Producer loves those)
- A startup pitch video (the Troll and Chaos Agent go wild)

**3. Paste & Start**

Paste the URL into the top bar and click **Start**. Three things happen:

- 🔴 The **Live Transcript** bar at the bottom starts showing what's being said on the show
- ⏳ After ~90 seconds of transcript accumulates, all **4 personas fire simultaneously**
- 💬 Each persona's response **streams token-by-token** into its column

**4. Watch the gallery react**

The personas fire again every ~90 seconds of new dialogue. Each one stays in character and remembers its last few responses for callbacks and continuity. The Producer also searches the web in real-time to fact-check claims.

**5. Stop anytime**

Click **Stop** to kill the pipeline. The transcript and persona responses stay on screen.

---

## How It Works Under the Hood

```
YouTube URL → yt-dlp → FFmpeg → Deepgram Nova-3 → 4 AI Personas → Streaming Sidebar UI
```

The audio pipeline runs server-side: yt-dlp extracts the audio stream, FFmpeg converts it to PCM 16-bit/16kHz/mono, and Deepgram's Nova-3 model transcribes it over a WebSocket with sub-300ms latency. When enough new transcript accumulates (~90 seconds), the persona engine fans out to all 4 LLMs in parallel using `Promise.allSettled()` — so one slow or failed persona never blocks the others. Responses stream back to the browser via Server-Sent Events.

---

## Stack

Multi-provider by design. No platform trap.

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 15, Tailwind, shadcn/ui | App Router + SSE streaming |
| Transcription | Deepgram Nova-3 | Sub-300ms, $0.46/hr, WebSocket native |
| Smart Personas | Claude Haiku (Anthropic) | Reasoning + nuance for Producer & Joke Writer |
| Fast Personas | Groq + Llama | 120ms TTFT for Troll & Chaos Agent |
| Fact-Checking | Brave Search API | Real-time claim verification |
| Deployment | Vercel | One-click, free tier |

**Cost per 2-hour episode: ~$1.15**

---

## Dev Setup

**Prerequisites:** Node.js 20+, [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`brew install yt-dlp`), [FFmpeg](https://ffmpeg.org/) (`brew install ffmpeg`)

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
cp .env.example .env.local
```

Get your API keys (all have free tiers):

| Key | Sign up | Paste into `.env.local` as |
|-----|---------|---------------------------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | `DEEPGRAM_API_KEY` |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | `GROQ_API_KEY` |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | `BRAVE_SEARCH_API_KEY` |

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000), paste a YouTube URL, hit Start.

**Test individual pieces:**

```bash
npx tsx scripts/test-personas.ts                    # fire all 4 personas against a sample transcript
npx tsx scripts/test-transcription.ts "YOUTUBE_URL" # test the audio → text pipeline standalone
```

---

## AI Setup

Give this prompt to Claude, Cursor, or any AI coding assistant with terminal access:

> **Clone and set up the Peanut Gallery project from https://github.com/Sethmr/peanut.gallery.** Install all dependencies (Node.js, yt-dlp, ffmpeg). Create `.env.local` from `.env.example` and ask me for each API key. Read the `TWIST-AI-SIDEBAR-BUILD-PLAN.md` for full architecture context. Run `npm install`, then `npm run dev` and confirm the app loads at localhost:3000. Test the persona engine with `npx tsx scripts/test-personas.ts` and show me the output from all 4 personas.

---

## Roadmap

- [ ] Chrome extension for tab audio capture
- [ ] Custom persona builder
- [ ] Audience-facing mode (embed widget for viewers)
- [ ] Auto-generated show notes with timestamps
- [ ] Voice mode (personas speak via ElevenLabs)
- [ ] Persona memory across episodes
- [ ] OBS overlay integration
- [ ] Multi-show support (any podcast, not just TWiST)

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale. Currently building at the intersection of AI, podcasting, and chaos.

Built for **[This Week in Startups](https://x.com/twistartups)** · Jason Calacanis & Lon Harris

---

MIT License · Fact-checking powered by Brave Search
