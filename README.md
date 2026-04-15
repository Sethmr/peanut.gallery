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

## Try It

Two ways to run Peanut Gallery. **We recommend self-hosting** — your API keys stay on your machine and never touch a third-party server.

### Option A: Self-Host (Recommended)

One command. Your keys never leave your machine.

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh
```

The setup script checks for dependencies (Node.js 18+, yt-dlp, ffmpeg), walks you through entering your API keys, and launches the app at `localhost:3000`. Keys are stored in `.env.local` on your machine — git-ignored, never uploaded anywhere.

**Prerequisites:** [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org/). Install both with:

```bash
brew install yt-dlp ffmpeg    # macOS
sudo apt install yt-dlp ffmpeg # Ubuntu/Debian
```

### Option B: Use the Hosted Version

Go to **[peanutgallery.live](https://peanutgallery.live)** and enter your API keys when prompted.

**How your keys are handled:** Your keys are stored in your browser's localStorage and sent to our server via request headers when you start a session. The server passes them directly to Deepgram, Groq, Anthropic, and Brave, then discards them when the session ends. Keys are never saved on the server, never logged, and never shared.

**This project is fully open source** — you can [audit the server code](https://github.com/Sethmr/peanut.gallery/blob/main/app/api/transcribe/route.ts) to verify exactly what happens with your keys. If you want zero trust required, use Option A.

---

## The Cast

Inspired by the Howard Stern Show staff, per Jason's spec.

### The Fact-Checker (Gary Dell'Abate)
*Powered by Claude Haiku | Brave Search for live fact-checking*

Monitors the conversation for factual claims and provides corrections or background data in real-time. Searches the web mid-show to verify statistics, dates, and attributions.

> [FACT CHECK] "Jason just said Uber was founded in 2007. It was 2009. Again."

### The Cynical Troll
*Powered by Groq Llama 70B (120ms response time)*

The "chaotic or negative cynical" commentator. Dunks on everything with internet-brain energy. Says what the audience is thinking but won't type.

> "Oh cool, another AI wrapper. Very 2024."

### Sound Effects Guy (Fred Norris)
*Powered by Groq Llama 8B*

Background context and sound effects. Precisely timed cues and the occasional razor-sharp one-liner.

> [record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]

### The Comedy Writer (Jackie Martling)
*Powered by Claude Haiku*

One-liners and jokes. Setup-punchline structure, callback humor, observational comedy.

> "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

---

## How It Works

```
YouTube URL → yt-dlp → FFmpeg → Deepgram Nova-3 → Director → AI Personas → SSE → UI
```

The audio pipeline runs server-side: yt-dlp extracts the audio stream, FFmpeg converts to PCM, and Deepgram's Nova-3 transcribes over WebSocket. The Director (a rule-based booth producer) reads each chunk and picks the best persona to respond — then cascades to others with decreasing probability and staggered timing. Some moments get 1 response, some get 2-3, and occasionally all 4 pile on.

The Fact-Checker has an extra step: it scores sentences for factual claims and runs parallel Brave Search queries to cross-reference.

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

## API Keys

All services have free tiers:

| Key | Sign up | Required? |
|-----|---------|-----------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | Yes |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | Yes |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Optional (enables Baba Booey + Jackie) |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | Optional (enables live fact-checking) |

---

## Deploy Your Own

Want to host your own instance? The app includes a Dockerfile with yt-dlp and ffmpeg pre-installed.

```bash
# Railway (recommended)
npx @railway/cli login
npx @railway/cli init -n my-peanut-gallery
npx @railway/cli up

# Or any Docker host
docker build -t peanut-gallery .
docker run -p 3000:3000 peanut-gallery
```

No server-side env vars needed — users provide their own keys through the UI.

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale.

Built for **[This Week in Startups](https://x.com/twistartups)** | Jason Calacanis & Lon Harris

---

MIT License | Fact-checking powered by Brave Search
