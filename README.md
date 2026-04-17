# Peanut Gallery

**A Chrome extension that puts an AI writers' room next to any YouTube video.**

4 AI personas — inspired by the Howard Stern Show staff — watch the show with you through a native Chrome side panel and react in real-time. A fact-checker keeping the host honest. A sound effects guy scoring every moment. A comedy writer dropping one-liners. A cynical troll saying what the audience is thinking.

**[peanutgallery.live](https://peanutgallery.live)** | MIT Licensed | Open Source

---

> $5,000 + a guest spot on the show. Here's what you have to build...
>
> — [@twistartups](https://x.com/twistartups)

Built in response to Jason Calacanis and Lon Harris's open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups).

---

## The Chrome Extension (primary product)

The main way to use Peanut Gallery. Silent tab audio capture via `chrome.tabCapture` — no permission picker, no interference with playback — and a gallery that lives in Chrome's native Side Panel right next to the video.

### Install

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh          # deps + API keys in .env.local
npm run dev         # starts local server on :3000
```

Then load the unpacked extension:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Open any YouTube video → click the 🥜 icon → **Start Listening**

That's it. Your keys live in `.env.local` on your machine — git-ignored, never uploaded.

**Prerequisites:** Node.js 18+. The extension flow doesn't need yt-dlp or ffmpeg (those are only for the reference web app below).

---

## The Web App (reference implementation)

Before the extension, Peanut Gallery was a Next.js web app where you pasted a YouTube URL. It's preserved in `app/` as a reference implementation — it proved out the persona engine, director, SSE stream, and UI that now powers the side panel. Kept around for prototyping the next iteration of the sidebar.

**Run the web app locally:** `npm run dev`, open `localhost:3000`, paste a URL.

**Hosted:** [peanutgallery.live](https://peanutgallery.live) — your keys get sent to the server via headers, forwarded to Deepgram/Groq/Anthropic/Brave, and discarded at session end. Never logged, never persisted. [Audit the route](https://github.com/Sethmr/peanut.gallery/blob/main/app/api/transcribe/route.ts) if you want zero trust required.

The web app uses `yt-dlp` + `ffmpeg` to pull audio server-side:

```bash
brew install yt-dlp ffmpeg          # macOS
sudo apt install yt-dlp ffmpeg      # Ubuntu/Debian
```

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

**Chrome Extension (primary):**
```
YouTube Tab → chrome.tabCapture → Offscreen Doc → PCM 16kHz (250ms chunks)
           → Local Server → Deepgram Nova-3 → Director → AI Personas → SSE → Side Panel
```

**Reference Web App:**
```
YouTube URL → yt-dlp → FFmpeg → Deepgram Nova-3 → Director → AI Personas → SSE → UI
```

In both, the **Director** (a rule-based booth producer) reads each transcript chunk and picks the best persona to respond — then cascades to others with decreasing probability and staggered timing. Some moments get 1 response, some get 2-3, and occasionally all 4 pile on.

The **Fact-Checker** has an extra step: it scores sentences for factual claims and runs parallel Brave Search queries to cross-reference.

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

## Contributing

**Always commit after finishing a workload worth pushing to test.** Don't let changes pile up across multiple features — commit after each logical unit of work so it can be tested, reviewed, and reverted independently if needed.

Commit message format: `type: short description — the witty why`

Types: `feat`, `fix`, `chore`, `debug`, `test`, `docs`

Examples:
```
feat: Chrome extension for tab audio capture — YouTube can't block what it can't see
fix: stall detector now handles browser audio mode correctly
chore: clean repo for open-source release
```

---

MIT License | Fact-checking powered by Brave Search
